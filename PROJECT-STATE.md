# Ekwly — Complete Project Handoff, Audit & State Ledger (`PROJECT-STATE.md`)

> **Last Updated:** October 22, 2026  
> **Current Version:** `v1.0.0-rc1` (Milestones 1–12 Complete; Full Senior Engineering, UI/UX & Database Audit Logged for Milestone 12.5)  
> **Repository Visibility:** Private Proprietary Repository  
> **Core Constraint:** ₹0 Hosting & Operational Cost Architecture + 60Hz–240Hz Frame-Rate Budget (`<4.1ms/frame`)

---

## 1. Executive Summary & Confirmed Technology Stack

- **Product Domain:** High-frame-rate (60Hz–240Hz), Solo-Host-First ("Designated Treasurer") and live multiplayer restaurant bill-splitting, Indian POS multi-bracket tax routing (Food GST 5%, Alcohol VAT 0%–25%, Aerated/Sin GST 28%, Tobacco GST 40%), 3-layer simultaneous discount allocation (Item/Section, Selective Pre-Tax, Post-Tax Coupon), social dining network, and instant UPI settlement engine.
- **Frontend Framework:** Astro 7 (`^7.3.8`, strictly static output) + React 19 (`^19.3.0`, `React.lazy` route splitting + `swrCache.ts` 0ms tab state cache + `createPortal` modals) + TypeScript (`^7.0.2`).
- **Styling & Motion:** Tailwind CSS v4 (`^4.3.3` via `@tailwindcss/vite`, `@layer base` form reset) + Framer Motion (`^13.5.1`, analytical spring physics) + Lucide React (`^1.56.0`).
- **Backend & Database:** Supabase (`@supabase/supabase-js` `^2.117.3`) — PostgreSQL, Granular Row Level Security (RLS), Lazy Realtime WebSockets (`postgres_changes`), Auth (Google OAuth, Magic Link OTP, Anonymous Guest), and Deno Edge Functions.
- **AI Vision OCR:** `gemini-3.5-flash-lite` invoked via `supabase/functions/scan-receipt/index.ts` using strict JSON schema enforcement with a top-level `reasoning` Chain-of-Thought (CoT) math verification field and 3-layer discount extraction.
- **Monetization & Payments:** 3-Tier Ekwly Pro model (`₹49` 7-Day Trip Pass, `₹99/mo` Monthly, `₹799/yr` Annual) powered by `src/lib/razorpay.ts`, `<ProUpgradeSheet/>`, and `supabase/functions/razorpay-webhook/index.ts` (HMAC-SHA256 verified).
- **Native Mobile Wrapper:** Capacitor 8 (`@capacitor/core`, `@capacitor/android`, `@capacitor/ios` `^8.5.3`, `@capacitor/app` `^8.1.2`, `@capacitor/camera` `^8.2.5`, `@capacitor-mlkit/barcode-scanning` `^8.2.1`) with `cleartext: false` TLS enforcement.
- **Web Fallbacks & Utilities:** `@vite-pwa/astro` (`^1.2.0` Workbox Service Worker), `html5-qrcode` (`^2.3.8`, dynamically imported on web only), `react-qr-code` (`^2.2.0`), `jspdf` (`^4.2.1`) + `jspdf-autotable` (`^5.0.8`, dynamically imported on export).
- **Runtime, Testing & Tooling:** Node.js 24 (`.nvmrc`), `pnpm` v12+ (strictly enforced; never use `npm`/`yarn`), Vitest (`^5.0.4`, 14 unit tests across 3 suites), Repomix (`repomix.config.ts`).

---

## 2. Completed Milestones Ledger (Milestones 1–12)

