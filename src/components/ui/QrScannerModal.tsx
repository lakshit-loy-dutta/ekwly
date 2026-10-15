import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { Html5Qrcode } from 'html5-qrcode';
import { X } from 'lucide-react';
import { showToast } from '../../lib/utils';

interface Props {
  isOpen: boolean;
  title?: string;
  onClose: () => void;
  onScanSuccess: (decodedText: string) => void;
}

export default function QrScannerModal({
  isOpen,
  title = 'Scan QR Code',
  onClose,
  onScanSuccess,
}: Props) {
  const qrRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;

    const runNativeScan = async () => {
      try {
        const { camera } = await BarcodeScanner.requestPermissions();
        if (camera !== 'granted') {
          showToast('Camera permission denied.', 'error');
          onClose();
          return;
        }
        const { barcodes } = await BarcodeScanner.scan();
        if (isMounted) {
          onClose();
          if (barcodes.length > 0 && barcodes[0].displayValue) {
            onScanSuccess(barcodes[0].displayValue);
          }
        }
      } catch (err) {
        if (isMounted) {
          onClose();
          showToast('Scanner closed or unavailable.', 'default');
        }
      }
    };

    const runWebScan = async () => {
      try {
        const scanner = new Html5Qrcode('ekwly-qr-reader');
        qrRef.current = scanner;
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            stopWebScanner().then(() => {
              onClose();
              onScanSuccess(decodedText);
            });
          },
          () => {}
        );
      } catch (err) {
        if (isMounted) {
          showToast('Camera permission denied or unavailable.', 'error');
          onClose();
        }
      }
    };

    if (Capacitor.isNativePlatform()) {
      runNativeScan();
    } else {
      const timer = setTimeout(runWebScan, 100);
      return () => {
        isMounted = false;
        clearTimeout(timer);
        stopWebScanner();
      };
    }

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  const stopWebScanner = async () => {
    try {
      if (qrRef.current?.isScanning) {
        await qrRef.current.stop();
        qrRef.current.clear();
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (!isOpen || Capacitor.isNativePlatform()) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-6">
      <button
        onClick={() => {
          stopWebScanner();
          onClose();
        }}
        className="absolute top-12 right-6 z-50 p-3 bg-white/20 rounded-full text-white backdrop-blur-md transition-colors active:bg-white/40"
      >
        <X size={24} />
      </button>
      <h2 className="text-white text-xl font-bold mb-8 text-center">{title}</h2>
      <div
        id="ekwly-qr-reader"
        className="w-full max-w-sm rounded-3xl overflow-hidden border-2 border-primary bg-black shadow-[0_0_40px_rgba(0,128,255,0.3)]"
      ></div>
      <p className="text-white/60 mt-8 text-sm font-medium text-center">
        Align the QR code within the frame.
      </p>
    </div>
  );
}
