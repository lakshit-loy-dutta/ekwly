import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import react from '@astrojs/react';
import AstroPWA from '@vite-pwa/astro';

export default defineConfig({
  // 1. GitHub Pages Subpath Deployment Settings
  site: 'https://lakshit-loy-dutta.github.io',
  base: '/ekwly',

  vite: {
    plugins: [tailwindcss()],
    ssr: {
      noExternal: ['workbox-window'],
    },
  },

  integrations: [
    react(),
    sitemap(),

    // 2. Automated PWA Generation
    AstroPWA({
      registerType: 'prompt',
      injectRegister: 'script', // Automatically injects SW registration into HTML head
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
        ignoreURLParametersMatching: [/.*/], // Safely ignores all query parameters
        navigateFallbackDenylist: [/^\/rest\//, /^\/realtime\//, /supabase\.co/],
      },
      manifest: {
        name: 'Ekwly Settlement Engine',
        short_name: 'Ekwly',
        description: 'Real-time collaborative bill calculator and settlement engine.',
        theme_color: '#0f172a',
        background_color: '#0b0f19',
        display: 'standalone',
        start_url: '/ekwly/',
        id: '/ekwly/',
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
