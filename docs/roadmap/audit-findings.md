# Ekwly — Master Codebase & Security Audit Findings (`AUD-01` – `AUD-33`)

> **Audit Baseline:** November 24, 2026 (100% static source + live PostgreSQL schema dump coverage)

## P0 — Critical Security, Billing, OCR & App-Breaking Defects

- [ ] **AUD-01 (CRITICAL — Billing/Webhook):** `razorpay-webhook/index.ts` permits ₹1 yearly Pro spoofing (`planType === 'pro_yearly' || amountPaise >= 79900`), lacks server-created Razorpay Orders, lacks event idempotency (double/triple-credit), and uses non-constant-time HMAC comparison. _(Stage 1)_
- [ ] **AUD-02 (CRITICAL — RLS/RBAC):** `sessions` (including plaintext `pin`), `items`, `members`, `claims`, `tax_presets` allow public `SELECT`; `ledger` and `profiles` (`email`, `phone`, `upi_id`) readable by any authenticated/anon user; cross-session writes on `claims`/`members`; debtors can mutate `ledger.amount`. _(Stage 2)_
- [ ] **AUD-03 (CRITICAL — Quota Trigger):** `protect_profile_billing_columns()` allows clients to backdate `last_scan_reset` and reset `ai_scans_used = 0` infinitely. _(Stage 1)_
- [ ] **AUD-04 + AUD-23 (CRITICAL — Admin RPC / Client Cron):** `prune_stale_data()` (`SECURITY DEFINER`) is granted to `authenticated` and invoked from client browsers in `AppRouter.tsx`. _(Stage 1)_
- [ ] **AUD-05 (CRITICAL — Realtime):** `supabase_realtime` publication in live schema dump omits all 6 session tables (`sessions`, `items`, `members`, `claims`, `tax_presets`, `ledger`). _(Stage 1)_
- [ ] **AUD-16 (CRITICAL — OTA CI/CD):** `deploy.yml` zips the `/ekwly/` GitHub Pages build into `ota-bundle.zip`, breaking root `/` Capacitor WebViews on OTA update; also omits `PUBLIC_RAZORPAY_KEY_ID`. _(Stage 1)_
- [ ] **AUD-24 (CRITICAL — OCR Edge Function):** `scan-receipt/index.ts` allows anonymous users (infinite free Gemini API abuse), has a TOCTOU quota race, updates quota with user JWT instead of `service_role`, lacks image size/MIME/prompt bounds, passes `GEMINI_API_KEY` in URL query string, uses superseded `gemini-3.5-flash-lite` + aggressive `1400px` max-height compression + missing CGST/SGST merge logic, and returns HTTP `200` on all errors. _(Stage 1)_
- [ ] **AUD-25 (CRITICAL — Native Auth):** `supabase/config.toml` has `additional_redirect_urls = []`, breaking Capacitor OAuth and Magic Link returns. _(Stage 4)_
- [ ] **AUD-17 (HIGH — DB Corruption):** `MagicScanner.tsx` calls destructive `replaceTaxPresetsInDB`, triggering `ON DELETE SET NULL` and wiping `tax_preset_id` on pre-existing items. _(Stage 1)_
- [ ] **AUD-26 (HIGH — PWA/Capacitor):** `astro.config.mjs` unconditionally bundles & auto-registers Workbox SW in Capacitor builds (fighting OTA); `index.astro` outputs duplicate `<link rel="manifest">` tags. _(Stage 1)_

## P1 — High-Priority Reliability, Native Compliance & UX Defects

