import { useEffect, useState, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { DownloadCloud, Loader2, X } from 'lucide-react';
import { showToast } from '../lib/utils';

const OTA_MANIFEST_URL = 'https://lakshit-loy-dutta.github.io/ekwly/version.json';
const OTA_STORAGE_KEY = 'ekwly_ota_installed_sha';

function UpdateBanner({
  isApplying,
  onApply,
  onDismiss,
}: {
  isApplying: boolean;
  onApply: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      style={{ top: 'calc(1rem + var(--safe-top, 0px))' }}
      className="fixed left-4 right-4 z-9999 bg-primary text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between animate-in slide-in-from-top-4"
    >
      <div className="flex items-center gap-3">
        <div className="bg-white/20 p-2 rounded-full">
          {isApplying ? (
            <Loader2 size={20} className="animate-spin" />
          ) : (
            <DownloadCloud size={20} />
          )}
        </div>
        <div className="flex flex-col">
          <span className="font-bold text-[0.95rem]">
            {isApplying ? 'Installing Update...' : 'Update Available'}
          </span>
          <span className="text-xs text-white/80">
            {isApplying ? 'Applying new Ekwly bundle...' : 'A new version of Ekwly is ready.'}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={isApplying}
          onClick={onApply}
          className="bg-white text-primary px-4 py-2 rounded-xl font-bold text-sm shadow-sm active:scale-95 transition-transform disabled:opacity-60"
        >
          {isApplying ? 'Updating' : 'Reload'}
        </button>
        {!isApplying && (
          <button
            type="button"
            onClick={onDismiss}
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

function WebSwUpdater() {
  const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null);

  const {
    needRefresh: [needSwRefresh, setNeedSwRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r: ServiceWorkerRegistration | undefined) {
      if (r) {
        r.update();
        setSwRegistration(r);
      }
    },
    onRegisterError(error: unknown) {
      console.error('SW registration error', error);
    },
  });

  useEffect(() => {
    if (!swRegistration) return;
    const intervalId = window.setInterval(() => swRegistration.update(), 60 * 60 * 1000);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') swRegistration.update();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [swRegistration]);

  if (!needSwRefresh) return null;

  return (
    <UpdateBanner
      isApplying={false}
      onApply={() => updateServiceWorker(true)}
      onDismiss={() => setNeedSwRefresh(false)}
    />
  );
}

function NativeOtaUpdater() {
  const [pendingOta, setPendingOta] = useState<{ version: string; bundleUrl: string } | null>(null);
  const [isApplyingOta, setIsApplyingOta] = useState(false);

  const checkNativeOtaUpdate = useCallback(async () => {
    if (typeof window === 'undefined' || !navigator.onLine) return;
    try {
      const res = await fetch(`${OTA_MANIFEST_URL}?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return;
      const manifest = (await res.json()) as {
        version?: string;
        bundleUrl?: string;
        target?: string;
      };
      // Refuse any OTA bundle not explicitly built for Capacitor root '/'
      if (!manifest?.version || !manifest?.bundleUrl || manifest.target !== 'capacitor') return;

      const baselineVersion =
        localStorage.getItem(OTA_STORAGE_KEY) ||
        (typeof __APP_BUILD_SHA__ !== 'undefined' && __APP_BUILD_SHA__ !== 'dev'
          ? __APP_BUILD_SHA__
          : null);

      if (!baselineVersion) {
        localStorage.setItem(OTA_STORAGE_KEY, manifest.version);
        return;
      }

      if (baselineVersion !== manifest.version) {
        setPendingOta({ version: manifest.version, bundleUrl: manifest.bundleUrl });
      }
    } catch {
      // Ignore offline/network errors silently
    }
  }, []);

  useEffect(() => {
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
  }, [checkNativeOtaUpdate]);

  const handleApplyOta = async () => {
    if (!pendingOta) return;
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
  };

  if (!pendingOta) return null;

  return (
    <UpdateBanner
      isApplying={isApplyingOta}
      onApply={handleApplyOta}
      onDismiss={() => setPendingOta(null)}
    />
  );
}

export default function PwaUpdater() {
  return Capacitor.isNativePlatform() ? <NativeOtaUpdater /> : <WebSwUpdater />;
}
