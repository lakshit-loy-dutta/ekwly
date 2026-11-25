# Ekwly — Master Codebase & Security Audit Findings (`AUD-01` – `AUD-33`)

> **Last Verified:** November 25, 2026 (Stages 0, 1 & 2 Completed & Verified Against Live Pack)

## P0 — Critical Security, Billing, OCR & App-Breaking Defects

- [x] **AUD-01 (CRITICAL — Billing/Webhook):** Added server-signed `create-razorpay-order` Edge Function, `payment_events` idempotency table, exact `amountPaise` + `INR` + `order_id` verification, constant-time HMAC-SHA256, and profile rollback on failure. _(Stage 1C)_
- [x] **AUD-02 (CRITICAL — RLS/RBAC):** Implemented `session_participants`, `session_secrets` (PIN isolation), `create_session_room` / `join_session_with_pin`, own-row `profiles` RLS + `search_public_profiles` / `get_related_profiles` RPCs, and immutable-column triggers on `ledger` and `members`; revoked `anon` table grants. _(Stage 2)_
- [x] **AUD-03 (CRITICAL — Quota Trigger):** Locked `pro_expires_at`, `ai_scans_used`, and `last_scan_reset` exclusively to `service_role` in `protect_profile_billing_columns()`. _(Stage 1A)_
- [x] **AUD-04 + AUD-23 (CRITICAL — Admin RPC / Client Cron):** Revoked `prune_stale_data()` from `authenticated` (now `service_role` only) and removed client browser cron from `AppRouter.tsx`. _(Stage 1A)_
- [x] **AUD-05 (CRITICAL — Realtime):** Added `sessions`, `items`, `members`, `claims`, `tax_presets`, and `ledger` (`REPLICA IDENTITY FULL`) to `supabase_realtime`. _(Stage 1A)_
- [x] **AUD-16 (CRITICAL — OTA CI/CD):** Split `deploy.yml` to build a dedicated `CAPACITOR_BUILD=true` root `/` OTA bundle (asserting zero `/ekwly/_astro/` paths & zero `sw.js`), added `pnpm check` & `pnpm lint` CI gates, and wired `PUBLIC_RAZORPAY_KEY_ID`. _(Stage 1D)_
- [x] **AUD-24 (CRITICAL — OCR Edge Function):** Upgraded `scan-receipt` to `gemini-4-hydrogen` (`x-goog-api-key`, `MEDIA_RESOLUTION_HIGH`, `thinkingLevel: HIGH`, image-first), blocked anonymous users (`403`), enforced size/MIME/context limits, wired atomic `consume_ai_scan_quota` / `refund_ai_scan_quota` RPCs, added venue DB lookup + CGST/SGST reconciliation + Pass 2 math self-correction, and upgraded `MagicScanner.tsx` short-edge compression (`1400×3000`, `URL.createObjectURL`). _(Stage 1B)_
- [x] **AUD-17 (HIGH — DB Corruption):** Replaced destructive `replaceTaxPresetsInDB` in `MagicScanner.tsx` with additive `addTaxPresetsBatchToDB` (split-aware matching). _(Stage 1B)_
- [x] **AUD-26 (HIGH — PWA/Capacitor):** Disabled `AstroPWA` & `sitemap()` on `CAPACITOR_BUILD=true` with virtual module stubs, split `PwaUpdater.tsx` into web vs. native updaters, and removed duplicate `<link rel="manifest">` in `index.astro`. _(Stage 1D)_
- [ ] **AUD-25 (CRITICAL — Native Auth):** Deep-link intent/URL scheme patched in `configure-native.mjs`; still needs Supabase Auth `additional_redirect_urls` + `@capacitor/browser` PKCE callback handler in `Auth.tsx`/`AppRouter.tsx`. _(Stage 4)_

## P1 — High-Priority Reliability, Native Compliance & UX Defects

