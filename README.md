# Ekwly (Private Repository)

> **Proprietary & Confidential — Internal Engineering Repository**  
> **Real-time collaborative bill calculator, Indian POS tax router, social dining network & UPI settlement engine.**

Ekwly is an offline-capable, 240Hz-ready Progressive Web Application (PWA) and native Android/iOS application designed to eliminate the friction of splitting complex restaurant bills in India. Optimized for both the **Solo Host ("Designated Treasurer")** and **Live Multiplayer Tables**, it natively models multi-bracket Indian taxation (Food GST, Alcohol VAT, Tobacco GST), cascading vs. independent service charges, pre/post-tax discounts, and fractional consumption.

---

## Core Architecture & Features

- **Solo-Host-First Live Workbench:** Populate table members in 1 tap from your Friends list or Saved Squads, tap avatars directly on dish cards to assign shares down the receipt, and tweak Service Charge, Discounts, and Tax brackets with live Grand Total feedback.
- **Universal Indian Tax Engine (`src/lib/mathEngine.ts`):** Supports **Model A (Cascading S.C.)** where item tax applies to `(Base + Service Charge)` and **Model B (Independent S.C.)** where Service Charge is taxed under a global bracket or left untaxed, with automatic CGST/SGST splitting and Paisa Conservation.
- **AI Magic Scan (`supabase/functions/scan-receipt`):** Client-side `<canvas>` compressed receipt OCR powered by `gemini-3.5-flash-lite` with Chain-of-Thought (CoT) mathematical verification and single-shot batch DB insertion.
- **Crowd-Sourced Venue Flywheel:** Automatically harvests verified restaurant tax brackets and service charge rates when rooms lock (`harvest_venue_data` trigger), enabling 0-cost venue & menu autocomplete.
- **Instant UPI, Host QR & WhatsApp Settlement:** Generates 1-tap `upi://pay` deep links, Host-screen dynamic UPI QR codes, 1-tap WhatsApp payment nudges, Splitwise CSV migration imports, and native PDF sharing.

---

## Tech Stack

- **Frontend:** Astro 7 (Static Output) + React 19 + TypeScript
- **Styling & Motion:** Tailwind CSS v4 + Framer Motion (Spring Physics)
- **Backend & Database:** Supabase (PostgreSQL + RLS + Realtime + Deno Edge Functions)
- **Native Mobile Runtime:** Capacitor 8 (Android `.apk` & iOS `.ipa`)

---

## Local Development Setup (`pnpm` Only)

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Environment Variables

Create a `.env` file in the root directory:

```env
PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Development & Unit Testing

```bash
# Start local dev server
pnpm dev

# Run Vitest unit suite (Tax Engine, Paisa Conservation, Splitwise CSV, Utilities)
pnpm test
```

### 4. Production Web & Native Mobile Builds

```bash
# Build static web bundle
pnpm build

# Build & sync native mobile bundle + auto-configure JDK 21, Android SDK, Manifest & Info.plist
pnpm run build:mobile

# Compile Android Debug APK directly via Gradle on Windows/Linux/macOS
pnpm run build:apk

# Pack repository context for AI code review
pnpm run pack
```

### Note on Private Repository Hosting (₹0 Cost)

Because this repository is **Private**:

- **Static Web Hosting:** If using GitHub Free (where GitHub Pages requires a public repo), connect this private repository to **Cloudflare Pages** or **Vercel (Hobby)** for ₹0/month unlimited static hosting, or use GitHub Pages with a GitHub Pro / Student Developer Pack account.
- **GitHub Actions Quota:** `.github/workflows/build-native.yml` is intentionally configured as `workflow_dispatch` (manual trigger) so macOS/Linux cloud builds never consume private repo Actions minutes unless explicitly triggered.

_© 2026 Lakshit Loy Dutta. All Rights Reserved._
