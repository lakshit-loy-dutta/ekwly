# Ekwly — Complete Project Handoff, Audit & State Ledger (`PROJECT-STATE.md`)

> **Last Updated:** October 23, 2026  
> **Current Version:** `v1.0.0-rc3` (Milestones 1–12.6 Complete: Zero-Flash Auth Promise Lock, 6-Slide Welcome & Free-First Tutorial Tour, Venue Rules Remount Guard, Spacious Font-Scale-Safe Workbench, App-Wide Glassmorphism, Pro Multi-Bill Trip Folders & Full DB/Code Audit Fixes)  
> **Repository Visibility:** Private Proprietary Repository  
> **Core Constraint:** ₹0 Hosting & Operational Cost Architecture + 60Hz–240Hz Frame-Rate Budget (`<4.1ms/frame`)

---

## 1. Executive Summary & Confirmed Technology Stack

- **Product Domain:** High-frame-rate (60Hz–240Hz), Solo-Host-First ("Designated Treasurer") and live multiplayer restaurant bill-splitting, Indian POS multi-bracket tax routing (Food GST 5%, Alcohol VAT 0%–25%, Aerated/Sin GST 28%, Tobacco GST 40%), 3-layer simultaneous discount allocation (Item/Section, Selective Pre-Tax, Post-Tax Coupon), social dining network, multi-bill trip folders, and instant UPI settlement engine.
- **Frontend Framework:** Astro 7 (`^7.3.8`, strictly static output) + React 19 (`^19.3.0`, `React.lazy` route splitting + `swrCache.ts` 0ms tab state cache + `createPortal` modals) + TypeScript (`^7.0.2`).
- **Styling & Motion:** Tailwind CSS v4 (`^4.3.3` via `@tailwindcss/vite`, `@layer base` form reset, 2-tier `.glass-chrome` & `.glass-card` system) + Framer Motion (`^13.5.1`, analytical spring physics) + Lucide React (`^1.56.0`).
- **Backend & Database:** Supabase (`@supabase/supabase-js` `^2.117.3`) — PostgreSQL, Granular Row Level Security (RLS), `security_invoker = true` views, `REPLICA IDENTITY FULL` Realtime WebSockets (`postgres_changes`), Auth (Google OAuth, Magic Link OTP, Anonymous Guest), and Deno Edge Functions.
- **AI Vision OCR:** `gemini-3.5-flash-lite` invoked via `supabase/functions/scan-receipt/index.ts` using strict JSON schema enforcement with a top-level `reasoning` Chain-of-Thought (CoT) math verification field and 3-layer discount extraction.
- **Monetization & Payments:** 3-Tier Ekwly Pro model (`₹49` 7-Day Trip Pass, `₹99/mo` Monthly, `₹799/yr` Annual) powered by `src/lib/razorpay.ts`, `<ProUpgradeSheet/>`, and `supabase/functions/razorpay-webhook/index.ts` (HMAC-SHA256 verified).
- **Native Mobile Wrapper:** Capacitor 8 (`@capacitor/core`, `@capacitor/android`, `@capacitor/ios` `^8.5.3`, `@capacitor/app` `^8.1.2`, `@capacitor/camera` `^8.2.5`, `@capacitor-mlkit/barcode-scanning` `^8.2.1`) with `cleartext: false` TLS enforcement.
- **Web Fallbacks & Utilities:** `@vite-pwa/astro` (`^1.2.0` Workbox Service Worker), `html5-qrcode` (`^2.3.8`, dynamically imported on web only), `react-qr-code` (`^2.2.0`), `jspdf` (`^4.2.1`) + `jspdf-autotable` (`^5.0.8`, dynamically imported on export).
- **Runtime, Testing & Tooling:** Node.js 24 (`.nvmrc`), `pnpm` v12+ (strictly enforced; never use `npm`/`yarn`), Vitest (`^5.0.4`, 14 unit tests across 3 suites), Repomix (`repomix.config.ts`).

---

## 2. Core Engineering & Financial Guardrails (`ARCHITECTURE.md`, `BRAND_IDENTITY.md`, `DESIGN_SYSTEM.md`, `AGENTS.md`)

