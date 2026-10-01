# Ekwly

**Real-time collaborative bill calculator & settlement engine.**

Ekwly is an offline-capable, mobile-first Progressive Web Application (PWA) designed to eliminate the friction of splitting complex bills at restaurants. It natively handles uneven tax distributions (like Alcohol VAT vs. Food GST), global service charges, proportional discounts, and fractional consumption (e.g., sharing 1/3 of a pizza) across a synchronized real-time multiplayer table.

## Features

- **Real-Time Multiplayer:** Powered by Supabase WebSockets, multiple people can scan a QR code, join a session, and actively edit/claim items simultaneously with instant UI updates.
- **Identity & Ledger (Phase 3):** Seamless anonymous onboarding with progressive enhancement to full Google OAuth/Magic Link accounts, paving the way for persistent debt tracking.
- **Complex Math Engine:** Effortlessly splits disparate tax rates (CGST/SGST), proportional percentage discounts (pre/post-tax), and global service charges across only the people who consumed the items.
- **PWA & Offline Resilience:** Fully installable as a standalone app via Workbox Service Workers, complete with `manifest.webmanifest`, splash screens, and edge-to-edge iOS/Android native UI styling.
- **Native Camera Integrations:** Uses Capacitor MLKit for high-performance, native QR barcode scanning directly within the web view.
- **PDF Export Engine:** Generates highly detailed, formatted PDF settlement receipts directly in the browser using `jsPDF`.

## Tech Stack

- **Framework:** [Astro 5](https://astro.build/) & [React 19](https://react.dev/)
- **Backend/DB:** [Supabase](https://supabase.com/) (PostgreSQL + Realtime + Auth)
- **Styling & UI:** [Tailwind CSS v4](https://tailwindcss.com/) & [Framer Motion](https://www.framer.com/motion/)
- **Native Wrap:** [Capacitor 6](https://capacitorjs.com/)
- **Offline Cache:** `@vite-pwa/astro` (Workbox)

## Getting Started

### 1. Installation

Clone the repository and install the dependencies using `pnpm`:

```bash
git clone [https://github.com/lakshit-loy-dutta/ekwly.git](https://github.com/lakshit-loy-dutta/ekwly.git)
cd ekwly
pnpm install
```

### 2. Environment Variables

Create a `.env` file in the root directory and add your Supabase credentials:

```env
PUBLIC_SUPABASE_URL=[https://your-project-id.supabase.co](https://your-project-id.supabase.co)
PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Local Development

Start the Astro development server.
Note: Because the app is configured for GitHub Pages subpath deployment (/ekwly/), ensure you access it via the correct URL root.

```bash
pnpm run dev
# Open http://localhost:4321/ekwly/
```

### 4. Build for Production

To generate the static HTML and Service Worker for deployment:

```bash
pnpm run build
```

_~ Built by Lakshit Loy Dutta_
