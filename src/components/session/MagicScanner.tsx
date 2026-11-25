import { useState, useRef } from 'react';
import { Camera, MediaTypeSelection } from '@capacitor/camera';
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

interface ScannedTaxPresetPayload {
  tempId?: string;
  name?: string;
  rate?: number;
  split?: boolean;
}

interface ScannedItemPayload {
  name?: string;
  qty?: number;
  price?: number;
  unitPrice?: number;
  taxPresetId?: string;
  taxRatePct?: number;
  applySC?: boolean;
  applyDiscount?: boolean;
  discountType?: string;
  discountValue?: number;
}

interface ScannedReceiptResponse {
  error?: string;
  venueName?: string;
  matchedVenue?: { id: string; name: string } | null;
  verification?: {
    printedGrandTotal: number | null;
    computedGrandTotal: number;
    delta: number;
    matchedPrintedTotal: boolean;
    autoSolvedScTopology: boolean;
  };
  sessionRules?: {
    isScApplicable?: boolean;
    serviceChargeRate?: number;
    scTaxPresetId?: string;
    discountType?: 'none' | 'percentage' | 'flat';
    discountValue?: string;
    discountMode?: 'pre-tax' | 'post-tax';
    postTaxDiscountType?: 'none' | 'percentage' | 'flat';
    postTaxDiscountValue?: string;
  };
  newTaxPresets?: ScannedTaxPresetPayload[];
  items?: ScannedItemPayload[];
}