1. **₹0 Hosting & Operational Cost Guardrails:**
   - **Static Web Output:** Astro build output remains strictly static (`output: 'static'`) for free static hosting (GitHub Pages / Cloudflare Pages / Vercel) and local Capacitor packaging.
   - **Zero Cloud Image Storage:** Receipt images are compressed client-side on an HTML5 `<canvas>` (`max 1400px`, `0.82` JPEG quality) in `MagicScanner.tsx`, sent as Base64 to the `scan-receipt` Edge Function, and discarded immediately after extraction (0 bytes stored in Supabase Storage).
   - **Zero Cloud Media Storage for Social, Trip & Bento Features:** Saved Squads (`ekwly_squads_<uid>`), Multi-Bill Trip Folders (`ekwly_trips_<uid>`), Friendship Dining Dossiers, and WhatsApp Bento Receipt Cards (`bentoReceipt.ts`) operate purely on relational metadata, `localStorage`, and client-side `<canvas>` rendering without media storage buckets.
   - **Batch Database Operations:** Never execute Supabase `.insert()`, `.upsert()`, or `.delete()` inside a `for...of` loop. Always use batch mutations (`addItemsBatchToDB`, `batchUpdateItemsInDB`, `addMembersBatchToDB`, `batchUpdateClaimsInDB`, `replaceTaxPresetsInDB`).
   - **Lazy Multiplayer WebSockets:** Realtime `postgres_changes` subscriptions remain dormant in Solo Mode and activate only when `Invite QR` is opened, `Solo Mode` is toggled to `Live Sync`, or >1 linked user joins the room.
   - **CI/CD Quota Protection:** `.github/workflows/build-native.yml` is strictly `on: workflow_dispatch` (manual trigger) so macOS/Linux cloud builds never drain private repo GitHub Actions minutes automatically.
2. **High-Refresh-Rate (60Hz / 90Hz / 120Hz / 144Hz / 240Hz) Rendering & Accessibility Rules:**
   - Animate **only** GPU-composited properties (`transform`, `opacity`, Framer Motion `layout="position"`). Never animate `height: 0 -> 'auto'` on list items.
   - Use **2-Tier Glassmorphism (`components.css`)**: `.glass-chrome` (`backdrop-filter: blur(20px)`) strictly on fixed viewport chrome (Sticky Header, 2-Tab Switcher, `<BottomDock/>`), and `.glass-card` (optical frosted gradient + specular inner highlight border with `0ms` blur cost) on scrolling Bento cards.
   - Use `min-h-10` / `min-h-12` flex-wrapping controls and full-width mobile input stacking (`col-span-12 sm:col-span-5`) so both large accessibility font scaling (`135%+`) and compact display scaling render cleanly without clipping.
   - Apply `tabular-nums` (`font-variant-numeric: tabular-nums`) to all currency amounts, quantities, fractions, percentages, and PINs, and use `<AnimatedNumber/>` for zero-re-render `requestAnimationFrame` rolling counters.
   - Never use `window.alert`, `window.confirm`, or `window.prompt`. Always use `<ConfirmSheet/>` and `showToast`.
3. **Free vs. Pro Tier Boundary:**
   - **Free Forever (₹0):** Unlimited rooms/items/splits, full Universal Tax & 3-Layer Discount Engine, crowd-sourced venue & menu autocomplete, 3 free AI Magic Scans/month (auto-resetting on UTC month rollover), Saved Squads, 1-Tap Squad Split Launcher, Friendship Dossiers, UPI deep links, Host UPI QR, WhatsApp Bento Receipt Cards, WhatsApp nudges, Splitwise CSV import, bilateral balance netting, and PDF export.
   - **Ekwly Pro (`₹49` 7-Day Trip Pass, `₹99/mo`, `₹799/yr`):** Unlimited AI Magic Scans, Multi-Bill Trip Folders & Consolidated Trip Settlement, full Personal Analytics Dashboard (`Category & Tax Audit`, `Top Dining Venues`, `Top Outstanding Debtors`), and 1-Tap CSV Expense Export.

---

## 3. Database Schema, RLS & Indexing Verification Ledger (`schema_dump_2.sql` + `20261022_db_audit_fixes.sql`)

