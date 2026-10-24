import { useEffect, useState, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { DownloadCloud, Loader2, X } from 'lucide-react';
import { showToast } from '../lib/utils';

const OTA_MANIFEST_URL = 'https://lakshit-loy-dutta.github.io/ekwly/version.json';
const OTA_STORAGE_KEY = 'ekwly_ota_installed_sha';

export default function PwaUpdater() {
  const isNative = Capacitor.isNativePlatform();

  // --- 1. WEB PWA SERVICE WORKER UPDATER ---
  const {
    needRefresh: [needSwRefresh, setNeedSwRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r: ServiceWorkerRegistration | undefined) {
      if (!r || isNative) return;
      r.update();
      setInterval(() => r.update(), 60 * 60 * 1000);

      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') r.update();
        });
      }
    },
    onRegisterError(error: Error | any) {
      console.error('SW registration error', error);
    },
  });

  // --- 2. NATIVE APK SELF-HOSTED OTA UPDATER (OPTION B) ---
  const [pendingOta, setPendingOta] = useState<{ version: string; bundleUrl: string } | null>(null);
  const [isApplyingOta, setIsApplyingOta] = useState(false);

  const checkNativeOtaUpdate = useCallback(async () => {
    if (!isNative || typeof window === 'undefined' || !navigator.onLine) return;
    try {
      const res = await fetch(`${OTA_MANIFEST_URL}?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return;
      const manifest = await res.json();
      if (!manifest?.version || !manifest?.bundleUrl) return;

      const installedSha = localStorage.getItem(OTA_STORAGE_KEY);
      if (!installedSha) {
        // First run of this APK install: record baseline version
        localStorage.setItem(OTA_STORAGE_KEY, manifest.version);
        return;
      }

      if (installedSha !== manifest.version) {
        setPendingOta({ version: manifest.version, bundleUrl: manifest.bundleUrl });
      }
    } catch {
      // Ignore offline/network errors silently
    }
  }, [isNative]);

  useEffect(() => {
    if (!isNative) return;
    import('@capgo/capacitor-updater')
      .then(({ CapacitorUpdater }) => {
        CapacitorUpdater.notifyAppReady();
      })
      .catch(() => {});

    checkNativeOtaUpdate();

    const onVisibility = () => {
      if (document.visibilityState === 'visible') checkNativeOtaUpdate();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [isNative, checkNativeOtaUpdate]);

  const handleApplyUpdate = async () => {
    if (isNative && pendingOta) {
      setIsApplyingOta(true);
      try {
        const { CapacitorUpdater } = await import('@capgo/capacitor-updater');
        const bundle = await CapacitorUpdater.download({
          url: pendingOta.bundleUrl,
          version: pendingOta.version,
        });
        localStorage.setItem(OTA_STORAGE_KEY, pendingOta.version);
        await CapacitorUpdater.set(bundle);
      } catch (err) {
        console.error('OTA update error:', err);
        showToast('Could not download update. Please check your connection.', 'error');
        setIsApplyingOta(false);
      }
      return;
    }

    updateServiceWorker(true);
  };

  const showBanner = isNative ? Boolean(pendingOta) : needSwRefresh;
  if (!showBanner) return null;

  return (
    <div
      style={{ top: 'calc(1rem + var(--safe-top, 0px))' }}
      className="fixed left-4 right-4 z-9999 bg-primary text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between animate-in slide-in-from-top-4"
    >
      <div className="flex items-center gap-3">
        <div className="bg-white/20 p-2 rounded-full">
          {isApplyingOta ? (
            <Loader2 size={20} className="animate-spin" />
          ) : (
            <DownloadCloud size={20} />
          )}
        </div>
        <div className="flex flex-col">
          <span className="font-bold text-[0.95rem]">
            {isApplyingOta ? 'Installing Update...' : 'Update Available'}
          </span>
          <span className="text-xs text-white/80">
            {isApplyingOta ? 'Applying new Ekwly bundle...' : 'A new version of Ekwly is ready.'}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={isApplyingOta}
          onClick={handleApplyUpdate}
          className="bg-white text-primary px-4 py-2 rounded-xl font-bold text-sm shadow-sm active:scale-95 transition-transform disabled:opacity-60"
        >
          {isApplyingOta ? 'Updating' : 'Reload'}
        </button>
        {!isApplyingOta && (
          <button
            type="button"
            onClick={() => {
              if (isNative) setPendingOta(null);
              else setNeedSwRefresh(false);
            }}
            className="p-2 text-white/70 hover:text-white transition-colors"
            aria-label="Dismiss update banner"
          >
            <X size={20} />
          </button>
        )}
      </div>
    </div>
  );
}
