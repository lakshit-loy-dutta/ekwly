# Ekwly

**Real-time collaborative bill calculator, Indian POS tax router & UPI settlement engine.**

Ekwly is an offline-capable, mobile-first Progressive Web Application (PWA) and native Android/iOS app designed to eliminate the friction of splitting complex restaurant bills in India. It natively handles uneven tax distributions (Food GST vs. Alcohol VAT vs. Tobacco GST), cascading vs. independent service charges, pre/post-tax discounts, and fractional consumption (e.g., sharing `1/3` of a pitcher) across a synchronized real-time multiplayer table.

## Key Features

- **Universal Indian Tax Engine:** Supports both **Model A (Cascading S.C.)** where item tax applies to `(Base + Service Charge)` and **Model B (Independent S.C.)** where Service Charge is taxed under its own global bracket, complete with CGST/SGST splitting and automatic POS round-off reconciliation.
- **AI Magic Scan (Gemini 3.5 Flash-Lite):** Client-side compressed receipt OCR with Chain-of-Thought (CoT) mathematical self-verification that checks extracted item taxes against printed receipt totals before batch-inserting items.
- **Crowd-Sourced Venue & Menu Autocomplete:** Automatically harvests verified restaurant tax brackets and service charge rates when rooms are locked, giving free-tier users instant 1-tap venue configuration and dish price autocomplete.
- **Real-Time Multiplayer & Offline Queue:** Powered by Supabase Realtime WebSockets and a Promise-locked local mutation queue that caches claims offline and syncs automatically upon reconnection.
- **Instant UPI & WhatsApp Settlement:** Generates 1-tap `upi://pay` deep links pre-filled with the exact split amount, 1-tap WhatsApp payment nudges, Splitwise CSV migration imports, and multi-page PDF receipts.

## Tech Stack

- **Framework:** [Astro 7](https://astro.build/) & [React 19](https://react.dev/)
- **Backend & Database:** [Supabase](https://supabase.com/) (PostgreSQL + Realtime + Auth + Deno Edge Functions)
- **Styling & Motion:** [Tailwind CSS v4](https://tailwindcss.com/) & [Framer Motion](https://www.framer.com/motion/)
- **Native Runtime:** [Capacitor 8](https://capacitorjs.com/) (Android & iOS)
- **Offline Cache:** `@vite-pwa/astro` (Workbox Service Workers)

## Getting Started

### 1. Installation

Clone the repository and install dependencies using `pnpm`:

```bash
git clone https://github.com/lakshit-loy-dutta/ekwly.git
cd ekwly
pnpm install
```

### 2. Environment Variables

Create a `.env` file in the root directory and add your Supabase credentials:

```env
PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Local Development & Testing

```bash
# Start the Astro dev server (http://localhost:4321/ekwly/)
pnpm dev

# Run the Vitest unit test suite (Math Engine, Splitwise CSV & Utilities)
pnpm test
```

### 4. Production Web & Native Mobile Builds

```bash
# Build static PWA for GitHub Pages (/ekwly base path)
pnpm build

# Build for Capacitor Android/iOS (/ root path) + sync + auto-patch native manifests
pnpm run build:mobile

# Open native IDEs
pnpm run cap:android
pnpm run cap:ios

# Pack repository context for AI code review
pnpm run pack
```

_~ Built by Lakshit Loy Dutta_
