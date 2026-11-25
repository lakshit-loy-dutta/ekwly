import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import react from '@astrojs/react';
import AstroPWA from '@vite-pwa/astro';

const isCapacitor = process.env.CAPACITOR_BUILD === 'true';
const basePath = isCapacitor ? '/' : '/ekwly';
const startPath = isCapacitor ? '/' : '/ekwly/';
const appBuildSha = process.env.GITHUB_SHA || process.env.APP_BUILD_SHA || 'dev';

/**
 * When building for Capacitor (CAPACITOR_BUILD=true), AstroPWA is omitted so zero Service Worker
 * or Workbox files ship inside native WebViews (preventing cache conflicts with @capgo/capacitor-updater).
 * This tiny Vite plugin stubs the two virtual PWA imports so index.astro and PwaUpdater.tsx compile cleanly.
 */
function capacitorPwaStubPlugin() {
  const virtualIds = {
    'virtual:pwa-info': '\0virtual:pwa-info',
    'virtual:pwa-register/react': '\0virtual:pwa-register/react',
  };
  return {
    name: 'ekwly-capacitor-pwa-stub',
    resolveId(id) {
      return virtualIds[id] || null;
    },
    load(id) {
      if (id === '\0virtual:pwa-info') {
        return 'export const pwaInfo = null;';
      }
      if (id === '\0virtual:pwa-register/react') {
        return 'export function useRegisterSW() { return { needRefresh: [false, () => {}], offlineReady: [false, () => {}], updateServiceWorker: async () => {} }; }';
      }
      return null;
    },
  };
}

export default defineConfig({
  site: 'https://lakshit-loy-dutta.github.io',
  base: basePath,
  vite: {
    define: {
      __APP_BUILD_SHA__: JSON.stringify(appBuildSha),
    },
    plugins: [tailwindcss(), ...(isCapacitor ? [capacitorPwaStubPlugin()] : [])],
    build: {
      chunkSizeWarningLimit: 650,
    },
    ssr: {
      noExternal: ['workbox-window'],
    },
  },
  integrations: [
    react(),
    ...(!isCapacitor
      ? [
          sitemap(),
          AstroPWA({
            registerType: 'prompt',
            injectRegister: 'auto',
            workbox: {
              globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
              ignoreURLParametersMatching: [/.*/],
              navigateFallbackDenylist: [/^\/rest\//, /^\/realtime\//, /supabase\.co/],
            },
            manifest: {
              name: 'Ekwly Settlement Engine',
              short_name: 'Ekwly',
              description: 'Real-time collaborative bill calculator and settlement engine.',
              theme_color: '#050914',
              background_color: '#050914',
              display: 'standalone',
              start_url: startPath,
              id: startPath,
              icons: [
                {
                  src: 'icon-192.png?v=3',
                  sizes: '192x192',
                  type: 'image/png',
                  purpose: 'any',
                },
                {
                  src: 'icon-192.png?v=3',
                  sizes: '192x192',
                  type: 'image/png',
                  purpose: 'maskable',
                },
                {
                  src: 'icon-512.png?v=3',
                  sizes: '512x512',
                  type: 'image/png',
                  purpose: 'any',
                },
                {
                  src: 'icon-512.png?v=3',
                  sizes: '512x512',
                  type: 'image/png',
                  purpose: 'maskable',
                },
              ],
            },
          }),
        ]
      : []),
  ],
});
