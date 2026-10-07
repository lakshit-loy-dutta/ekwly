import { useState } from 'react';
import {
  Camera as CameraIcon,
  Image as ImageIcon,
  Loader2,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Camera } from '@capacitor/camera'; // Removed deprecated enums
import { supabase } from '../../lib/supabase';
import { useSessionContext } from '../../lib/SessionContext';
import { showToast, utils } from '../../lib/utils';
import BottomSheet from '../ui/BottomSheet';

export default function MagicScanner() {
  const { isHost, sessionRules, taxPresets, actions } = useSessionContext();
  const [isScanning, setIsScanning] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  if (!isHost) return null;

  const fileToBase64 = (blob: Blob): Promise<{ base64: string; mimeType: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onload = () => {
        const result = reader.result as string;
        // Extract the mime type (e.g. "image/png") before stripping the prefix
        const mimeType = result.match(/^data:(.*?);base64,/)?.[1] || 'image/jpeg';
        let encoded = result.replace(/^data:(.*,)?/, '');
        if (encoded.length % 4 > 0) encoded += '='.repeat(4 - (encoded.length % 4));
        resolve({ base64: encoded, mimeType });
      };
      reader.onerror = reject;
    });
  };

  const initiateScan = async (
    sourceType: 'CAMERA' | 'GALLERY',
    e?: React.ChangeEvent<HTMLInputElement>
  ) => {
    setIsScanning(true);
    showToast('Analyzing receipt with AI...', 'default');

    try {
      let base64Image = '';
      let imageMimeType = 'image/jpeg'; // Default fallback

      if (Capacitor.isNativePlatform()) {
        let imageWebPath = '';

        if (sourceType === 'CAMERA') {
          const image = await Camera.takePhoto({ quality: 90 });
          if (!image || !image.webPath) throw new Error('Failed to capture image');
          imageWebPath = image.webPath;
        } else {
          const gallery = await Camera.chooseFromGallery({
            allowMultipleSelection: false,
            quality: 90,
          });
          if (
            !gallery ||
            !gallery.results ||
            gallery.results.length === 0 ||
            !gallery.results[0].webPath
          ) {
            throw new Error('No image selected');
          }
          imageWebPath = gallery.results[0].webPath;
        }

        const response = await fetch(imageWebPath);
        const blob = await response.blob();

        // 2. Use the new returned object
        const extracted = await fileToBase64(blob);
        base64Image = extracted.base64;
        imageMimeType = extracted.mimeType;
      } else {
        const file = e?.target.files?.[0];
        if (!file) throw new Error('No file selected');

        // 3. Use the new returned object
        const extracted = await fileToBase64(file);
        base64Image = extracted.base64;
        imageMimeType = extracted.mimeType;
      }

      // 4. Pass the extracted MIME type to the Edge Function
      const { data, error } = await supabase.functions.invoke('scan-receipt', {
        body: {
          imageBase64: base64Image,
          mimeType: imageMimeType,
          currentRules: sessionRules,
          currentTaxes: taxPresets,
        },
      });

      const errMessage = error?.message || data?.error;
      if (errMessage) {
        if (errMessage === 'RATE_LIMIT_REACHED' || errMessage.includes('3 free Magic Scans')) {
          setShowUpgradeModal(true);
          return;
        }
        throw new Error(errMessage);
      }

      if (!data?.items || data.items.length === 0)
        throw new Error('AI could not find any items on this receipt.');

      // 1. PROCESS NEW TAX PRESETS FIRST (So we have the real UUIDs)
      const tempIdMap: Record<string, string> = {};
      if (data.newTaxPresets && Array.isArray(data.newTaxPresets)) {
        for (const pt of data.newTaxPresets) {
          const newRealId = utils.generateId();
          tempIdMap[pt.tempId] = newRealId;
          await actions.addTaxPresetToDB({
            id: newRealId,
            name: pt.name,
            rate: pt.rate,
            split: pt.split !== false,
          });
        }
      }

      // 2. UPDATE SESSION RULES (Now we can map the AI's scTaxPresetId safely)
      if (data.sessionRules) {
        let scRate = data.sessionRules.serviceChargeRate || 0;
        if (scRate > 1) scRate = scRate / 100;

        let parsedScTaxId = data.sessionRules.scTaxPresetId || 'inherit';
        // If the AI assigned a tempId to the Service Charge Tax, convert it to the real UUID
        if (tempIdMap[parsedScTaxId]) parsedScTaxId = tempIdMap[parsedScTaxId];

        await actions.updateSessionRulesInDB({
          isScApplicable: data.sessionRules.isScApplicable,
          serviceChargeRate: scRate,
          scTaxPresetId: parsedScTaxId,
          discountType: data.sessionRules.discountType,
          discountValue: data.sessionRules.discountValue,
          discountMode: data.sessionRules.discountMode,
        });
      }

      // 3. INSERT ITEMS
      let addedCount = 0;
      for (const extractedItem of data.items) {
        if (!extractedItem.name || !extractedItem.price) continue;
        const finalTaxId =
          tempIdMap[extractedItem.taxPresetId] ||
          extractedItem.taxPresetId ||
          (taxPresets.length > 0 ? taxPresets[0].id : 'tx-1');

        await actions.addItemToDB?.({
          id: utils.generateId(),
          name: extractedItem.name,
          qty: extractedItem.qty || 1,
          unitPrice: extractedItem.price,
          taxRate: 0,
          taxPresetId: finalTaxId,
          applySC: extractedItem.applySC !== false,
          totalBase: (extractedItem.qty || 1) * extractedItem.price,
        });
        addedCount++;
      }

      showToast(`Magic Scan complete! Extracted ${addedCount} items.`, 'success');
    } catch (err: any) {
      console.error('Scan Error:', err);
      showToast(err.message || 'AI could not read this receipt cleanly.', 'error');
    } finally {
      setIsScanning(false);
      if (e?.target) e.target.value = '';
    }
  };

  return (
    <>
      <div className="bg-surface border-y border-border px-4 py-6 flex flex-col gap-5 shadow-sm">
        <div className="flex flex-col items-center text-center px-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-3">
            <CameraIcon size={24} />
          </div>
          <h3 className="font-bold text-main text-lg tracking-tight mb-1">Magic Scan</h3>
          <p className="text-sm text-muted">
            Upload a receipt and let AI extract the items, taxes, and service charges instantly.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 w-full">
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => initiateScan('CAMERA', e)}
            className="hidden"
            id="camera-input"
          />
          <input
            type="file"
            accept="image/*"
            onChange={(e) => initiateScan('GALLERY', e)}
            className="hidden"
            id="gallery-input"
          />

          <button
            type="button"
            disabled={isScanning}
            onClick={() =>
              Capacitor.isNativePlatform()
                ? initiateScan('CAMERA')
                : document.getElementById('camera-input')?.click()
            }
            className="h-14 bg-primary hover:bg-primary-hover active:scale-95 text-white rounded-xl font-bold flex flex-col items-center justify-center gap-1 transition-all shadow-sm disabled:opacity-50"
          >
            {isScanning ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <>
                <CameraIcon size={20} />
                <span className="text-[0.65rem] uppercase tracking-wider">Take Photo</span>
              </>
            )}
          </button>

          <button
            type="button"
            disabled={isScanning}
            onClick={() =>
              Capacitor.isNativePlatform()
                ? initiateScan('GALLERY')
                : document.getElementById('gallery-input')?.click()
            }
            className="h-14 bg-primary/10 hover:bg-primary/20 active:scale-95 text-primary border border-primary/20 rounded-xl font-bold flex flex-col items-center justify-center gap-1 transition-all shadow-sm disabled:opacity-50"
          >
            {isScanning ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <>
                <ImageIcon size={20} />
                <span className="text-[0.65rem] uppercase tracking-wider">Upload Image</span>
              </>
            )}
          </button>
        </div>

        <div className="flex items-center gap-4 mt-2 opacity-60">
          <div className="flex-1 h-px bg-border"></div>
          <span className="text-[0.7rem] font-bold uppercase tracking-widest text-muted">
            Or Configure Manually
          </span>
          <div className="flex-1 h-px bg-border"></div>
        </div>
      </div>

      <BottomSheet
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        title="Upgrade to Ekwly Pro"
      >
        <div className="flex flex-col items-center pb-4 text-center">
          <div className="w-16 h-16 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mb-4">
            <Sparkles size={32} />
          </div>
          <h2 className="text-xl font-bold text-main mb-2">You're out of free scans!</h2>
          <p className="text-[0.95rem] text-muted mb-6 leading-relaxed">
            You've used your 3 free Magic Scans for this month. Upgrade to Ekwly Pro to never type a
            receipt manually again.
          </p>

          <div className="w-full bg-surface border border-primary/20 rounded-2xl p-5 mb-6 text-left shadow-sm">
            <h3 className="font-bold text-main mb-4 flex justify-between items-center">
              Pro Plan{' '}
              <span className="text-primary text-xl tracking-tight">
                ₹99 <span className="text-sm text-muted font-medium">/mo</span>
              </span>
            </h3>
            <ul className="flex flex-col gap-3">
              <li className="flex items-center gap-2 text-[0.95rem] text-main font-medium">
                <CheckCircle2 size={18} className="text-success" /> Unlimited AI Receipt Scans
              </li>
              <li className="flex items-center gap-2 text-[0.95rem] text-main font-medium">
                <CheckCircle2 size={18} className="text-success" /> Personal Analytics Dashboard
              </li>
              <li className="flex items-center gap-2 text-[0.95rem] text-main font-medium">
                <CheckCircle2 size={18} className="text-success" /> Priority Email Support
              </li>
            </ul>
          </div>

          <a
            href="mailto:lloy.dutta@gmail.com?subject=Ekwly Pro Subscription Request&body=Hi, I would like to upgrade my account to Ekwly Pro for ₹99/month. My registered email is: "
            onClick={() => showToast('Redirecting to your mail client...', 'success')}
            className="w-full h-14 bg-primary text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm"
          >
            Contact Developer for Pro Access
          </a>
          <button
            onClick={() => setShowUpgradeModal(false)}
            className="mt-4 text-sm font-bold text-muted hover:text-main"
          >
            Maybe Later
          </button>
        </div>
      </BottomSheet>
    </>
  );
}
