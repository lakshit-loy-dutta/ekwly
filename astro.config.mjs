import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import react from '@astrojs/react';
import AstroPWA from '@vite-pwa/astro';

const isCapacitor = process.env.CAPACITOR_BUILD === 'true';
const basePath = isCapacitor ? '/' : '/ekwly';
const startPath = isCapacitor ? '/' : '/ekwly/';

export default defineConfig({
  site: 'https://lakshit-loy-dutta.github.io',
  base: basePath,

  vite: {
    plugins: [tailwindcss()],
    ssr: {
      noExternal: ['workbox-window'],
    },
  },

  integrations: [
    react(),
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
        theme_color: '#0f172a',
        background_color: '#0b0f19',
        display: 'standalone',
        start_url: startPath,
        id: startPath,
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
});
