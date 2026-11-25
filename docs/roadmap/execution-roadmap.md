# Ekwly — Staged Engineering Execution Roadmap

> **Operating Rule:** Work incrementally stage-by-stage. Every stage must pass `pnpm test`, `pnpm check`, `pnpm lint`, and `pnpm build` (plus stage-specific security/device validations) before advancing.

---

## Stage 0 — Repo Housekeeping & Tooling Baseline (COMPLETE)

- [x] Removed obsolete artifacts, untracked `supabase/.temp/` & `brand-kit/`, hardened `.gitignore`.
- [x] Pinned `typescript@^6.0.3`, configured ESLint 10 (`eslint.config.mjs`) + `@astrojs/check`, cleared all lint errors and TypeScript hints.
- [x] **Stage 0.5:** Reorganized `docs/` into `architecture/`, `design/`, `release/`, and `roadmap/` and added `docs/` to `scripts/export-audit-pack.mjs`.

## Stage 1 — P0 Security, Billing, `gemini-4-hydrogen` OCR & Build/OTA Fixes (COMPLETE)

- [x] **Stage 1A:** Billing/quota trigger lockdown, atomic `consume_ai_scan_quota` / `refund_ai_scan_quota` RPCs, `payment_events` table, `prune_stale_data` locked to `service_role`, least-privilege grants, `search_venue_items` hardening, and all 6 session tables added to `supabase_realtime`.
- [x] **Stage 1B:** Upgraded `scan-receipt` to `gemini-4-hydrogen` (high-res vision, CGST/SGST merge, venue DB priors, Pass 2 math self-correction), upgraded `MagicScanner.tsx` (`Camera.takePhoto`/`chooseFromGallery`, short-edge compression, additive `addTaxPresetsBatchToDB`), and dynamic `scripts/configure-native.mjs` (`doctor`, IME insets, no hardcoded keystore password, deep-link manifests).
- [x] **Stage 1C:** Added server-signed `create-razorpay-order` Edge Function, hardened `razorpay-webhook` (constant-time HMAC + idempotency), and updated `src/lib/razorpay.ts`.
- [x] **Stage 1D:** Separated Capacitor `/` OTA bundle build in `deploy.yml` with CI quality gates, gated `AstroPWA` off Capacitor builds in `astro.config.mjs`, split `PwaUpdater.tsx`, and removed duplicate manifest tag in `index.astro`.

## Stage 2 — Participant-Scoped RLS & Account-Deletion Integrity (COMPLETE)

- [x] Deployed `20261125000001_stage2_participant_rls.sql`: `session_participants`, `session_secrets`, `create_session_room`, `join_session_with_pin`, `get_host_session_pin`, `search_public_profiles`, `get_related_profiles`, immutable `ledger`/`members` triggers, and `sessions.host_id ON DELETE SET NULL`.
- [x] Updated `AppRouter.tsx`, `Friends.tsx`, `Ledger.tsx`, `DebtMatrix.tsx`, `ReceiptWorkbench.tsx`, `Home.tsx`, and `useSessionMutations.ts` to use safe RPCs and host-gated member controls.

## Stage 3 — Core Reliability, Math Engine, Routing & Offline Queue (NEXT)

- [ ] Fix `mathEngine.ts`, `SessionContext.tsx`, and `utils.ts` (`AUD-27`) + expand Vitest coverage.
- [ ] Fix `AppRouter.tsx` stale `user` closure, Capacitor listener cleanup, and `?s=` reload flow (`AUD-19`).
- [ ] Eliminate `ActiveSession` creation race & `'tx-1'` UUID fallback (`AUD-18`), harden `offlineQueue.ts` & `useSessionMutations.ts` rollbacks + atomic RPCs (`AUD-07`).
- [ ] Fix `LegalLayout.astro` / `privacy.astro` (`AUD-08`), `Ledger.tsx` auto-settle loop & wildcards (`AUD-29`), `Home.tsx` joined sessions & trip confirm (`AUD-30`), `Profile.tsx` onboarding & storage wipe (`AUD-30`), and UI/hook bugs (`AUD-12`, `AUD-21`).

## Stage 4 — Native Mobile (Android / iOS) Compliance & Runtime Polish

- [ ] Wire native OAuth/OTP deep-link callbacks (`com.ekwly.app://auth-callback` + `@capacitor/browser` + Supabase `additional_redirect_urls`) (`AUD-25`).
- [ ] Add `@capacitor/filesystem` + `@capacitor/share` native export adapter (`AUD-28`).
- [ ] Verify physical Android 14–16 keyboard/back behavior & iOS WKWebView safe areas (`AUD-10`).
- [ ] Integrate Play Billing / StoreKit 2 when company/merchant accounts are ready (`AUD-09`).

## Stage 5 — Performance, Accessibility, Decomposition & Target Architecture

- [ ] Add SQL indexes, `CHECK` constraints, and server-side RPCs for `Analytics` and `Friends` dossier (`AUD-13`, `AUD-22`).
- [ ] Complete WCAG AA pass (viewport zoom, focus-trapped dialogs, `prefers-reduced-motion`, `aria-live` toasts, `useId()` SVGs, bundled Inter font) (`AUD-14`, `AUD-31`, `AUD-33`).
- [ ] Generate `database.types.ts` via `supabase gen types typescript`, eliminate remaining `any` warnings, revoke blob URLs, adopt TanStack Query, and decompose monolithic components (`AUD-15`).
- [ ] **Post-v1.0 Enhancement:** Desktop & Tablet 2-Column Split-Screen Workbench (`max-w-6xl lg:grid-cols-12`).
