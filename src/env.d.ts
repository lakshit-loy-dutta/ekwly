/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />
/// <reference types="vite-plugin-pwa/client" />
/// <reference types="vite-plugin-pwa/info" />

// 1. Strictly type your Supabase Environment Variables
interface ImportMetaEnv {
  readonly PUBLIC_SUPABASE_URL: string;
  readonly PUBLIC_SUPABASE_ANON_KEY: string;
  // Add any future env variables here (e.g., readonly PUBLIC_RAZORPAY_KEY: string;)
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// 2. Extend the Global Window Object for your custom scripts
interface Window {
  // From src/pages/index.astro (Dark mode toggle script)
  toggleTheme?: () => void;

  // From src/lib/pdf.ts (jsPDF CDN script injection)
  jspdf?: {
    jsPDF: any;
  };
}

// 3. (Optional) Declare modules for any files TS doesn't understand by default
declare module '*.png';
declare module '*.svg';
declare module '*.jpeg';
declare module '*.jpg';
