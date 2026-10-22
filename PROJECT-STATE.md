# Ekwly — Complete Project Handoff & State Ledger (`PROJECT-STATE.md`)

> **Last Updated:** October 22, 2026  
> **Current Version:** `v0.9.93` (Codebase Audit Complete: Maskable Safe-Zone App Icons, Unified `<BrandWordmark/>` in Navbar/Auth/Legal Headers, Escaped Template String Fixes & Full 3-Animation Brand Kit)  
> **Repository Visibility:** Private Proprietary Repository  
> **Core Constraint:** ₹0 Hosting & Operational Cost Architecture + 60Hz–240Hz Frame-Rate Budget (`<4.1ms/frame`)

---

## 1. Active Issue Tracker & Resolution Ledger

| Issue ID             | Screen / Component                                                  | Reported Symptom                                                                                                                                         | Root Cause                                                                                                                                                                                  | Status & Resolution (`v0.9.93`)                                                                                                                                                                   |
| :------------------- | :------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **BUG-01 to BUG-10** | Core Workbench, Ledger, PDF, Modals & Security                      | Session naming, sawtooth receipt edges, segmented quantity stepper, Service Charge auto-detect, portal modals, PDF download/share split, RLS lockdown.   | Resolved across `v0.9.6`–`v0.9.9`.                                                                                                                                                          | **FIXED & VERIFIED** in `repomix-output_2.xml`.                                                                                                                                                   |
| **BUG-11**           | `generate-brand-assets.mjs`, `astro.config.mjs`, Phone Home Screen  | Phone launcher cropped the top, bottom, and left spine of the `E=` app icon (`1000123979.jpg`).                                                          | Unscaled `E=` reached `57.3` units from `(50, 50)`, exceeding Android's `40`-unit circular maskable safe zone, and used `rx="24"` transparent corners.                                      | **FIXED (`v0.9.93`)** — Maskable app icons now use a full-bleed `rx="0"` canvas with `transform="translate(19, 19) scale(0.62)"` (`31.8`-unit radius from center).                                |
| **BUG-12**           | `AppRouter.tsx`, `Auth.tsx`, `LegalLayout.astro`, `BrandLoader.tsx` | Top navbar (`1000123978.png`) and Auth page still showed boxed `<BrandLogo/>` + plain `Ekwly` text; `BrandLoader.tsx` had `\${className}` escaped typos. | `AppRouter.tsx` and `Auth.tsx` had not yet been switched to `<BrandWordmark/>`; escaped template strings in `BrandLoader.tsx`, `Profile.tsx`, `DebtMatrix.tsx`, and `delete-account.astro`. | **FIXED (`v0.9.93`)** — Switched `AppRouter.tsx`, `Auth.tsx`, and `LegalLayout.astro` to `<BrandWordmark/>`, added `0.76x` padding to boxed `<BrandLogo/>`, and removed all `\${` / `\$` escapes. |
| **UX-04**            | `SpotlightTour.tsx`, `AnimatedNumber.tsx`                           | New users need an interactive guided tour and 240Hz rolling rupee counters.                                                                              | Scheduled for Milestone 11 Part 2.                                                                                                                                                          | **OPEN (Next Up in Milestone 11 Part 2)**.                                                                                                                                                        |

---

## 2. Next Steps Roadmap (Milestones 11 Part 2 – 14)

- [x] **Milestones 1–10 (`v0.1.0` – `v0.9.9`):** Completed & verified.
- [x] **Milestone 11 — Part 1 (`v0.9.93` — Brand Identity, Maskable Safe-Zone App Icons & Wordmark Integration):** Completed.
- [ ] **Milestone 11 — Part 2 (`v0.9.95` — Interactive `<SpotlightTour/>` & `<AnimatedNumber/>` Rolling Counters):**
  - Build the 4-step interactive onboarding `<SpotlightTour/>` for first-time users (with a `"Replay App Tour"` button in Account Settings).
  - Add `<AnimatedNumber/>` rolling rupee counters on the Member Bar and Grand Total footer.
- [ ] **Milestone 12 (`v1.0.0-rc1` — Ekwly Pro Expansion & Self-Serve Razorpay Checkout):**
  - Client-side `<canvas>` **WhatsApp Bento Receipt Card Generator** (shareable dark-mode receipt infographic with embedded Host UPI QR).
  - **Category Spend Audit (Food vs. Alcohol vs. Taxes)** in `Analytics.tsx`.
  - Self-serve `<ProUpgradeSheet/>` (`₹49` 7-Day Trip Pass, `₹99/mo`, `₹799/yr`) wired to Razorpay Checkout.
- [ ] **Milestone 13 (`v1.0.0` — Production Release Packaging & Google Play Store Launch Kit):**
  - Signed `.aab`/`.apk` release builder in `scripts/configure-native.mjs` and Play Store marketing copy.
- [ ] **Milestone 14 (`v1.1.0` — Post-1.0 Desktop Pro Split-Screen Workbench):**
  - Responsive 2-column desktop layout (`lg:grid-cols-12`) with keyboard shortcuts.