1. **Tables & Columns:**
   - `public.sessions`: `id`, `status`, `pin`, `host_id`, `is_sc_applicable`, `service_charge_rate`, `sc_tax_preset_id`, `discount_type`, `discount_value`, `discount_mode`, `post_tax_discount_type`, `post_tax_discount_value`, `venue_name`, `created_at`, `name`.
   - `public.items` (`REPLICA IDENTITY FULL`): `id`, `session_id`, `name`, `qty`, `price`, `tax_preset_id`, `apply_sc`, `apply_discount`, `discount_type`, `discount_value`.
   - `public.members` (`REPLICA IDENTITY FULL`): `id`, `session_id`, `name`, `user_id`, `paid_amount`.
   - `public.claims` (`REPLICA IDENTITY FULL`): `session_id`, `item_id`, `member_id`, `value` (PK: `item_id, member_id`).
   - `public.tax_presets` (`REPLICA IDENTITY FULL`): `id`, `session_id`, `name`, `rate`, `split`.
   - `public.ledger`: `id`, `session_id`, `creditor_id`, `debtor_id`, `creditor_fallback_name`, `debtor_fallback_name`, `amount`, `settled`, `created_at`.
   - `public.profiles`: `id`, `name`, `avatar_url`, `upi_id`, `phone`, `email`, `ai_scans_used`, `pro_expires_at`, `last_scan_reset`, `created_at`, `updated_at`.
   - `public.connections`: `user_id`, `friend_id`, `created_at`.
   - `public.venues`: `id`, `name`, `normalized_name`, `service_charge_rate`, `tax_presets`, `times_used`, `last_updated_at`.
2. **Security Invoker Views (`security_invoker = true`, `anon` revoked):**
   - `public.global_ledger`: Aggregates unsettled `public.ledger` rows grouped by debtor and creditor with profile name joins.
   - `public.personal_analytics`: Unions settled debtor shares and host/payer net spend grouped by `user_id` and `venue_name`.
3. **Database Functions & Security Triggers (`SET search_path TO 'public'`):**
   - `public.enforce_session_lock_integrity()` (`SECURITY DEFINER`, `BEFORE INSERT OR UPDATE OR DELETE` on `items`, `claims`, `tax_presets`): Rejects mutations when `sessions.status = 'locked'`.
   - `public.harvest_venue_data()` (`SECURITY DEFINER`, `AFTER UPDATE ON public.sessions`): Harvests verified restaurant tax brackets and service charge rates when a session locks.
   - `public.protect_profile_billing_columns()` (`SECURITY DEFINER`, `BEFORE UPDATE ON public.profiles`): Blocks client-side tampering with `pro_expires_at` or `ai_scans_used`.
   - `public.prune_stale_data()` (`SECURITY DEFINER`): Cleans zero/empty claims, abandoned draft sessions (>30 days old), and stale anonymous guest accounts (>30 days old).
   - `public.search_venues(search_term)` & `public.search_venue_items(p_venue_name, p_search_term)`: Case-insensitive trigram similarity + `ILIKE` autocomplete RPCs.
   - `public.verify_session_pin(p_session_id, p_pin)` & `public.delete_user_account()`.
4. **16 Active B-Tree & GIN Indexes:**
   - `idx_claims_session_id`, `idx_connections_friend_id`, `idx_connections_unique_pair`, `idx_items_session_id`, `idx_items_tax_preset_id`, `idx_items_name_trgm` (GIN), `idx_ledger_creditor_unsettled`, `idx_ledger_debtor_unsettled`, `idx_ledger_session_id`, `idx_members_session_id`, `idx_members_user_id`, `idx_profiles_name_trgm` (GIN), `idx_sessions_host_id`, `idx_sessions_venue_name`, `idx_tax_presets_session_id`, `idx_venues_name_trgm` (GIN).

---

## 4. Complete Issue Tracker & Resolution Ledger (`v1.0.0-rc3`)