- [ ] **AUD-06 (HIGH — Privacy/Cascade):** `sessions.host_id ON DELETE CASCADE` wipes shared bills/ledgers on host deletion, contradicting `delete-account.astro`. _(Stage 2)_
- [ ] **AUD-07 (HIGH — Offline/Mutations):** `offlineQueue.ts` ignores Supabase `{ error }` returns and drops failed/concurrent tasks; ~15 mutations lack rollback; `saveLedgerToDB` and `replaceTaxPresetsInDB` are non-atomic. _(Stage 3)_
- [ ] **AUD-08 (HIGH — Base-Path Bug):** `LegalLayout.astro` regex `replace(/\/\$/, '')` emits `//` URLs; `privacy.astro` hardcodes `/ekwly/delete-account`. _(Stage 3)_
- [ ] **AUD-09 (HIGH — Store Compliance):** `razorpay.ts` uses `mailto:` for paid digital Pro activation on native Capacitor builds (Play/App Store IAP policy violation). _(Stage 4)_
- [ ] **AUD-10 (HIGH — Native Security/Insets):** Unsigned OTA bundles, `MainActivity.java` `WindowInsetsCompat.CONSUMED` blocking Android soft keyboard resize, hardcoded fallback release keystore password `'ekwlyRelease2026!'` in `configure-native.mjs`. _(Stage 4)_
- [ ] **AUD-11 (HIGH — DB Hardening):** `GRANT ALL` grants `TRUNCATE`/`TRIGGER`/`REFERENCES` to `anon`/`authenticated`; `harvest_venue_data` last-write-wins overwrite & `venues_name_key` collision risk; `search_venue_items` leaks draft items to `anon`. _(Stage 1)_
- [ ] **AUD-18 (HIGH — Session Race/UUID):** Concurrent `createSessionInDB` vs `fetchSessionData` race wipes default presets; invalid `'tx-1'` fallback crashes PostgreSQL `uuid` column. _(Stage 3)_
- [ ] **AUD-19 (HIGH — Router Freeze/Leak):** `AppRouter.tsx` `handlePopState` stale `user = null` closure freezes Back navigation on boot loader; unawaited `CapApp.addListener` cleanup leaks listeners. _(Stage 3)_
- [ ] **AUD-20 (HIGH — Authz UI/Privacy):** Non-hosts see member add/delete controls in `ReceiptWorkbench.tsx`; PINs stored in URLs; `Friends.tsx` global search exposes `upi_id`. _(Stage 2)_
- [ ] **AUD-27 (HIGH — Domain Math):** `SessionContext` ignores `isScApplicable`; Step 6 pre-rounds item shares & Step 7 caps drift at `₹0.05`; negative `parseQty` and zero-divider `getFractionString` unguarded. _(Stage 3)_
- [ ] **AUD-28 (HIGH — Native Exports):** `<a download>` / `doc.save()` fails in iOS WKWebView and some Android WebViews; `pdf.ts` uses WinAnsi-only `helvetica` font. _(Stage 4)_
- [ ] **AUD-29 (HIGH — Ledger Loop/Wildcards):** `Ledger.tsx` zeroed-balance auto-settle can infinite-loop on DB error; `.ilike` lacks `%`/`_` escaping; Splitwise import is non-atomic. _(Stage 3)_
- [ ] **AUD-30 (HIGH — Home/Profile UX):** `Home.tsx` omits joined sessions and settles trips without confirmation; `Profile.tsx` allows empty UPI trapping onboarding loop; account deletion leaves `localStorage` keys. _(Stage 3)_
- [ ] **AUD-31 (HIGH — WCAG AA):** `index.astro` blocks zoom (`user-scalable=0`); `.premium-gradient-card::before` animates `left` infinitely; `showToast` lacks `aria-live="polite"`. _(Stage 5)_
- [ ] **AUD-12 & AUD-21 (MEDIUM — UI/Hook Bugs):** `Payments` `localVal` effect loop, closed `WorkbenchRuleDrawers` 3x split recompute, unthrottled `focus` refetch, `MagicScanner` HTTP 402 check (`error.context?.status`), `ActiveSession` title & portal mount, `DebtMatrix` name-based breakdown lookup. _(Stage 3)_

## P2 — Performance, Tooling, Accessibility & Maintainability

- [x] **AUD-32 (MEDIUM — Tooling/Linting):** Replaced broken `.eslint.cjs` with ESLint 10 `eslint.config.mjs`, added `@astrojs/check`, pinned `typescript@^6.0.0`, added `lint`/`check`/`format:check` scripts, moved `@types/*` to `devDependencies`. _(Completed in Stage 0)_
- [ ] **AUD-13 (MEDIUM — SQL Indexes & Analytics):** Add `claims(member_id)` & `LOWER(trim(venue_name))` indexes, drop `idx_sessions_host_id`, add enum/non-negative `CHECK` constraints, move `Analytics` category audit into a SQL RPC. _(Stage 5)_
- [ ] **AUD-14 (MEDIUM — A11y & Motion):** Dialog focus traps + `Escape` + ARIA roles, `useId()` in `BrandLogo`, global `<MotionConfig reducedMotion="user">`, replace inline `💡` emoji in `SpotlightTour`. _(Stage 5)_
- [ ] **AUD-15 (MEDIUM — Maintainability):** Generate `database.types.ts` to eliminate `any`, revoke `URL.createObjectURL` blobs, add TTL to `swrCache` / adopt TanStack Query, decompose monolithic components (`ReceiptWorkbench`, `Friends`, `DebtMatrix`, `AppRouter`). _(Stage 5)_
- [ ] **AUD-22 (MEDIUM — Network Efficiency):** Stop re-fetching quota on `items.length`, batch `assignSinglePayer`, move `Friends` dossier into a single RPC. _(Stage 5)_
- [ ] **AUD-33 (MEDIUM — Typography & Hydration):** Bundle Inter (or `system-ui` fallback), single React root + static boot shell in `index.astro`, unify `ekwly_theme` key in legal pages, remove dead `.toggle-label`. _(Stage 5)_
