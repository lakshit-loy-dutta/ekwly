import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { showToast } from '../lib/utils';

interface Props {
  onStartNew: () => void;
  onJoinSession: (sessionId: string) => void;
}

export default function Home({ onStartNew, onJoinSession }: Props) {
  const startScan = async () => {
    try {
      const { camera } = await BarcodeScanner.requestPermissions();
      if (camera !== 'granted') {
        showToast('Camera permission denied', 'error');
        return;
      }

      const { barcodes } = await BarcodeScanner.scan();

      if (barcodes.length > 0) {
        const scannedUrl = barcodes[0].displayValue;
        let sessionId = null;
        try {
          const url = new URL(scannedUrl);
          sessionId = url.searchParams.get('s');
        } catch {
          sessionId = scannedUrl.includes('?s=')
            ? scannedUrl.split('?s=')[1]
            : scannedUrl.split('/').pop();
        }

        if (sessionId) {
          onJoinSession(sessionId);
        } else {
          showToast('Invalid Ekwly QR Code', 'error');
        }
      }
    } catch (error) {
      console.error(error);
      showToast('Error launching scanner', 'error');
    }
  };

  return (
    <div className="w-full flex flex-col flex-1 px-6 justify-center items-center py-8">
      {/* Centered Logo & Text */}
      <div className="flex flex-col items-center justify-center mb-10 mt-auto">
        <img
          src="/ekwly/icon.svg"
          width="80"
          height="80"
          alt="Ekwly Logo"
          className="rounded-2xl shadow-sm mb-5"
        />
        <h2 className="text-3xl font-bold tracking-tight text-main mb-2">Ekwly</h2>
        <p className="text-muted text-center text-sm max-w-xs">
          Create a new bill session or scan a QR code to join your table.
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col gap-4 w-full max-w-sm mb-auto">
        <button
          type="button"
          onClick={onStartNew}
          className="w-full h-16 bg-primary active:bg-primary-hover text-white rounded-2xl shadow-stripe flex flex-col items-center justify-center transition-colors"
        >
          <span className="font-semibold text-lg">Create New Session</span>
          <span className="text-primary-light text-xs font-medium uppercase tracking-wider">
            Host
          </span>
        </button>

        <button
          type="button"
          onClick={startScan}
          className="w-full h-16 bg-surface active:bg-subtle text-main border-2 border-border rounded-2xl shadow-sm flex flex-col items-center justify-center transition-colors"
        >
          <span className="font-semibold text-lg">Scan to Join</span>
          <span className="text-muted text-xs font-medium uppercase tracking-wider">
            Participant
          </span>
        </button>
      </div>
    </div>
  );
}