export default function MagicScanner({ onScanComplete }: Props) {
  const { isHost, taxPresets, sessionRules, currentUserId, actions } = useSessionContext();
  const [isScanning, setIsScanning] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isHost) return null;

  /**
   * Preserves crisp horizontal character detail on tall/narrow Indian thermal receipts:
   * - Constrains the SHORT edge up to 1400px (preventing width crushing to ~400px).
   * - Allows tall vertical bills up to 3000px.
   * - Normalizes contrast in grayscale so faint thermal print reads accurately.
   */
  const compressImageToBase64 = (fileOrBlob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const objectUrl = URL.createObjectURL(fileOrBlob);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const canvas = document.createElement('canvas');
        const MAX_SHORT_EDGE = 1400;
        const MAX_LONG_EDGE = 3000;

        let width = img.width;
        let height = img.height;
        const shortEdge = Math.min(width, height);
        const longEdge = Math.max(width, height);

        let scale = 1;
        if (shortEdge > MAX_SHORT_EDGE) {
          scale = Math.min(scale, MAX_SHORT_EDGE / shortEdge);
        }
        if (longEdge * scale > MAX_LONG_EDGE) {
          scale = MAX_LONG_EDGE / longEdge;
        }

        width = Math.max(1, Math.round(width * scale));
        height = Math.max(1, Math.round(height * scale));

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas context unavailable'));

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        if ('filter' in ctx) {
          ctx.filter = 'grayscale(1) contrast(1.14)';
        }
        ctx.drawImage(img, 0, 0, width, height);

        let dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        let base64Clean = dataUrl.split(',')[1] || '';

        if (base64Clean.length > 3_800_000) {
          dataUrl = canvas.toDataURL('image/jpeg', 0.82);
          base64Clean = dataUrl.split(',')[1] || '';
        }

        resolve(base64Clean);
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Failed to decode receipt image'));
      };
      img.src = objectUrl;
    });
  };

  const processBase64Receipt = async (imageBase64: string) => {
    setIsScanning(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token || session.user?.is_anonymous) {
        showToast('Sign in with Google or Email to use AI Magic Scan.', 'error');
        setIsScanning(false);
        return;
      }
      if (session.user?.email) setUserEmail(session.user.email);

      const { data, error } = await supabase.functions.invoke<ScannedReceiptResponse>(
        'scan-receipt',
        {
          body: {
            imageBase64,
            mimeType: 'image/jpeg',
            currentRules: sessionRules,
            currentTaxes: taxPresets,
          },
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (error) {
        const status = (error as { context?: { status?: number } })?.context?.status;
        let serverErrorMsg = error.message || '';
        try {
          const resp = (error as { context?: Response })?.context;
          if (resp && typeof resp.json === 'function') {
            const errBody = (await resp.json()) as { error?: string };
            if (errBody?.error) serverErrorMsg = errBody.error;
          }
        } catch {
          // Ignore non-JSON error body
        }

        if (
          status === 402 ||
          serverErrorMsg.includes('RATE_LIMIT_REACHED') ||
          serverErrorMsg.includes('QUOTA_EXCEEDED')
        ) {
          setShowPaywall(true);
          setIsScanning(false);
          return;
        }
        throw new Error(serverErrorMsg || 'Failed to scan receipt.');
      }

      if (data?.error) {
        if (
          String(data.error).includes('RATE_LIMIT_REACHED') ||
          String(data.error).includes('QUOTA_EXCEEDED')
        ) {
          setShowPaywall(true);
          setIsScanning(false);
          return;
        }
        throw new Error(String(data.error));
      }

      if (!data || !Array.isArray(data.items) || data.items.length === 0) {
        throw new Error('Could not read items from this image. Try a clearer photo.');
      }

      // 1. Add ONLY new tax brackets without deleting existing ones
      const allPresets: TaxPreset[] = [...taxPresets];
      const onlyNewPresets: TaxPreset[] = [];
      const tempIdToRealId = new Map<string, string>();

      if (Array.isArray(data.newTaxPresets)) {
        for (const tp of data.newTaxPresets) {
          const rateNum = Number(tp.rate);
          const shouldSplit = tp.split !== false;
          const existing = allPresets.find(
            (p) => Math.abs(p.rate - rateNum) < 0.15 && Boolean(p.split) === shouldSplit
          );
          if (existing) {
            if (tp.tempId) tempIdToRealId.set(tp.tempId, existing.id);
          } else if (Number.isFinite(rateNum) && rateNum >= 0) {
            const newRealId = utils.generateId();
            if (tp.tempId) tempIdToRealId.set(tp.tempId, newRealId);
            const created: TaxPreset = {
              id: newRealId,
              name: tp.name?.trim() || `Tax ${rateNum}%`,
              rate: rateNum,
              split: tp.split !== false,
            };
            allPresets.push(created);
            onlyNewPresets.push(created);
          }
        }
      }

      if (onlyNewPresets.length > 0) {
        await actions.addTaxPresetsBatchToDB(onlyNewPresets);
      }

      // 2. Apply extracted sessionRules & detected Venue Name
      const rules = data.sessionRules || {};
      const scRateRaw = Number(rules.serviceChargeRate ?? 0);
      const normScRate = scRateRaw >= 0.5 ? scRateRaw / 100 : scRateRaw;
      const isScOn =
        rules.isScApplicable !== undefined ? Boolean(rules.isScApplicable) : normScRate > 0;

      let resolvedScTaxPresetId = rules.scTaxPresetId || 'inherit';
      if (tempIdToRealId.has(resolvedScTaxPresetId)) {
        resolvedScTaxPresetId = tempIdToRealId.get(resolvedScTaxPresetId)!;
      } else if (
        resolvedScTaxPresetId !== 'inherit' &&
        resolvedScTaxPresetId !== 'none' &&
        !allPresets.some((p) => p.id === resolvedScTaxPresetId)
      ) {
        const foodPreset = allPresets.find((t) => Math.abs(t.rate - 5) < 0.5) || allPresets[0];
        resolvedScTaxPresetId = foodPreset ? foodPreset.id : 'inherit';
      }

      const resolvedVenueName = data.matchedVenue?.name || data.venueName;

      await actions.updateSessionRulesInDB({
        ...(!sessionRules.venueName && resolvedVenueName ? { venueName: resolvedVenueName } : {}),
        isScApplicable: isScOn,
        serviceChargeRate: isScOn ? normScRate : 0,
        scTaxPresetId: isScOn ? resolvedScTaxPresetId : 'none',
        ...(rules.discountType && rules.discountType !== 'none'
          ? {
              discountType: rules.discountType,
              discountValue: String(rules.discountValue || ''),
              discountMode: rules.discountMode || 'pre-tax',
            }
          : {}),
        ...(rules.postTaxDiscountType && rules.postTaxDiscountType !== 'none'
          ? {
              postTaxDiscountType: rules.postTaxDiscountType,
              postTaxDiscountValue: String(rules.postTaxDiscountValue || ''),
            }
          : {}),
      });

      // 3. Map & batch-insert all extracted line items
      const mappedItems: BillItem[] = data.items.map((raw) => {
        const qty = Math.max(0.01, Number(raw.qty) || 1);
        const unitPrice = Math.max(0, Number(raw.price ?? raw.unitPrice ?? 0));
        const rawPresetId = String(raw.taxPresetId || '');
        const mappedPresetId = tempIdToRealId.get(rawPresetId) || rawPresetId;
        const matchedPreset =
          allPresets.find((p) => p.id === mappedPresetId) ||
          (raw.taxRatePct !== undefined
            ? allPresets.find((p) => Math.abs(p.rate - Number(raw.taxRatePct)) < 0.5)
            : undefined) ||
          allPresets[0];

        return {
          id: utils.generateId(),
          name: String(raw.name || 'Item').trim(),
          qty,
          unitPrice,
          taxRate: matchedPreset ? matchedPreset.rate / 100 : 0,
          taxPresetId: matchedPreset ? matchedPreset.id : '',
          applySC: raw.applySC !== false,
          applyDiscount: raw.applyDiscount !== false,
          discountType:
            raw.discountType === 'percentage' || raw.discountType === 'flat'
              ? raw.discountType
              : 'none',
          discountValue: Number(raw.discountValue || 0),
          totalBase: utils.round2(qty * unitPrice),
        };
      });

      if (mappedItems.length > 0) {
        await actions.addItemsBatchToDB(mappedItems);
      }

      utils.haptic('heavy');
      const v = data.verification;
      if (v && v.printedGrandTotal !== null && !v.matchedPrintedTotal) {
        showToast(
          `Extracted ${mappedItems.length} items (Bill ₹${v.printedGrandTotal} vs ₹${v.computedGrandTotal} — verify smudged lines).`,
          'default'
        );
      } else {
        const venueSuffix = resolvedVenueName ? ` from ${resolvedVenueName}` : '';
        showToast(
          `Verified ${mappedItems.length} items${venueSuffix} to the exact rupee!`,
          'success'
        );
      }

      if (onScanComplete) onScanComplete();
    } catch (err) {
      console.error('Magic Scan error:', err);
      const message =
        err instanceof Error ? err.message : 'Failed to scan receipt. Please try again.';
      showToast(message, 'error');
    } finally {
      setIsScanning(false);
    }
  };

  const handleNativeCamera = async (mode: 'camera' | 'gallery') => {
    try {
      let webPath: string | undefined;
      if (mode === 'camera') {
        const photo = await Camera.takePhoto({ quality: 92 });
        webPath = photo.webPath;
      } else {
        const { results } = await Camera.chooseFromGallery({
          mediaType: MediaTypeSelection.Photo,
          allowMultipleSelection: false,
          quality: 92,
        });
        webPath = results?.[0]?.webPath;
      }
      if (!webPath) return;
      const response = await fetch(webPath);
      const blob = await response.blob();
      const base64 = await compressImageToBase64(blob);
      await processBase64Receipt(base64);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('cancelled')) return;
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
          <BrandLoader state="scan" label="AI Auditing Receipt & Math..." />
          <p className="text-xs text-muted text-center max-w-xs mt-1">
            Cross-checking dish prices, CGST/SGST, Alcohol VAT, Service Charge &amp; Grand Total...
          </p>
        </div>
      ) : (
        <>
          <div className="bg-primary/8 border border-primary/20 rounded-2xl p-4 flex items-start gap-3">
            <Sparkles size={20} className="text-primary shrink-0 mt-0.5" />
            <p className="text-xs text-muted leading-relaxed">
              Take a clear photo of your restaurant bill. Ekwly&apos;s AI Vision extracts every
              dish, routes Food GST vs. Liquor VAT, auto-verifies Service Charge math, and detects
              discounts automatically.
            </p>
          </div>
          {Capacitor.isNativePlatform() ? (
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleNativeCamera('camera')}
                className="h-24 premium-gradient-card text-white rounded-2xl font-bold text-xs flex flex-col items-center justify-center gap-2 shadow-sm active:scale-95 transition-transform"
              >
                <CameraIcon size={24} />
                <span>Take Photo</span>
              </button>
              <button
                type="button"
                onClick={() => handleNativeCamera('gallery')}
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