- **Milestones 1–4 (`v0.1.0` – `v0.4.0`):** Universal Indian Tax Engine (`mathEngine.ts`), Gemini 3.5 Flash-Lite CoT OCR (`scan-receipt`), DB triggers (`harvest_venue_data`, `protect_profile_billing_columns`, `prune_stale_data`), 14 B-Tree/GIN indexes, `<BottomDock/>`, `<BrandLoader/>`, `<ConfirmSheet/>`, `<QrScannerModal/>`, `Analytics.tsx`, `splitwiseCsv.ts`, and `scripts/configure-native.mjs`.
- **Milestone 5 (`v0.5.0`):** Replaced the legacy 6-step linear wizard with the 2-Tab Live Receipt Workbench (`ReceiptWorkbench.tsx`, `WorkbenchRuleDrawers.tsx`, `ActiveSession.tsx`) and deleted all 5 legacy wizard step files.
- **Milestone 6 (`v0.6.0`):** Zero-Friction Room Entry (`AppRouter.tsx`), Smart Cashier Default (`ActiveSession.tsx`), Host-Side Dynamic UPI QR Modal (`DebtMatrix.tsx`), and Bilateral Balance Netting (`Ledger.tsx`, `Home.tsx`, `utils.ts`).
- **Milestone 7 (`v0.7.0`):** Social Dining Network (`Friends.tsx` 2.0: live trigram user search, _"People You've Dined With"_ co-diner discovery, Saved Squads, Friendship Dining Dossiers) and Lazy Multiplayer WebSockets (`useSessionSync.ts`).
- **Milestone 8 (`v0.8.0`):** 3-Layer Simultaneous Discount Engine (Item/Category offers + Selective Pre-Tax Restaurant Discounts with per-item Alcohol/MRP exclusions + Simultaneous Post-Tax Coupons), `React.lazy` route code-splitting, and `Auth.tsx` / `Home.tsx` UX overhaul.
- **Milestone 9 – 9.8 (`v0.9.8`):** 0ms `swrCache.ts` across all 5 `<BottomDock/>` tabs, React Portal `<BottomSheet/>`, Quota-Aware AI Magic Scan Hero, Inline Community Venue Autocomplete Tray, Flush Segmented Quantity Stepper, Auto-Detect Service Charge Solver, and 32-Tooth SVG Sawtooth `★ LIVE BILL SPLIT ★` Receipt.
- **Milestone 10 (`v0.9.9`):** Cybersecurity RLS Lockdown (`20261021_security_rls_lockdown.sql`), Locked-Bill Immutability Trigger (`enforce_session_lock_integrity`), `cleartext: false` TLS enforcement, Verified UPI Shields, and Razorpay/Play Store Legal Compliance Pages (`terms.astro`, `refunds.astro`, `privacy.astro`, `delete-account.astro`).
- **Milestone 11 (`v0.9.95`):** Locked v3 Equilibrium Monolith `<BrandLogo/>`, Unified Single-SVG `<BrandWordmark/>` (`354 × 114`), 3-Mode `<BrandLoader/>` (`lockin`, `equalizer`, `scan`), `scripts/generate-brand-assets.mjs` (0.62x maskable safe-zone app icons + binary multi-size `.ico` packer), Zero-Flash Auth Boot Guard, 4-Step Interactive `<SpotlightTour/>`, 240Hz `<AnimatedNumber/>` Rolling Counters, and Live Offline Indicator Pill.
- **Milestone 12 (`v1.0.0-rc1`):** Client-side `<canvas>` **WhatsApp Bento Receipt Card Generator** (`src/lib/bentoReceipt.ts`) with embedded scannable UPI QR, **Category Spend & Tax Audit (Food vs. Liquor vs. Taxes) + CSV Export** in `Analytics.tsx`, and Self-Serve 3-Tier `<ProUpgradeSheet/>` (`src/lib/razorpay.ts`).

---

## 3. Comprehensive Code Review & Technical Debt Tracker (Milestone 12.5 Backlog)

### 3.1 Software Engineering & Performance Items (`ENG-01` to `ENG-08`)

