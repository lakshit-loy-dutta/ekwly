import { useState } from 'react';
import { Camera as CameraIcon, Loader2 } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Camera } from '@capacitor/camera';
import { supabase } from '../../lib/supabase';
import { useSessionContext } from '../../lib/SessionContext';
import { showToast, utils } from '../../lib/utils';

export default function MagicScanner() {
  const { isHost, sessionRules, taxPresets, actions } = useSessionContext();
  const [isScanning, setIsScanning] = useState(false);

  // Guests don't scan receipts, so we hide it completely if not Host
  if (!isHost) return null;

  const fileToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onload = () => {
        let encoded = reader.result as string;
        encoded = encoded.replace(/^data:(.*,)?/, '');
        if (encoded.length % 4 > 0) encoded += '='.repeat(4 - (encoded.length % 4));
        resolve(encoded);
      };
      reader.onerror = reject;
    });
  };

  const initiateScan = async (e?: React.ChangeEvent<HTMLInputElement>) => {
    setIsScanning(true);
    showToast('Analyzing receipt with AI...', 'default');

    try {
      let base64Image = '';
      if (Capacitor.isNativePlatform()) {
        const image = await Camera.takePhoto({ quality: 90, includeMetadata: false });
        if (!image.uri) throw new Error('Failed to capture image');
        const webSafeUrl = Capacitor.convertFileSrc(image.uri);
        const response = await fetch(webSafeUrl);
        const blob = await response.blob();
        base64Image = await fileToBase64(blob);
      } else {
        const file = e?.target.files?.[0];
        if (!file) throw new Error('No file selected');
        base64Image = await fileToBase64(file);
      }

      const { data, error } = await supabase.functions.invoke('scan-receipt', {
        body: { imageBase64: base64Image, currentRules: sessionRules, currentTaxes: taxPresets },
      });

      const errMessage = error?.message || data?.error;
      if (errMessage) {
        if (errMessage === 'RATE_LIMIT_REACHED')
          throw new Error(
            "You've used your 3 free Magic Scans this month. Upgrade to Pro for unlimited scans."
          );
        if (errMessage.includes('UNAUTHORIZED'))
          throw new Error('Sign in from your Profile to use Magic Scan.');
        throw new Error(errMessage);
      }
      if (!data?.items) throw new Error('Failed to read receipt');

      // 1. Process Extracted Rules
      if (data.sessionRules) {
        await actions.updateSessionRulesInDB({
          isScApplicable: data.sessionRules.isScApplicable,
          serviceChargeRate: data.sessionRules.serviceChargeRate,
          discountType: data.sessionRules.discountType,
          discountValue: data.sessionRules.discountValue,
          discountMode: data.sessionRules.discountMode,
        });
      }

      // 2. Process Extracted Taxes
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

      // 3. Process Items
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

      <div className="flex w-full">
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={initiateScan}
          className="hidden"
          id="camera-input"
        />
        <button
          type="button"
          disabled={isScanning}
          onClick={() => {
            if (Capacitor.isNativePlatform()) initiateScan();
            else document.getElementById('camera-input')?.click();
          }}
          className="w-full h-14 bg-primary hover:bg-primary-hover active:scale-95 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-sm disabled:opacity-50 disabled:scale-100"
        >
          {isScanning ? (
            <>
              <Loader2 size={20} className="animate-spin" /> Analyzing Receipt...
            </>
          ) : (
            <>
              <CameraIcon size={20} /> Snap Photo
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
  );
}
