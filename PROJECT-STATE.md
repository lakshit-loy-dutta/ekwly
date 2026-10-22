# Ekwly — Complete Project Handoff & State Ledger (`PROJECT-STATE.md`)

> **Last Updated:** October 22, 2026  
> **Current Version:** `v0.9.95` (Milestone 11 Complete: Zero-Flash Auth Boot Guard, Interactive 4-Step `<SpotlightTour/>`, 240Hz `<AnimatedNumber/>` Rolling Counters, Live Offline Pill, Maskable Safe-Zone Icons & Unified `<BrandWordmark/>`)  
> **Repository Visibility:** Private Proprietary Repository  
> **Core Constraint:** ₹0 Hosting & Operational Cost Architecture + 60Hz–240Hz Frame-Rate Budget (`<4.1ms/frame`)

---

## 1. Active Issue Tracker & Resolution Ledger

| Issue ID             | Screen / Component                                                  | Reported Symptom                                                                                                                                       | Root Cause                                                                                                                                         | Status & Resolution (`v0.9.95`)                                                                                                                                                            |
| :------------------- | :------------------------------------------------------------------ | :----------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **BUG-01 to BUG-10** | Core Workbench, Ledger, PDF, Modals & Security                      | Session naming, sawtooth receipt edges, segmented quantity stepper, Service Charge auto-detect, portal modals, PDF download/share split, RLS lockdown. | Resolved across `v0.9.6`–`v0.9.9`.                                                                                                                 | **FIXED & VERIFIED**.                                                                                                                                                                      |
| **BUG-11**           | `generate-brand-assets.mjs`, `astro.config.mjs`, Phone Home Screen  | Phone launcher cropped the top, bottom, and left spine of the `E=` app icon (`1000123979.jpg`); Android WebAPK cached old icon bitmap.                 | Unscaled `E=` exceeded Android's `40`-unit circular maskable safe zone; WebAPK requires cache-busted icon URLs or reinstall for immediate refresh. | **FIXED (`v0.9.95`)** — Maskable app icons use full-bleed `rx="0"` with `0.62x` safe-zone scaling (`31.8`-unit radius from center) and `?v=3` manifest cache-busting.                      |
| **BUG-12**           | `AppRouter.tsx`, `Auth.tsx`, `LegalLayout.astro`, `BrandLoader.tsx` | Top navbar (`1000123978.png`) and Auth page showed boxed `<BrandLogo/>` + plain `Ekwly` text; escaped `\${className}` typos.                           | `AppRouter.tsx` and `Auth.tsx` needed `<BrandWordmark/>` integration.                                                                              | **FIXED (`v0.9.93`)** — Deployed `<BrandWordmark/>` across all headers and fixed all escaped template strings.                                                                             |
| **BUG-13**           | `AppRouter.tsx`                                                     | Opening the app flashed the `<Auth/>` login screen for ~1 second even when the user was already signed in, before jumping to `<Home/>`.                | `currentView` initialized to `'auth'` while `supabase.auth.getSession()` resolved asynchronously.                                                  | **FIXED (`v0.9.95`)** — Added `isAuthChecking` boot guard that renders `<BrandLoader fullScreen label="Starting Ekwly..." state="lockin"/>` until session verification finishes.           |
| **UX-04**            | `SpotlightTour.tsx`, `AnimatedNumber.tsx`, `AppRouter.tsx`          | Needed interactive first-time user tour, 240Hz rolling rupee counters, and live offline status badge.                                                  | Scheduled for Milestone 11 Part 2.                                                                                                                 | **FIXED (`v0.9.95`)** — Built 4-step `<SpotlightTour/>` (with Replay button in Account Settings), `<AnimatedNumber/>` (`requestAnimationFrame` DOM counter), and live Offline header pill. |

---

## 2. Next Steps Roadmap (Milestones 12–14)

- [x] **Milestones 1–10 (`v0.1.0` – `v0.9.9`):** Completed & verified.
- [x] **Milestone 11 (`v0.9.95` — Brand Identity, Maskable Icons, Zero-Flash Auth Boot Guard, `<SpotlightTour/>` & `<AnimatedNumber/>`):** Completed.
- [ ] **Milestone 12 (`v1.0.0-rc1` — Ekwly Pro Expansion & Self-Serve Razorpay Checkout):**
  - Client-side `<canvas>` **WhatsApp Bento Receipt Card Generator** (shareable dark-mode receipt infographic with embedded Host UPI QR).
  - **Category Spend Audit (Food vs. Alcohol vs. Taxes)** in `Analytics.tsx`.
  - Self-serve `<ProUpgradeSheet/>` (`₹49` 7-Day Trip Pass, `₹99/mo`, `₹799/yr`) wired to Razorpay Checkout.
- [ ] **Milestone 13 (`v1.0.0` — Production Release Packaging & Google Play Store Launch Kit):**
  - Signed `.aab`/`.apk` release builder in `scripts/configure-native.mjs` and Play Store marketing copy.
- [ ] **Milestone 14 (`v1.1.0` — Post-1.0 Desktop Pro Split-Screen Workbench):**
  - Responsive 2-column desktop layout (`lg:grid-cols-12`) with keyboard shortcuts.