| Issue ID   | Severity   | Location                                                           | Description                                                                                                                                                                                      | Planned Fix in Milestone 12.5                                                                                                             |
| :--------- | :--------- | :----------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------- |
| **ENG-01** | **HIGH**   | `ActiveSession.tsx`, `useSessionSync.ts`, `useSessionMutations.ts` | New room creation triggers a race between `fetchSessionData` (`.single()` throwing `PGRST116` on not-yet-created session) and `createSessionInDB` (which executes 7 sequential `await` queries). | Use `.maybeSingle()` in `useSessionSync.ts` and batch `createSessionInDB` into a single parallel flow / RPC using cached `currentUserId`. |
| **ENG-02** | **MEDIUM** | `mathEngine.ts`, `ReceiptWorkbench.tsx`, `pdf.ts`                  | `preTaxMultiplier` calculation loop is duplicated in 3 files.                                                                                                                                    | Centralize into `mathEngine.computePreTaxMultiplier(items, preTaxDiscountAmount)`.                                                        |
| **ENG-03** | **MEDIUM** | `useSessionSync.ts`, `useSessionMutations.ts`                      | `supabase.auth.getUser()` is called 3–4 times per session load, making redundant network round-trips to `/auth/v1/user`.                                                                         | Replace with `supabase.auth.getSession()` (0ms local read) or pass `currentUserId` directly.                                              |
| **ENG-04** | **MEDIUM** | `ReceiptWorkbench.tsx` (L1185–1232), `MagicScanner.tsx` (L274–325) | Both files still contain ~100 lines of legacy hardcoded `mailto:` upsell modals instead of `<ProUpgradeSheet/>`.                                                                                 | Replace both legacy modals with `<ProUpgradeSheet/>`.                                                                                     |
| **ENG-05** | **MEDIUM** | `MagicScanner.tsx` (L125–137)                                      | AI-extracted `newTaxPresets` are inserted sequentially inside a `for...of` loop.                                                                                                                 | Batch-insert all `newTaxPresets` in a single `.insert(payloads)` call.                                                                    |
| **ENG-06** | **LOW**    | `Home.tsx` (L298)                                                  | Repeating session cards in `recentSessions.map()` still have `.gpu-layer` (`will-change: transform, opacity`).                                                                                   | Remove `.gpu-layer` from repeating list cards to save mobile GPU texture memory.                                                          |
| **ENG-07** | **LOW**    | `ReceiptWorkbench.tsx` (1,354 lines)                               | Large single component file re-renders receipt items on form input keystrokes.                                                                                                                   | Extract memoized sub-components (`<ThermalReceiptView/>`, `<TableMembersSheet/>`).                                                        |
| **ENG-08** | **LOW**    | `package.json`, `index.astro`                                      | `package.json` has `"name": "temp-astro-app"`, `"version": "0.0.1"`; `index.astro` has `theme-color: #0f172a`.                                                                                   | Set `"name": "ekwly"`, `"version": "1.0.0"`, and `theme-color: #050914`.                                                                  |

### 3.2 UI/UX Design & Consistency Items (`UX-05` to `UX-09`)

| Issue ID  | Severity   | Location                                       | Description                                                                                                                                      | Planned Fix in Milestone 12.5                                                                              |
| :-------- | :--------- | :--------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------- |
| **UX-05** | **HIGH**   | `src/components/session/Payments.tsx`          | Multi-payer drawer uses legacy v0.1 full-bleed `bg-primary` header, `border-y` strips, forbidden `pl-9!` class, and requires manual subtraction. | Redesign into Bento cards with 1-tap **`[+ Fill Remaining ₹...]`** pills next to each member.              |
| **UX-06** | **HIGH**   | `src/components/session/DebtMatrix.tsx` (L322) | `Share WhatsApp Bento Receipt Card` button sits outside `px-4`, touching left/right screen bezels, and is missing in Draft state.                | Move inside `px-4` container and enable in both Draft and Locked states.                                   |
| **UX-07** | **MEDIUM** | `src/pages/delete-account.astro`               | Uses standalone layout without `<BrandWordmark/>` or Light/Dark theme sync.                                                                      | Align header with `LegalLayout.astro` (`[E=]kwly` SVG wordmark + theme sync).                              |
| **UX-08** | **MEDIUM** | `src/components/session/MagicScanner.tsx`      | Shows a tiny `<Loader2/>` icon while scanning instead of `<BrandLoader state="scan"/>`.                                                          | Render `<BrandLoader label="AI Reading Receipt & Routing Taxes..." state="scan"/>` during active OCR scan. |
| **UX-09** | **LOW**    | `src/lib/utils.ts` (`showToast`)               | Uses neon `#00D924` instead of brand emerald `#10B981` and ignores `env(safe-area-inset-bottom)`.                                                | Update toast palette to `#10B981` and safe-area bottom offset.                                             |

### 3.3 Database Security & Supabase Free-Tier Efficiency Items (`DB-01` to `DB-06`)

