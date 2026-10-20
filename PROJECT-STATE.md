# Ekwly — Complete Project Handoff & State Ledger (`PROJECT-STATE.md`)

> **Last Updated:** October 20, 2026  
> **Current Version:** `v0.9.0` (Milestones 1–8 Complete: 2-Tab Workbench, 3-Layer Discount Engine, Host UPI QR, Bilateral Netting, Social Dining Network & Route Code-Splitting)  
> **Repository Visibility:** Private Proprietary Repository  
> **Core Constraint:** ₹0 Hosting & Operational Cost Architecture + 60Hz–240Hz Frame-Rate Budget (`<4.1ms/frame`)

---

## 1. Confirmed Technology Stack & Database State (`schema_dump.sql`)

- **Frontend Framework:** Astro 7 (`^7.3.8`, static output) + React 19 (`^19.3.0`, `React.lazy` route splitting) + TypeScript (`^7.0.2`).
- **Styling & Motion:** Tailwind CSS v4 (`^4.3.3` via `@tailwindcss/vite`, zero-specificity `:where()` form reset) + Framer Motion (`^13.5.1`) + Lucide React (`^1.56.0`).
- **Backend & Database (`schema_dump_3.sql` Verified):**
  - Tables: `sessions` (including `post_tax_discount_type`, `post_tax_discount_value`), `items` (including `apply_discount`, `discount_type`, `discount_value`), `members`, `claims`, `tax_presets`, `ledger`, `profiles`, `connections`, `venues`.
  - Views: `global_ledger`, `personal_analytics`.
  - Functions & Triggers: `harvest_venue_data()`, `protect_profile_billing_columns()`, `prune_stale_data()`, `search_venues()`, `search_venue_items()`, `verify_session_pin()`, `delete_user_account()`.
  - Indexes: All 14 B-Tree foreign-key/partial indexes and `pg_trgm` GIN indexes (`idx_venues_name_trgm`, `idx_profiles_name_trgm`, `idx_connections_unique_pair`) are live.
- **AI Vision OCR (`supabase/functions/scan-receipt/index.ts`):** `gemini-3.5-flash-lite` with Chain-of-Thought `reasoning` verification and 3-layer discount extraction (Item/Section, Selective Pre-Tax, Simultaneous Post-Tax).

---

## 2. Completed Milestones (Milestones 1–8)

- **Milestones 1–4:** Universal Tax Engine, Gemini CoT OCR, DB triggers & 14 indexes, `<BottomDock/>`, `<BrandLoader/>`, `<ConfirmSheet/>`, `<QrScannerModal/>` (lazy-loaded `html5-qrcode`), `Analytics.tsx`, `splitwiseCsv.ts`, and `configure-native.mjs`.
- **Milestone 5 (2-Tab Live Receipt Workbench):** `ReceiptWorkbench.tsx` + `WorkbenchRuleDrawers.tsx` replacing the legacy 6-step wizard (all 5 legacy wizard files deleted).
- **Milestone 6 (Instant Settlement, Host UPI QR & Bilateral Netting):** Zero-Friction Room Entry (`AppRouter.tsx`), Smart Cashier Default (`ActiveSession.tsx`), Host-Side Dynamic UPI QR Modal (`DebtMatrix.tsx`), and Bilateral Balance Netting (`Ledger.tsx`, `Home.tsx`, `utils.ts`).
- **Milestone 7 (Social Dining Network & Lazy WebSockets):** `Friends.tsx` 2.0 (live search, _"People You've Dined With"_, Saved Squads, Friendship Dining Dossiers) + Lazy Realtime WebSockets (`useSessionSync.ts`).
- **Milestone 8 (3-Layer Discount Engine & Architecture/UX Polish):**
  - Simultaneous **Item/Section Discounts** (`item.discountType`, `item.discountValue` + section multi-selector), **Selective Pre-Tax Restaurant Discounts** (`item.applyDiscount` toggle to exclude Alcohol/MRP), and **Post-Tax Coupon Discounts** (`postTaxDiscountType`, `postTaxDiscountValue`).
  - Centralized `mathEngine.calculateItemBreakdown` across UI, PDF, and engine.
  - Grouped batch claim `DELETE`s and memoized `actions` in `useSessionMutations.ts`.
  - Redesigned `Auth.tsx` and `Home.tsx`, extracted `WorkbenchRuleDrawers.tsx`, and added `React.lazy` code-splitting in `AppRouter.tsx`.

---

## 3. Next Steps Roadmap (Milestone 9: Production Deployment & Native Release)

1. **Deploy Updated `scan-receipt` Edge Function:** Push the updated `supabase/functions/scan-receipt/index.ts` to Supabase so live AI scans populate the new 3-layer discount fields.
2. **End-to-End Android APK & Web PWA Verification:** Build and test the signed/debug Android APK (`pnpm run build:apk`) on physical hardware (camera capture, ML Kit QR scan, UPI deep links, Web Share PDF).