| Issue ID             | Screen / Component                                                                                             | Reported Symptom / Audit Finding                                                                                                                                                                                     | Root Cause                                                                                                                                                                     | Status & Resolution (`v1.0.0-rc3`)                                                                                                                                                                                  |
| :------------------- | :------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **BUG-01 to BUG-12** | Workbench, Ledger, PDF, Modals, Security & Maskable Icons                                                      | Session naming, sawtooth receipt edges, segmented quantity stepper, Service Charge auto-detect, portal modals, PDF download/share split, RLS lockdown, maskable safe-zone app icons, and `<BrandWordmark/>` headers. | Resolved across `v0.9.6`–`v0.9.95`.                                                                                                                                            | **FIXED & VERIFIED**.                                                                                                                                                                                               |
| **BUG-13 & BUG-13B** | `AppRouter.tsx`                                                                                                | `<Auth/>` login page flashed for a split second on startup when already logged in.                                                                                                                                   | Concurrent `getSession()` and `onAuthStateChange()` calls allowed the second call to set `isAuthChecking(false)` before the first call finished awaiting the `profiles` query. | **FIXED (`v1.0.0-rc3`)** — Synchronized both callers onto `routingPromiseRef` and added a strict `if (isAuthChecking                                                                                                |                                          | (user && currentView === 'auth'))` render guard. |
| **BUG-14**           | `AnimatedNumber.tsx`, Call Sites                                                                               | TypeScript error `ts(2322): Type 'string' is not assignable to type 'number'`.                                                                                                                                       | Quoted JSX props (`value="{grandTotal}"`).                                                                                                                                     | **FIXED (`v1.0.0-rc1`)** — Updated `AnimatedNumber` to accept `number                                                                                                                                               | string` and unquoted all JSX call sites. |
| **BUG-15**           | `ReceiptWorkbench.tsx`                                                                                         | Community Venue Rules popup re-opened when leaving the screen and coming back even after rules were loaded.                                                                                                          | `loadedVenueBadge` reset to `null` on remount, re-triggering `search_venues` on `sessionRules.venueName`.                                                                      | **FIXED (`v1.0.0-rc3`)** — Added `isVenueEditedByUserRef` so autocomplete only opens on active user typing, and initialized `loadedVenueBadge` from `sessionRules.venueName`.                                       |
| **ENG-01 to ENG-08** | `useSessionSync.ts`, `useSessionMutations.ts`, `mathEngine.ts`, `MagicScanner.tsx`, `Home.tsx`, `package.json` | New-room `.single()` race, duplicated `preTaxMultiplier`, redundant `auth.getUser()` calls, legacy `mailto:` modals, sequential tax loop, `.gpu-layer` on list cards, and `package.json` metadata.                   | Identified in Senior Software Engineering Audit.                                                                                                                               | **FIXED (`v1.0.0-rc2` / `rc3`)** — Switched to `.maybeSingle()`, `auth.getSession()`, parallel room creation, centralized `computePreTaxMultiplier`, and `<ProUpgradeSheet/>`.                                      |
| **UX-05 to UX-13**   | `Payments.tsx`, `DebtMatrix.tsx`, `SpotlightTour.tsx`, `ReceiptWorkbench.tsx`, `Home.tsx`, `components.css`    | Legacy `Payments.tsx` strip UI, Bento button margin, 6-slide Welcome + Free-first Tutorial + Pro Bonus tour, spacious font-scale-safe session controls, 2-tier glassmorphism, and upgraded Home Command Center.      | Identified in UI/UX Audit & User Testing.                                                                                                                                      | **FIXED (`v1.0.0-rc2` / `rc3`)** — Redesigned `Payments.tsx` with `[+ Fill ₹...]` pills, built 6-slide `<SpotlightTour/>`, added `.glass-card`/`.glass-chrome`, and overhauled `Home.tsx` & `ReceiptWorkbench.tsx`. |
| **DB-01 to DB-06**   | `20261022_db_audit_fixes.sql`                                                                                  | Profile RLS, `security_invoker` views, `REPLICA IDENTITY FULL` on child tables, `search_path` lock, item GIN index, and stale guest pruning.                                                                         | Identified in Senior Database Audit.                                                                                                                                           | **FIXED (`v1.0.0-rc2`)** — Migration script delivered and verified.                                                                                                                                                 |

---

## 5. Remaining Master Roadmap to `v1.0.0` Store Launch & Post-1.0 Desktop

- [x] **Milestones 1–12.6 (`v0.1.0` – `v1.0.0-rc3`):** Complete.
- [ ] **Milestone 13 (`v1.0.0` — Production Release Packaging & Google Play Store Launch Kit):**
  - Upgrade `scripts/configure-native.mjs` to support signed Android App Bundles (`bundleRelease` `.aab`) and signed Release APKs (`assembleRelease`).
  - Deliver the complete **Google Play Store Launch & Marketing Kit** (Store Listing Copy, Data Safety Questionnaire Answers, and 5-Frame Screenshot Guide).
- [ ] **Milestone 14 (`v1.1.0` — Post-1.0 Desktop Pro Split-Screen Workbench):**
  - Responsive 2-column desktop layout (`max-w-6xl lg:grid-cols-12`) with keyboard shortcuts.
