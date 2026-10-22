import { useState, useRef } from 'react';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { supabase } from '../../lib/supabase';
import { useSessionContext } from '../../lib/SessionContext';
import { utils, showToast } from '../../lib/utils';
import type { BillItem, TaxPreset } from '../../lib/types';
import BrandLoader from '../ui/BrandLoader';
import ProUpgradeSheet from '../ui/ProUpgradeSheet';
import { Sparkles, Camera as CameraIcon, Image as ImageIcon } from 'lucide-react';

interface Props {
  onScanComplete?: () => void;
}

export default function MagicScanner({ onScanComplete }: Props) {
  const { isHost, taxPresets, currentUserId, actions } = useSessionContext();
  const [isScanning, setIsScanning] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isHost) return null;

  const compressImageToBase64 = (fileOrBlob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_DIMENSION = 1400;
          let width = img.width;
          let height = img.height;

          if (width > height && width > MAX_DIMENSION) {
            height = Math.round((height * MAX_DIMENSION) / width);
            width = MAX_DIMENSION;
          } else if (height > MAX_DIMENSION) {
            width = Math.round((width * MAX_DIMENSION) / height);
            height = MAX_DIMENSION;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject(new Error('Canvas context unavailable'));
          ctx.drawImage(img, 0, 0, width, height);

          const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
          const base64Clean = dataUrl.split(',')[1];
          resolve(base64Clean);
        };
        img.onerror = () => reject(new Error('Failed to decode receipt image'));
        img.src = event.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read image file'));
      reader.readAsDataURL(fileOrBlob);
    });
  };

  const processBase64Receipt = async (base64Image: string) => {
    setIsScanning(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        showToast('Sign in with Google or Email to use AI Magic Scan.', 'error');
        setIsScanning(false);
        return;
      }

      if (session.user?.email) setUserEmail(session.user.email);

      const { data, error } = await supabase.functions.invoke('scan-receipt', {
        body: { base64Image },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        if (error.message?.includes('QUOTA_EXCEEDED') || (error as any)?.status === 402) {
          setShowPaywall(true);
          setIsScanning(false);
          return;
        }
        throw error;
      }

      if (data?.error === 'QUOTA_EXCEEDED') {
        setShowPaywall(true);
        setIsScanning(false);
        return;
      }

      if (!data || !Array.isArray(data.items)) {
        throw new Error('Could not read items from this image. Try a clearer photo.');
      }

      // 1. Reconcile & batch-save any new tax brackets detected by Gemini
      const updatedPresets: TaxPreset[] = [...taxPresets];
      let hasNewPresets = false;

      if (Array.isArray(data.newTaxPresets)) {
        for (const tp of data.newTaxPresets) {
          const exists = updatedPresets.some(
            (existing) => Math.abs(existing.rate - Number(tp.rate)) < 0.1
          );
          if (!exists && Number(tp.rate) >= 0) {
            updatedPresets.push({
              id: utils.generateId(),
              name: tp.name || `Tax ${tp.rate}%`,
              rate: Number(tp.rate),
              split: tp.split !== false,
            });
            hasNewPresets = true;
          }
        }
      }

      if (hasNewPresets) {
        await actions.replaceTaxPresetsInDB(updatedPresets);
      }

      // 2. Apply venue, service charge & 3-layer discounts if detected
      const scRate = Number(data.serviceChargeRate || 0);
      const normScRate = scRate > 1 ? scRate / 100 : scRate;

      let resolvedScTaxPresetId = 'inherit';
      if (data.scTaxMode === 'none') {
        resolvedScTaxPresetId = 'none';
      } else if (data.scTaxMode === 'global') {
        const foodPreset =
          updatedPresets.find((t) => Math.abs(t.rate - 5) < 0.5) || updatedPresets[0];
        if (foodPreset) resolvedScTaxPresetId = foodPreset.id;
      }

      await actions.updateSessionRulesInDB({
        ...(data.venueName ? { venueName: data.venueName } : {}),
        isScApplicable: normScRate > 0,
        serviceChargeRate: normScRate,
        scTaxPresetId: resolvedScTaxPresetId,
        ...(data.discountType && data.discountType !== 'none'
          ? {
              discountType: data.discountType,
              discountValue: String(data.discountValue || ''),
              discountMode: data.discountMode || 'pre-tax',
            }
          : {}),
        ...(data.postTaxDiscountType && data.postTaxDiscountType !== 'none'
          ? {
              postTaxDiscountType: data.postTaxDiscountType,
              postTaxDiscountValue: String(data.postTaxDiscountValue || ''),
            }
          : {}),
      });

      // 3. Map & batch-insert all extracted line items in one single DB call
      const mappedItems: BillItem[] = data.items.map((raw: any) => {
        const qty = Math.max(0.01, Number(raw.qty) || 1);
        const unitPrice = Math.max(0, Number(raw.unitPrice) || 0);
        const itemRate = Number(raw.taxRate || 0);
        const matchedPreset =
          updatedPresets.find((p) => Math.abs(p.rate - itemRate) < 0.5) || updatedPresets[0];

        return {
          id: utils.generateId(),
          name: String(raw.name || 'Item').trim(),
          qty,
          unitPrice,
          taxRate: matchedPreset ? matchedPreset.rate / 100 : 0,
          taxPresetId: matchedPreset ? matchedPreset.id : 'tx-1',
          applySC: raw.applySC !== false,
          applyDiscount: raw.applyDiscount !== false,
          discountType: raw.discountType || 'none',
          discountValue: Number(raw.discountValue || 0),
          totalBase: utils.round2(qty * unitPrice),
        };
      });

      if (mappedItems.length > 0) {
        await actions.addItemsBatchToDB(mappedItems);
      }

      utils.haptic('heavy');
      showToast(`Extracted ${mappedItems.length} items with AI Magic Scan!`, 'success');
      if (onScanComplete) onScanComplete();
    } catch (err: any) {
      console.error('Magic Scan error:', err);
      showToast(err.message || 'Failed to scan receipt. Please try again.', 'error');
    } finally {
      setIsScanning(false);
    }
  };

  const handleNativeCamera = async (source: CameraSource) => {
    try {
      const photo = await Camera.getPhoto({
        quality: 85,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source,
      });
      if (!photo.webPath) return;
      const response = await fetch(photo.webPath);
      const blob = await response.blob();
      const base64 = await compressImageToBase64(blob);
      await processBase64Receipt(base64);
    } catch (err: any) {
      if (err?.message?.includes('cancelled')) return;
      showToast('Camera capture cancelled or unavailable.', 'default');
    }
  };

  const handleWebFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const base64 = await compressImageToBase64(file);
      await processBase64Receipt(base64);
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  return (
    <div className="flex flex-col gap-4 pb-2">
      <ProUpgradeSheet
        isOpen={showPaywall}
        onClose={() => setShowPaywall(false)}
        userId={currentUserId}
        userEmail={userEmail}
        reasonTitle="No Free Magic Scans Left This Month"
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleWebFileSelect}
        className="hidden"
      />

      {isScanning ? (
        <div className="py-6 flex flex-col items-center justify-center">
          <BrandLoader state="scan" label="AI Reading Receipt & Routing Taxes..." />
          <p className="text-xs text-muted text-center max-w-xs mt-1">
            Verifying item prices, GST/VAT brackets, Service Charge, and discounts...
          </p>
        </div>
      ) : (
        <>
          <div className="bg-primary/8 border border-primary/20 rounded-2xl p-4 flex items-start gap-3">
            <Sparkles size={20} className="text-primary shrink-0 mt-0.5" />
            <p className="text-xs text-muted leading-relaxed">
              Take a clear photo of your restaurant bill. Ekwly&apos;s AI Vision extracts every
              dish, routes Food GST vs. Liquor VAT, and detects Pre-Tax &amp; Post-Tax discounts
              automatically.
            </p>
          </div>

          {Capacitor.isNativePlatform() ? (
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleNativeCamera(CameraSource.Camera)}
                className="h-24 premium-gradient-card text-white rounded-2xl font-bold text-xs flex flex-col items-center justify-center gap-2 shadow-sm active:scale-95 transition-transform"
              >
                <CameraIcon size={24} />
                <span>Take Photo</span>
              </button>
              <button
                type="button"
                onClick={() => handleNativeCamera(CameraSource.Photos)}
                className="h-24 bg-page hover:bg-subtle text-main border border-border rounded-2xl font-bold text-xs flex flex-col items-center justify-center gap-2 shadow-2xs active:scale-95 transition-transform"
              >
                <ImageIcon size={24} className="text-primary" />
                <span>Pick from Gallery</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-14 premium-gradient-card text-white rounded-2xl font-extrabold text-sm flex items-center justify-center gap-2.5 shadow-sm active:scale-98 transition-transform"
            >
              <CameraIcon size={20} /> Snap or Upload Receipt Photo
            </button>
          )}
        </>
      )}
    </div>
  );
}