- [x] **AUD-06 (HIGH — Privacy/Cascade):** Changed `sessions.host_id` FK from `ON DELETE CASCADE` to `ON DELETE SET NULL`. _(Stage 2)_
- [x] **AUD-11 (HIGH — DB Hardening):** Revoked `TRUNCATE`/`TRIGGER`/`REFERENCES`/`MAINTAIN` from `anon`/`authenticated`, dropped redundant `venues_name_key`, and scoped `search_venue_items` to locked sessions for `authenticated`. _(Stage 1A)_
- [x] **AUD-20 (HIGH — Authz UI/Privacy):** Gated host-only member add/remove UI in `ReceiptWorkbench.tsx`, stripped `?p=` from browser URLs after joining, and stripped `upi_id` from global profile search via `search_public_profiles`. _(Stage 2)_
- [ ] **AUD-07 (HIGH — Offline/Mutations):** Harden `offlineQueue.ts` (ID-keyed tasks, `{ error }` checks, retain failed/concurrent items), add rollbacks to `useSessionMutations.ts`, and replace non-atomic `saveLedgerToDB`/`replaceTaxPresetsInDB` with RPCs. _(Stage 3)_
- [ ] **AUD-08 (HIGH — Base-Path Bug):** Fix `LegalLayout.astro` regex `replace(/\/\$/, '')` and hardcoded `/ekwly/delete-account` in `privacy.astro`. _(Stage 3)_
- [ ] **AUD-09 (HIGH — Store Compliance):** Native `mailto:` bypass removed in Stage 1C; integrate Google Play Billing / StoreKit 2 for native Pro purchases. _(Stage 4)_
- [ ] **AUD-10 (HIGH — Native Security/Insets):** Hardcoded keystore password removed & Android `MainActivity.java` cutout + IME insets fixed in `configure-native.mjs`; add cryptographic OTA bundle verification / runtime testing. _(Stage 4)_
- [ ] **AUD-18 (HIGH — Session Race/UUID):** Eliminate concurrent `createSessionInDB` vs. `fetchSessionData` mount race and remove remaining `'tx-1'` fallbacks. _(Stage 3)_
- [ ] **AUD-19 (HIGH — Router Freeze/Leak):** Fix `AppRouter.tsx` stale `user` closure in `handlePopState` and await `CapApp.addListener` cleanup handle. _(Stage 3)_
- [ ] **AUD-27 (HIGH — Domain Math):** Enforce `isScApplicable` in `SessionContext`, fix per-item rounding drift & 100%-claim guard in `mathEngine.ts`, clamp `parseQty` and guard `dividers === 0` in `utils.ts`. _(Stage 3)_
- [ ] **AUD-28 (HIGH — Native Exports):** Add `@capacitor/filesystem` + `@capacitor/share` native export adapter and UTF-8-safe PDF handling. _(Stage 4)_
- [ ] **AUD-29 (HIGH — Ledger Loop/Wildcards):** Guard `Ledger.tsx` zeroed-balance auto-settle against error loops, escape `.ilike` wildcards, and make Splitwise import atomic. _(Stage 3)_
- [ ] **AUD-30 (HIGH — Home/Profile UX):** Include joined rooms on `Home.tsx`, add `<ConfirmSheet>` + ID-based netting for Trip Folders, fix `Profile.tsx` empty-UPI onboarding loop, and wipe `ekwly_*` storage on account deletion. _(Stage 3)_
- [ ] **AUD-31 (HIGH — WCAG AA):** Remove `user-scalable=0` in `index.astro`, switch `.premium-gradient-card::before` shine to `transform` with reduced motion, and add `aria-live="polite"` to `showToast`. _(Stage 5)_
- [ ] **AUD-12 & AUD-21 (MEDIUM — UI/Hook Bugs):** Fix `Payments` `localVal` effect, short-circuit closed `WorkbenchRuleDrawers` previews, throttle `useSessionSync` focus refetch, fix `ActiveSession` title/portal and `DebtMatrix` ID-based breakdown lookup. _(Stage 3)_

## P2 — Performance, Tooling, Accessibility & Maintainability

- [x] **AUD-32 (MEDIUM — Tooling/Linting):** Migrated to ESLint 10 flat config (`eslint.config.mjs`), `@astrojs/check`, `typescript@^6.0.3`, added `check`/`lint`/`format:check`, cleared all errors & hints. _(Stage 0 & Stage 2)_
- [ ] **AUD-13 (MEDIUM — SQL Indexes & Analytics):** Add `claims(member_id)` & `LOWER(trim(venue_name))` indexes, drop `idx_sessions_host_id`, add `CHECK` constraints, move `Analytics` category audit into a SQL RPC. _(Stage 5)_
- [ ] **AUD-14 (MEDIUM — A11y & Motion):** Dialog focus traps + `Escape` + ARIA roles, `useId()` in `BrandLogo`, global `<MotionConfig reducedMotion="user">`, replace inline `💡` emoji in `SpotlightTour`. _(Stage 5)_
- [ ] **AUD-15 (MEDIUM — Maintainability):** Generate `database.types.ts` to eliminate remaining `any` warnings, revoke blob URLs, add TTL/TanStack Query, decompose monolithic components. _(Stage 5)_
- [ ] **AUD-22 (MEDIUM — Network Efficiency):** Stop re-fetching quota on `items.length`, batch `assignSinglePayer`, move `Friends` dossier into a single RPC. _(Stage 5)_
- [ ] **AUD-33 (MEDIUM — Typography & Hydration):** Bundle Inter (or `system-ui` fallback), single React root + static boot shell in `index.astro`, unify `ekwly_theme` in legal pages, remove dead `.toggle-label`. _(Stage 5)_
