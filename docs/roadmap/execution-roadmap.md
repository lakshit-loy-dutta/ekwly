# Ekwly — Staged Engineering Execution Roadmap

> **Operating Rule:** Work incrementally stage-by-stage. Every stage must pass `pnpm test`, `pnpm check`, `pnpm lint`, and `pnpm build` (plus stage-specific security/device validations) before advancing.

---

## Stage 0 — Repo Housekeeping & Tooling Baseline (COMPLETE)

- [x] Remove obsolete root artifacts (`Ekwly.apk`, `schema_dump.sql`, `repomix-output.xml`, `gemini-supabase-audit/`, duplicate migration `20261123111526`, obsolete `icons/` + `public/manifest.webmanifest`).
- [x] Untrack `supabase/.temp/` and `brand-kit/`; harden `.gitignore`.
- [x] Pin `typescript@^6.0.0` (compatibility with `@astrojs/check` & `typescript-eslint`), install ESLint 10 flat config (`eslint.config.mjs`), clear all lint errors.
- [x] **Stage 0.5:** Reorganize `docs/` into `architecture/`, `design/`, `release/`, and `roadmap/` aligned with verified codebase state.

## Stage 1 — P0 Security, Billing, `gemini-4-hydrogen` OCR & Build/OTA Fixes (IN PROGRESS)

- [ ] **Stage 1A — Database Security Lockdown, Atomic Quota RPC & Realtime Repair (`AUD-01`, `AUD-03`, `AUD-04`, `AUD-05`, `AUD-11`, `AUD-23`):**
  - Lock `ai_scans_used` & `last_scan_reset` to `service_role`, add atomic `consume_ai_scan_quota` / `refund_ai_scan_quota` RPCs, create `payment_events` idempotency table, revoke `prune_stale_data()` from `authenticated` (and remove client cron from `AppRouter.tsx`), revoke `TRUNCATE`/`TRIGGER`/`REFERENCES`, fix `venues_name_key` & `search_venue_items`, and add 6 session tables to `supabase_realtime`.
- [ ] **Stage 1B — AI Magic Scanner Overhaul (`AUD-24`, `AUD-17`):**
  - Upgrade `supabase/functions/scan-receipt/index.ts` to `gemini-4-hydrogen` (`x-goog-api-key` header, `thinkingLevel: 'MEDIUM'`, `mediaResolution: 'HIGH'`, image-first payload, remove `temperature`), block anonymous users (`403`), enforce payload/MIME/context limits, call atomic `consume_ai_scan_quota` / `refund_ai_scan_quota`, add Indian CGST+SGST pairing rules + deterministic post-processor, and return proper HTTP status codes.
  - Upgrade `MagicScanner.tsx` compression (constrain short edge to `1400px`, allow height up to `3000px`, JPEG `0.90`) and switch from destructive `replaceTaxPresetsInDB` to additive `addTaxPresetsBatchToDB`.
- [ ] **Stage 1C — Razorpay Server Orders & Webhook Hardening (`AUD-01`):**
  - Add `create-razorpay-order` Edge Function, update `razorpay-webhook/index.ts` (exact `amountPaise` + `INR` verification, `payment_events` deduplication, constant-time HMAC, checked DB errors), and wire `src/lib/razorpay.ts`.
- [ ] **Stage 1D — CI/CD OTA & Capacitor PWA Separation (`AUD-16`, `AUD-26`):**
  - Build `ota-bundle.zip` in `deploy.yml` in a separate `CAPACITOR_BUILD=true` pass (root `/`, no SW); add `pnpm check` & `pnpm lint` to CI; wire `PUBLIC_RAZORPAY_KEY_ID`.
  - Disable `AstroPWA` & `sitemap()` when `CAPACITOR_BUILD=true` in `astro.config.mjs`; remove duplicate `<link rel="manifest">` in `index.astro`.

## Stage 2 — Participant-Scoped RLS & Account-Deletion Integrity

- [ ] Implement `session_participants`, `session_secrets` (PIN isolation), `join_session_with_pin` RPC, column-safe `public_profiles` view, `ledger` immutable-column trigger, and `sessions.host_id ON DELETE SET NULL` (`AUD-02`, `AUD-06`, `AUD-20`).
- [ ] Gate host-only member controls in `ReceiptWorkbench.tsx`.
- [ ] Validate with automated multi-role RLS security tests (`anon`, `guest`, `member`, `debtor`, `host`).

## Stage 3 — Core Reliability, Math Engine, Routing & Offline Queue

- [ ] Fix `mathEngine.ts`, `SessionContext.tsx`, and `utils.ts` (`AUD-27`) + expand Vitest coverage.
- [ ] Fix `AppRouter.tsx` stale `user` closure & Capacitor listener cleanup (`AUD-19`).
- [ ] Eliminate `ActiveSession` creation race & `'tx-1'` UUID fallback (`AUD-18`), harden `offlineQueue.ts` & `useSessionMutations.ts` rollbacks + atomic RPCs (`AUD-07`).
- [ ] Fix `LegalLayout.astro` / `privacy.astro` (`AUD-08`), `Ledger.tsx` auto-settle loop & wildcards (`AUD-29`), `Home.tsx` joined sessions & trip confirm (`AUD-30`), `Profile.tsx` onboarding & storage wipe (`AUD-30`), and UI/hook bugs (`AUD-12`, `AUD-21`).

## Stage 4 — Native Mobile (Android / iOS) Compliance & Runtime Polish

- [ ] Configure native deep-link OAuth/OTP callbacks (`com.ekwly.app://auth-callback` + `@capacitor/browser`) (`AUD-25`).
- [ ] Fix Android `MainActivity.java` IME insets, remove hardcoded release keystore fallback password, add OTA integrity checks (`AUD-10`).
- [ ] Add `@capacitor/filesystem` + `@capacitor/share` native export adapter (`AUD-28`).
- [ ] Resolve Play/App Store billing compliance in `razorpay.ts` (`AUD-09`).

## Stage 5 — Performance, Accessibility, Decomposition & Target Architecture

- [ ] Add SQL indexes, `CHECK` constraints, and server-side RPCs for `Analytics` and `Friends` dossier (`AUD-13`, `AUD-22`).
- [ ] Complete WCAG AA pass (viewport zoom, focus-trapped dialogs, `prefers-reduced-motion`, `aria-live` toasts, `useId()` SVGs, bundled Inter font) (`AUD-14`, `AUD-31`, `AUD-33`).
- [ ] Generate `database.types.ts`, eliminate remaining `any` warnings, revoke blob URLs, adopt TanStack Query, and decompose monolithic components (`AUD-15`).
- [ ] **Post-v1.0 Enhancement:** Desktop & Tablet 2-Column Split-Screen Workbench (`max-w-6xl lg:grid-cols-12`).