| Issue ID  | Severity     | Database Object (`schema_dump_2.sql`)                      | Description                                                                                                                                                                                                | Planned Fix in Milestone 12.5 (`20261022_db_audit_fixes.sql`)                                                       |
| :-------- | :----------- | :--------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------ |
| **DB-01** | **CRITICAL** | `public.profiles` RLS Policy (`Public Basic Profile Read`) | `SELECT USING (true)` allows unauthenticated `anon` scrapers to read `email`, `phone`, and `upi_id` of all users.                                                                                          | Require `auth.uid() IS NOT NULL` on `profiles` and restrict `email`/`phone` exposure via a public profile RPC/view. |
| **DB-02** | **CRITICAL** | `public.global_ledger` & `public.personal_analytics` Views | Views lack `security_invoker = true`, executing as owner `postgres` and bypassing RLS on `ledger`, `sessions`, and `members`.                                                                              | Set `ALTER VIEW ... SET (security_invoker = true)` and `REVOKE ALL ... FROM anon` on both views.                    |
| **DB-03** | **HIGH**     | `items`, `members`, `claims`, `tax_presets` Realtime       | Default `REPLICA IDENTITY DEFAULT` omits `session_id` on `DELETE` WAL events, causing filtered Realtime `DELETE` subscriptions (`session_id=eq.X`) to drop events.                                         | Set `REPLICA IDENTITY FULL` on `items`, `members`, `claims`, and `tax_presets`.                                     |
| **DB-04** | **MEDIUM**   | 7 `SECURITY DEFINER` Functions                             | Missing `SET search_path TO 'public'` on `delete_user_account`, `handle_new_user`, `protect_profile_billing_columns`, `prune_stale_data`, `search_venue_items`, `search_venues`, and `verify_session_pin`. | Add `SET search_path TO 'public'` to all 7 functions.                                                               |
| **DB-05** | **MEDIUM**   | `public.items(name)` & `public.items(tax_preset_id)`       | `search_venue_items` lacks a trigram GIN index on `items.name` and uses case-sensitive `s.venue_name = p_venue_name`; `items.tax_preset_id` lacks an FK B-Tree index.                                      | Add `idx_items_name_trgm` (GIN), `idx_items_tax_preset_id` (B-Tree), and case-insensitive venue matching.           |
| **DB-06** | **LOW**      | `public.prune_stale_data()`                                | Does not prune abandoned anonymous `auth.users` (>30 days old with 0 sessions/debts).                                                                                                                      | Extend `prune_stale_data()` to purge stale anonymous guest accounts to protect the 500MB Free Tier limit.           |

---

## 4. Master Roadmap to `v1.0.0` Production & Post-1.0 Desktop

- [x] **Milestones 1–12 (`v0.1.0` – `v1.0.0-rc1`):** Complete.
- [ ] **Milestone 12.5 (`v1.0.0-rc2` — Next Up: Code Audit & Database Hardening Sweep):**
  - Execute `supabase/migrations/20261022_db_audit_fixes.sql` (`DB-01` to `DB-06`).
  - Resolve `ENG-01` to `ENG-08` and `UX-05` to `UX-09` (`Payments.tsx` Bento redesign, `DebtMatrix.tsx` margin fix, `MagicScanner.tsx` `<BrandLoader state="scan"/>` & `<ProUpgradeSheet/>` unification, `mathEngine.computePreTaxMultiplier` DRY refactor, `package.json` v1.0.0 metadata).
- [ ] **Milestone 13 (`v1.0.0` — Production Release Packaging & Google Play Store Launch Kit):**
  - Add Android Release `.aab` (App Bundle) and keystore signing support to `scripts/configure-native.mjs`.
  - Finalize Google Play Store listing copy, Data Safety questionnaire answers, and 5-frame screenshot kit.
- [ ] **Milestone 14 (`v1.1.0` — Post-1.0 Desktop Pro Split-Screen Workbench):**
  - Responsive 2-column desktop/tablet layout (`max-w-6xl lg:grid-cols-12` on `lg:` screens) where the Left Pane holds the Item & Member Workbench and the Right Sticky Pane displays the Live Thermal Receipt and Settlement Matrix simultaneously with keyboard shortcuts.
