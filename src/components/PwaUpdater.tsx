import { useRegisterSW } from 'virtual:pwa-register/react';
import { DownloadCloud, X } from 'lucide-react';

export default function PwaUpdater() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    // FIX: Explicitly type 'r' as ServiceWorkerRegistration | undefined
    onRegistered(r: ServiceWorkerRegistration | undefined) {
      if (r) {
        setInterval(
          () => {
            r.update();
          },
          60 * 60 * 1000
        );
      }
    },
    // FIX: Explicitly type 'error' as any or Error
    onRegisterError(error: Error | any) {
      console.error('SW registration error', error);
    },
  });

  if (!needRefresh) return null;

  return (
    // FIX: Replaced z-[9999] with z-9999 for Tailwind 4 canonical compliance
    <div className="fixed top-4 left-4 right-4 z-9999 bg-primary text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between animate-in slide-in-from-top-4">
      <div className="flex items-center gap-3">
        <div className="bg-white/20 p-2 rounded-full">
          <DownloadCloud size={20} />
        </div>
        <div className="flex flex-col">
          <span className="font-bold text-[0.95rem]">Update Available</span>
          <span className="text-xs text-white/80">A new version of Ekwly is ready.</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => updateServiceWorker(true)}
          className="bg-white text-primary px-4 py-2 rounded-xl font-bold text-sm shadow-sm active:scale-95 transition-transform"
        >
          Reload
        </button>
        <button
          onClick={() => setNeedRefresh(false)}
          className="p-2 text-white/70 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>
      </div>
    </div>
  );
}
