# Ekwly — Complete Project Handoff & State Ledger (`PROJECT-STATE.md`)

> **Last Updated:** October 19, 2026  
> **Current Version:** `v0.7.5` (Milestones 1–5 & DB Migration #2 Verified; Milestone 6 Implemented & Verified)  
> **Repository Visibility:** Private Proprietary Repository  
> **Core Constraint:** ₹0 Hosting & Operational Cost Architecture + 60Hz–240Hz Frame-Rate Budget (`<4.1ms/frame`)

---

## 1. Original Architecture & Confirmed Technology Stack

- **Product Domain:** Real-time collaborative and Solo-Host ("Designated Treasurer") restaurant bill-splitting, Indian POS multi-bracket tax routing (Food GST 5%, Alcohol VAT 0%–25%, Tobacco GST 28%–40%), social dining network, and instant UPI settlement engine.
- **Frontend Framework:** Astro 7 (`^7.3.8`, strictly static output) + React 19 (`^19.3.0`) + TypeScript (`^7.0.2`).
- **Styling & Motion:** Tailwind CSS v4 (`^4.3.3` via `@tailwindcss/vite`) + Framer Motion (`^13.5.1`, analytical spring physics) + Lucide React (`^1.56.0`).
- **Backend & Database:** Supabase (`@supabase/supabase-js` `^2.117.3`) — PostgreSQL, Row Level Security (RLS), Realtime WebSockets (`postgres_changes`), Auth (Google OAuth, Magic Link OTP, Anonymous Guest), and Deno Edge Functions.
- **AI Vision OCR:** `gemini-3.5-flash-lite` invoked via `supabase/functions/scan-receipt/index.ts` using strict JSON schema enforcement with a top-level `reasoning` Chain-of-Thought (CoT) math verification field.
- **Native Mobile Wrapper:** Capacitor 8 (`@capacitor/core`, `@capacitor/android`, `@capacitor/ios` `^8.5.3`, `@capacitor/app` `^8.1.2`, `@capacitor/camera` `^8.2.5`, `@capacitor-mlkit/barcode-scanning` `^8.2.1`).
- **Web Fallbacks & Utilities:** `@vite-pwa/astro` (`^1.2.0` Workbox Service Worker), `html5-qrcode` (`^2.3.8`), `react-qr-code` (`^2.2.0`), `jspdf` (`^4.2.1`) + `jspdf-autotable` (`^5.0.8`).
- **Runtime, Testing & Tooling:** Node.js 24 (`.nvmrc`), `pnpm` v12+ (strictly enforced; never use `npm`/`yarn`), Vitest (`^5.0.4`), Repomix (`repomix.config.ts`).

---

## 2. Core Constraints (`ARCHITECTURE.md`, `DESIGN_SYSTEM.md`, `UI_UX_REDESIGN.md`, `AGENTS.md`)

1. **₹0 Hosting & Operational Cost Guardrails:**
   - Astro build output must remain static (`output: 'static'`) for free static hosting (GitHub Pages / Cloudflare Pages / Vercel) and local Capacitor packaging.
   - **Zero Cloud Image Storage:** Receipt images are compressed client-side on an HTML5 `<canvas>` (`max 1400px`, `0.82` JPEG quality) in `MagicScanner.tsx`, sent as Base64 to the `scan-receipt` Edge Function, and discarded immediately after extraction (0 bytes stored in Supabase Storage).
   - **Batch Database Mutations:** Never call Supabase `.insert()`, `.upsert()`, or `.delete()` inside a `for...of` loop. Always use batch mutations (`addItemsBatchToDB`, `batchUpdateClaimsInDB`, `replaceTaxPresetsInDB`).
   - **CI/CD Quota Protection:** `.github/workflows/build-native.yml` must remain `on: workflow_dispatch` (manual trigger) so macOS/Linux builds do not drain private repo GitHub Actions minutes automatically.
2. **High-Refresh-Rate (60Hz / 90Hz / 120Hz / 144Hz / 240Hz) Rendering Rules:**
   - Animate **only** GPU-composited properties (`transform`, `opacity`, Framer Motion `layout="position"`). Never animate `height: 0 -> 'auto'` on list items.
   - Restrict `backdrop-filter: blur()` (`backdrop-blur-*`) strictly to fixed chrome (Sticky Header, `<BottomDock/>`, `<BottomSheet/>` overlay). Never apply `backdrop-blur` to repeating cards in scrolling lists.
   - Apply `tabular-nums` (`font-variant-numeric: tabular-nums`) to all currency amounts, quantities, fractions, percentages, and PINs.
   - Never use `window.alert`, `window.confirm`, or `window.prompt`. Always use `<ConfirmSheet/>` and `showToast`.
   - Never hardcode `/ekwly/` in components. Use `utils.resolvePath('...')` in `.tsx` and `import.meta.env.BASE_URL` in `.astro` so both GitHub Pages (`/ekwly`) and Capacitor (`/`) builds work cleanly.
3. **Free vs. Pro Tier Boundary:**
   - **Free Forever (₹0):** Unlimited rooms/items/splits, full Universal Tax Engine, crowd-sourced venue & menu autocomplete, 3 free AI Magic Scans/month (auto-resetting on UTC month rollover), UPI deep links, Host UPI QR, WhatsApp nudges, Splitwise CSV import, bilateral balance netting, and PDF export.
   - **Ekwly Pro (₹99/mo, ₹799/yr, or ₹49 7-Day Trip Pass):** Unlimited AI Magic Scans, Personal Analytics Dashboard, and upcoming Saved Squads.

---

## 3. Current Project Structure

```text
├── .github/workflows/
│   ├── build-native.yml              # Manual workflow_dispatch Android APK & iOS unsigned IPA builder
│   └── deploy.yml                    # CI unit test & static build workflow
├── .vscode/
│   ├── extensions.json               # Workspace recommended extensions
│   └── settings.json                 # Formatter, Tailwind, Deno, JDK 21 & Gradle 8.14.3 settings
├── scripts/
│   └── configure-native.mjs          # Auto-links JBR 21/SDK, patches Manifest/Info.plist & builds APKs
├── supabase/
│   └── functions/
│       ├── razorpay-webhook/index.ts # HMAC-SHA256 webhook for automated Pro & Trip Pass activation
│       └── scan-receipt/index.ts     # Auth, monthly quota reset & Gemini 3.5 Flash-Lite CoT OCR
├── src/
│   ├── components/
│   │   ├── session/
│   │   │   ├── ReceiptWorkbench.tsx  # Unified Solo-Host & Multiplayer Receipt Workbench
│   │   │   ├── DebtMatrix.tsx        # Draft summary, room locking, UPI links, Host UPI QR modal, WhatsApp, PDF
│   │   │   ├── MagicScanner.tsx      # Native/Web camera capture, <canvas> compression & batch DB insert
│   │   │   ├── Payments.tsx          # Multi-payer restaurant cashier input (inside Change Payer drawer)
│   │   │   ├── ClaimManager.tsx      # Legacy Step 4 (superseded by ReceiptWorkbench)
│   │   │   ├── MembersList.tsx       # Legacy Step 3 (superseded by ReceiptWorkbench)
│   │   │   ├── QuickSplit.tsx        # Legacy Step 4 helper (superseded by ReceiptWorkbench)
│   │   │   ├── ReceiptEditor.tsx     # Legacy Step 2 (superseded by ReceiptWorkbench)
│   │   │   └── SessionRules.tsx      # Legacy Step 1 (superseded by ReceiptWorkbench)
│   │   ├── ui/
│   │   │   ├── BottomDock.tsx        # Floating thumb-zone navigation dock with layoutId pill
│   │   │   ├── BottomSheet.tsx       # Spring-animated modal sheet
│   │   │   ├── BrandLoader.tsx       # Multi-path SVG <BrandLogo/> and 240fps <BrandLoader/>
│   │   │   ├── ConfirmSheet.tsx      # Custom confirmation & text-match dialog replacing window.confirm
│   │   │   ├── HelpTip.tsx           # Contextual info callout
│   │   │   ├── QrScannerModal.tsx    # Unified ML Kit (native) + Html5Qrcode (web) scanner modal
│   │   │   ├── SectionHeader.tsx     # Section title + help toggle
│   │   │   └── ToggleSwitch.tsx      # Custom switch component
│   │   ├── ActiveSession.tsx         # 2-Tab session orchestrator + Smart Cashier Default
│   │   ├── Analytics.tsx             # Ekwly Pro dashboard (Top Venues, Debtor Concentration, Quota)
│   │   ├── AppRouter.tsx             # Top-level view state machine, Zero-Friction Room Entry & BottomDock
│   │   ├── Auth.tsx                  # Google OAuth, Magic Link OTP & Anonymous Guest sign-in
│   │   ├── Friends.tsx               # Friend connections, QR scanner & invite links
│   │   ├── Home.tsx                  # Dashboard, Netted Ledger hero card, QR room scanner, recent rooms
│   │   ├── Ledger.tsx                # Bilaterally netted receivables/payables, UPI QR, WhatsApp & CSV import
│   │   ├── Lobby.tsx                 # Room joining gateway (ID & 4-digit PIN)
│   │   ├── Profile.tsx               # Display name, UPI VPA config, QR code & account deletion
│   │   └── PwaUpdater.tsx            # Service worker update prompt
│   ├── layouts/LegalLayout.astro     # Shared layout for privacy, terms & refunds pages
│   ├── lib/
│   │   ├── session/
│   │   │   ├── offlineQueue.ts       # Promise-locked localStorage offline mutation queue
│   │   │   ├── useSessionMutations.ts# Optimistic UI + batch & offline-aware CRUD mutations
│   │   │   └── useSessionSync.ts     # Parallel fetch & deduplicated Realtime WebSocket listeners
│   │   ├── mathEngine.ts             # Universal Indian Tax Engine, Paisa Conservation & greedy settlement
│   │   ├── mathEngine.test.ts        # Unit tests for Model A (TBC 66) & Model B (Chin Lung) receipts
│   │   ├── pdf.ts                    # Dynamic ESM jsPDF generator + Web Share Level 2 native file share
│   │   ├── SessionContext.tsx        # React Context provider with verifiedIsHost & liveCalculation
│   │   ├── splitwiseCsv.ts           # Splitwise CSV parser & pairwise debt extractor
│   │   ├── splitwiseCsv.test.ts      # Unit tests for Splitwise CSV migration
│   │   ├── supabase.ts               # Singleton Supabase client
│   │   ├── types.ts                  # Canonical TypeScript interfaces (including NettedBalanceRow)
│   │   ├── useSession.ts             # Composer hook combining useSessionSync & useSessionMutations
│   │   ├── utils.ts                  # Fractions, GCD, haptics, buildUpiUrl, WhatsApp URL, netBilateralBalances
│   │   └── utils.test.ts             # Unit tests for fraction parsing, GST splitting, UPI URI & bilateral netting
│   ├── pages/                        # Astro routes (index, privacy, terms, refunds, delete-account)
│   └── styles/                       # global.css, theme.css, base.css, components.css
├── ARCHITECTURE.md                   # System specification & roadmap
├── DESIGN_SYSTEM.md                  # 240Hz rendering rules, tokens & UX specification
├── UI_UX_REDESIGN.md                 # Detailed rationale & blueprint for the 2-Tab Workbench & Social Network
├── AGENTS.md / CLAUDE.md             # AI coding guidelines
├── astro.config.mjs                  # Conditional base path ('/' for Capacitor, '/ekwly' for GH Pages)
├── capacitor.config.json             # Capacitor 8 native configuration
├── package.json                      # Dependencies & build scripts
└── repomix.config.ts                 # Context packing config
```

---

## 4. Verification Ledger: Verified Facts vs. Unverified Pending Changes

### A. Verified Facts (Confirmed in `repomix-output.xml`, `.vscode/*`, and `schema_dump_2.sql`)

1. **VS Code Workspace Configuration Verified (`.vscode/settings.json` & `.vscode/extensions.json`):**
   - Excludes `node_modules`, `dist`, `.astro`, and `ios` from `redhat.java`, pins Gradle `8.14.3` and JDK 21, and configures Deno for `supabase/functions`.
2. **Database Schema Migration #1 & #2 Applied (`schema_dump_2.sql`):**
   - `public.harvest_venue_data()`, `public.protect_profile_billing_columns()`, and `public.prune_stale_data()` are active.
   - `public.personal_analytics` and `public.global_ledger` views are active.
   - All 14 B-Tree and GIN trigram indexes (`idx_claims_session_id`, `idx_connections_friend_id`, `idx_connections_unique_pair`, `idx_items_session_id`, `idx_ledger_creditor_unsettled`, `idx_ledger_debtor_unsettled`, `idx_ledger_session_id`, `idx_members_session_id`, `idx_members_user_id`, `idx_profiles_name_trgm`, `idx_sessions_host_id`, `idx_sessions_venue_name`, `idx_tax_presets_session_id`, `idx_venues_name_trgm`) are live in Supabase.
3. **Milestone 4 & Milestone 5 Files Present in Repo (`repomix-output.xml`):**
   - `ReceiptWorkbench.tsx`, 2-tab `ActiveSession.tsx` (with Smart Cashier Default), `SessionContext.tsx` (with `verifiedIsHost`, `formattedClaims`, `liveCalculation`), `pdf.ts` (`navigator.canShare`), `Profile.tsx` (guest regex fix), and `scripts/configure-native.mjs` (Gradle `8.14.3` & AGP `8.13.0` pinning) are all confirmed present in `repomix-output.xml`.

### B. Milestone 6 (Completed & Verified)

1. **Milestone 6 Settlement & Bilateral Netting Files:**
   - `src/lib/types.ts` (Added `GlobalLedgerRow` and `NettedBalanceRow`).
   - `src/lib/utils.ts` (Added `utils.buildUpiUrl` and `utils.netBilateralBalances`).
   - `src/lib/utils.test.ts` (Added unit tests for bilateral netting and UPI deep-link generation).
   - `src/components/session/DebtMatrix.tsx` (Added Host-Side Dynamic UPI QR Modal, inline UPI VPA fallback, 1-tap `Mark Paid` inside QR modal, and inset Bento card geometry).
   - `src/components/Ledger.tsx` (Integrated `utils.netBilateralBalances`, automatic clearing of mutually offset ₹0.00 balances, bidirectional `settleBothDirectionsInDB`, and UPI Pay/QR modal for payables).
   - `src/components/Home.tsx` (Synced Dashboard hero card with `utils.netBilateralBalances`).
   - `src/components/AppRouter.tsx` (Added Zero-Friction Room Entry `handleQuickLaunchRoom` and replaced legacy 6-step header labels with the active room title).

---

## 5. Exact Next Task & Starting Point

1. **Execute Milestone 7 (The Social Dining Network & Lazy WebSockets):**
   - **Step 7.1 — Live Friend Search & "People You've Dined With" (`src/components/Friends.tsx`):** Search registered Ekwly users by name (powered by `idx_profiles_name_trgm`) and surface suggested connections from past shared sessions.
   - **Step 7.2 — Saved Squads & Friendship Dining Dossier (`src/components/Friends.tsx` & `src/components/session/ReceiptWorkbench.tsx`):** Create 1-tap Saved Squads (e.g., `"BLR Flatmates"`, `"Friday Crew"`) usable inside `ReceiptWorkbench.tsx`, and open a Friendship Dossier sheet on friend tap showing shared outing count, favorite venue together, and net balance.
   - **Step 7.3 — Lazy Multiplayer WebSockets (`src/lib/session/useSessionSync.ts`):** Keep Realtime `postgres_changes` dormant during solo-host entry until `"Invite QR"` is opened or >1 user links to the room.
