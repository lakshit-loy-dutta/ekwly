# Ekwly — Complete Project Handoff & State Ledger (`PROJECT-STATE.md`)

> **Last Updated:** October 20, 2026  
> **Current Version:** `v0.9.5` (Milestones 1–9 Verified: 2-Tab Workbench, 3-Layer Discount Engine, Host UPI QR, Bilateral Netting, Social Dining Network, Lazy WebSockets, Route Code-Splitting & 0ms SWR Tab Cache)  
> **Repository Visibility:** Private Proprietary Repository  
> **Core Constraint:** ₹0 Hosting & Operational Cost Architecture + 60Hz–240Hz Frame-Rate Budget (`<4.1ms/frame`)

---

## 1. Executive Summary & Confirmed Technology Stack

- **Product Domain:** High-frame-rate (60Hz–240Hz), Solo-Host-First ("Designated Treasurer") and live multiplayer restaurant bill-splitting, Indian POS multi-bracket tax routing (Food GST 5%, Alcohol VAT 0%–25%, Tobacco GST 28%–40%), 3-layer discount allocation (Item/Section, Selective Pre-Tax, Simultaneous Post-Tax), social dining network, and instant UPI settlement engine.
- **Frontend Framework:** Astro 7 (`^7.3.8`, strictly static output) + React 19 (`^19.3.0`, `React.lazy` route splitting + `swrCache.ts` 0ms tab state cache) + TypeScript (`^7.0.2`).
- **Styling & Motion:** Tailwind CSS v4 (`^4.3.3` via `@tailwindcss/vite`, zero-specificity `:where()` form reset) + Framer Motion (`^13.5.1`, analytical spring physics) + Lucide React (`^1.56.0`).
- **Backend & Database:** Supabase (`@supabase/supabase-js` `^2.117.3`) — PostgreSQL, Row Level Security (RLS), Lazy Realtime WebSockets (`postgres_changes`), Auth (Google OAuth, Magic Link OTP, Anonymous Guest), and Deno Edge Functions.
- **AI Vision OCR:** `gemini-3.5-flash-lite` invoked via `supabase/functions/scan-receipt/index.ts` using strict JSON schema enforcement with a top-level `reasoning` Chain-of-Thought (CoT) math verification field and 3-layer discount extraction.
- **Native Mobile Wrapper:** Capacitor 8 (`@capacitor/core`, `@capacitor/android`, `@capacitor/ios` `^8.5.3`, `@capacitor/app` `^8.1.2`, `@capacitor/camera` `^8.2.5`, `@capacitor-mlkit/barcode-scanning` `^8.2.1`).
- **Web Fallbacks & Utilities:** `@vite-pwa/astro` (`^1.2.0` Workbox Service Worker), `html5-qrcode` (`^2.3.8`, dynamically imported on web only), `react-qr-code` (`^2.2.0`), `jspdf` (`^4.2.1`) + `jspdf-autotable` (`^5.0.8`, dynamically imported on export).
- **Runtime, Testing & Tooling:** Node.js 24 (`.nvmrc`), `pnpm` v12+ (strictly enforced; never use `npm`/`yarn`), Vitest (`^5.0.4`, 14 unit tests across 3 suites), Repomix (`repomix.config.ts`).

---

## 2. Core Engineering & Financial Guardrails (`ARCHITECTURE.md`, `DESIGN_SYSTEM.md`, `UI_UX_REDESIGN.md`, `AGENTS.md`)

1. **₹0 Hosting & Operational Cost Guardrails:**
   - **Static Web Output:** Astro build output remains strictly static (`output: 'static'`) for free static hosting (GitHub Pages / Cloudflare Pages / Vercel) and local Capacitor packaging.
   - **Zero Cloud Image Storage:** Receipt images are compressed client-side on an HTML5 `<canvas>` (`max 1400px`, `0.82` JPEG quality) in `MagicScanner.tsx`, sent as Base64 to the `scan-receipt` Edge Function, and discarded immediately after extraction (0 bytes stored in Supabase Storage).
   - **Zero Cloud Media Storage for Social Features:** Saved Squads (`ekwly_squads_<uid>`) and Friendship Dining Dossiers operate purely on relational metadata and `localStorage` without media storage buckets.
   - **Batch Database Operations:** Never execute Supabase `.insert()`, `.upsert()`, or `.delete()` inside a `for...of` loop. Always use batch mutations (`addItemsBatchToDB`, `batchUpdateItemsInDB`, `addMembersBatchToDB`, `batchUpdateClaimsInDB`, `replaceTaxPresetsInDB`).
   - **Lazy Multiplayer WebSockets:** Realtime `postgres_changes` subscriptions remain dormant in Solo Mode and activate only when `Invite QR` is opened, `Solo Mode` is toggled to `Live Sync`, or >1 linked user joins the room.
   - **CI/CD Quota Protection:** `.github/workflows/build-native.yml` is strictly `on: workflow_dispatch` (manual trigger) so macOS/Linux cloud builds never drain private repo GitHub Actions minutes automatically.
2. **High-Refresh-Rate (60Hz / 90Hz / 120Hz / 144Hz / 240Hz) Rendering Rules:**
   - Animate **only** GPU-composited properties (`transform`, `opacity`, Framer Motion `layout="position"`). Never animate `height: 0 -> 'auto'` on list items.
   - Restrict `backdrop-filter: blur()` (`backdrop-blur-*`) strictly to fixed viewport chrome (Sticky Header, `<BottomDock/>`, `<BottomSheet/>` overlay). Never apply `backdrop-blur` to repeating cards in scrolling lists.
   - Apply `tabular-nums` (`font-variant-numeric: tabular-nums`) to all currency amounts, quantities, fractions, percentages, and PINs.
   - Never use `window.alert`, `window.confirm`, or `window.prompt`. Always use `<ConfirmSheet/>` and `showToast`.
   - Never hardcode `/ekwly/` in components. Use `utils.resolvePath('...')` in `.tsx` and `import.meta.env.BASE_URL` in `.astro`.
3. **Free vs. Pro Tier Boundary:**
   - **Free Forever (₹0):** Unlimited rooms/items/splits, full Universal Tax & 3-Layer Discount Engine, crowd-sourced venue & menu autocomplete, 3 free AI Magic Scans/month (auto-resetting on UTC month rollover), Saved Squads, Friendship Dossiers, UPI deep links, Host UPI QR, WhatsApp nudges, Splitwise CSV import, bilateral balance netting, and PDF export.
   - **Ekwly Pro (₹99/mo, ₹799/yr, or ₹49 7-Day Trip Pass):** Unlimited AI Magic Scans and full Personal Analytics Dashboard (`Top Dining Venues` & `Top Outstanding Debtors`).

---

## 3. Complete Project Directory Structure

```text
├── .github/workflows/
│   ├── build-native.yml                  # Manual workflow_dispatch Android APK & iOS unsigned IPA builder
│   └── deploy.yml                        # CI unit test & static build workflow
├── .vscode/
│   ├── extensions.json                   # Workspace recommended extensions
│   └── settings.json                     # Formatter, Tailwind, Deno, JDK 21 & Gradle 8.14.3 settings
├── scripts/
│   └── configure-native.mjs              # Auto-links JBR 21/SDK 36, pins Gradle 8.14.3/AGP 8.13.0, patches Manifest/Info.plist & builds APKs
├── supabase/
│   ├── functions/
│   │   ├── razorpay-webhook/index.ts     # HMAC-SHA256 webhook for automated Pro & 7-Day Trip Pass activation
│   │   └── scan-receipt/index.ts         # Auth, monthly quota reset & Gemini 3.5 Flash-Lite CoT 3-Layer OCR
│   └── migrations/
│       ├── 20261019_indexes_and_pruning.sql
│       └── 20261020_multi_layer_discounts.sql
├── src/
│   ├── components/
│   │   ├── session/
│   │   │   ├── ReceiptWorkbench.tsx      # Unified Solo-Host & Multiplayer Receipt Workbench (Zones 1–5)
│   │   │   ├── WorkbenchRuleDrawers.tsx  # Extracted drawers: Service Charge, 3-Layer Discounts & Tax Brackets
│   │   │   ├── DebtMatrix.tsx            # Draft summary, room locking, UPI links, Host UPI QR modal, WhatsApp, PDF
│   │   │   ├── MagicScanner.tsx          # Native/Web camera capture, <canvas> compression & batch DB insert
│   │   │   └── Payments.tsx              # Multi-payer restaurant cashier input (inside Change Payer drawer)
│   │   ├── ui/
│   │   │   ├── BottomDock.tsx            # Floating thumb-zone navigation dock with layoutId pill
│   │   │   ├── BottomSheet.tsx           # Spring-animated modal sheet
│   │   │   ├── BrandLoader.tsx           # Multi-path SVG <BrandLogo/> and 240fps <BrandLoader/>
│   │   │   ├── ConfirmSheet.tsx          # Custom confirmation & text-match dialog replacing window.confirm
│   │   │   ├── HelpTip.tsx               # Contextual info callout
│   │   │   ├── QrScannerModal.tsx        # Unified ML Kit (native) + lazy Html5Qrcode (web) scanner modal
│   │   │   ├── SectionHeader.tsx         # Section title + help toggle
│   │   │   └── ToggleSwitch.tsx          # Custom switch component
│   │   ├── ActiveSession.tsx             # 2-Tab session orchestrator (top-16 sticky) + Smart Cashier Default
│   │   ├── Analytics.tsx                 # Ekwly Pro dashboard (Top Venues, Debtor Concentration, Quota) + SWR cache
│   │   ├── AppRouter.tsx                 # React.lazy route state machine, Zero-Friction Room Entry & BottomDock
│   │   ├── Auth.tsx                      # Google OAuth, Magic Link OTP confirmation state & Instant Guest CTA
│   │   ├── Friends.tsx                   # Social Dining Network: Live Search, Co-Diners, Saved Squads & Dossier + SWR cache
│   │   ├── Home.tsx                      # Dashboard, Netted Ledger hero card, Quick Action Bar & recent rooms + SWR cache
│   │   ├── Ledger.tsx                    # Bilaterally netted receivables/payables, UPI QR, WhatsApp & CSV import + SWR cache
│   │   ├── Lobby.tsx                     # Focused Room Join Gateway (QR Scanner + Room ID & 4-Digit PIN)
│   │   ├── Profile.tsx                   # Display name, UPI VPA config, Personal UPI Receive QR & account deletion + SWR cache
│   │   └── PwaUpdater.tsx                # Service worker update prompt
│   ├── layouts/LegalLayout.astro         # Shared layout for privacy, terms & refunds pages
│   ├── lib/
│   │   ├── session/
│   │   │   ├── offlineQueue.ts           # Promise-locked localStorage offline mutation queue
│   │   │   ├── useSessionMutations.ts    # Memoized optimistic UI + batch & offline-aware CRUD mutations
│   │   │   └── useSessionSync.ts         # Parallel fetch & lazy-activated Realtime WebSocket listeners
│   │   ├── mathEngine.ts                 # 3-Layer Discount, Indian POS Tax, Paisa Conservation & greedy settlement engine
│   │   ├── mathEngine.test.ts            # Unit tests for Model A, Model B, Pre-Tax & 3-Layer Simultaneous Discounts
│   │   ├── pdf.ts                        # Dynamic ESM jsPDF generator + Web Share Level 2 native file share
│   │   ├── SessionContext.tsx            # React Context provider with verifiedIsHost & liveCalculation
│   │   ├── splitwiseCsv.ts               # Splitwise CSV parser & pairwise debt extractor
│   │   ├── splitwiseCsv.test.ts          # Unit tests for Splitwise CSV migration
│   │   ├── supabase.ts                   # Singleton Supabase client
│   │   ├── swrCache.ts                   # In-memory Stale-While-Revalidate cache for 0ms BottomDock tab transitions
│   │   ├── types.ts                      # Canonical TypeScript interfaces
│   │   ├── useSession.ts                 # Composer hook combining useSessionSync & useSessionMutations
│   │   ├── utils.ts                      # Fractions, GCD, haptics, UPI URI, WhatsApp URL, bilateral netting, squads & dossier
│   │   └── utils.test.ts                 # Unit tests for fraction parsing, GST splitting, UPI URI, netting & dossier stats
│   ├── pages/                            # Astro routes (index, privacy, terms, refunds, delete-account)
│   └── styles/                           # global.css, theme.css, base.css, components.css
├── ARCHITECTURE.md                       # System specification & roadmap
├── DESIGN_SYSTEM.md                      # 240Hz rendering rules, tokens & UX specification
├── UI_UX_REDESIGN.md                     # Detailed rationale & blueprint for the 2-Tab Workbench & Social Network
├── AGENTS.md / CLAUDE.md                 # AI coding guidelines
├── astro.config.mjs                      # Conditional base path ('/' for Capacitor, '/ekwly' for GH Pages)
├── capacitor.config.json                 # Capacitor 8 native configuration
├── package.json                          # Dependencies & build scripts
└── repomix.config.ts                     # Context packing config
```

---

## 4. Database Schema & Indexing Verification Ledger (`schema_dump_3.sql`)

All database tables, views, triggers, RPCs, RLS policies, and indexes are confirmed live in Supabase:

1. **Tables & Columns:**
   - `public.sessions`: `id`, `status`, `pin`, `host_id`, `is_sc_applicable`, `service_charge_rate`, `sc_tax_preset_id`, `discount_type`, `discount_value`, `discount_mode`, `post_tax_discount_type`, `post_tax_discount_value`, `venue_name`, `created_at`, `name`.
   - `public.items`: `id`, `session_id`, `name`, `qty`, `price`, `tax_preset_id`, `apply_sc`, `apply_discount`, `discount_type`, `discount_value`.
   - `public.members`: `id`, `session_id`, `name`, `user_id`, `paid_amount`.
   - `public.claims`: `session_id`, `item_id`, `member_id`, `value` (PK: `item_id, member_id`).
   - `public.tax_presets`: `id`, `session_id`, `name`, `rate`, `split`.
   - `public.ledger`: `id`, `session_id`, `creditor_id`, `debtor_id`, `creditor_fallback_name`, `debtor_fallback_name`, `amount`, `settled`, `created_at`.
   - `public.profiles`: `id`, `name`, `avatar_url`, `upi_id`, `phone`, `email`, `ai_scans_used`, `pro_expires_at`, `last_scan_reset`, `created_at`, `updated_at`.
   - `public.connections`: `user_id`, `friend_id`, `created_at`.
   - `public.venues`: `id`, `name`, `normalized_name`, `service_charge_rate`, `tax_presets`, `times_used`, `last_updated_at`.
2. **Views:**
   - `public.global_ledger`: Aggregates unsettled `public.ledger` rows grouped by debtor and creditor with profile name joins.
   - `public.personal_analytics`: Unions settled debtor shares and host/payer net spend grouped by `user_id` and `venue_name`.
3. **Database Functions & Security Triggers:**
   - `public.harvest_venue_data()` (`SECURITY DEFINER`, `AFTER UPDATE ON public.sessions`): Harvests verified restaurant tax brackets and service charge rates when a session locks.
   - `public.protect_profile_billing_columns()` (`SECURITY DEFINER`, `BEFORE UPDATE ON public.profiles`): Blocks client-side tampering with `pro_expires_at` or `ai_scans_used`.
   - `public.prune_stale_data()` (`SECURITY DEFINER`): Cleans zero/empty claims and abandoned draft sessions older than 30 days.
   - `public.search_venues(search_term)` & `public.search_venue_items(p_venue_name, p_search_term)`: Trigram similarity + `ILIKE` autocomplete RPCs.
   - `public.verify_session_pin(p_session_id, p_pin)` & `public.delete_user_account()`.
4. **14 Active B-Tree & GIN Indexes:**
   - `idx_claims_session_id`, `idx_connections_friend_id`, `idx_connections_unique_pair`, `idx_items_session_id`, `idx_ledger_creditor_unsettled`, `idx_ledger_debtor_unsettled`, `idx_ledger_session_id`, `idx_members_session_id`, `idx_members_user_id`, `idx_profiles_name_trgm` (GIN), `idx_sessions_host_id`, `idx_sessions_venue_name`, `idx_tax_presets_session_id`, `idx_venues_name_trgm` (GIN).

---

## 5. Active Issue Tracker & Resolution Ledger

| Issue ID     | Screen / Component                           | Reported Symptom (Screenshots `1000123496`–`1000123504`)                                                                                    | Root Cause                                                                                                              | Status & Fix Version                                                                                                                                                                           |
| :----------- | :------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------ | :---------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **BUG-01**   | `base.css`, `ReceiptWorkbench.tsx`           | Search icon overlaps `Restaurant / Venue` text; `₹ Unit Pric` placeholder clips; Dish Card tax `<select>` renders as a huge 44px box.       | Unlayered CSS rules in `base.css` beat Tailwind v4 `@layer utilities` (`pl-10`, `h-6`, `w-auto`) in CSS Cascade Layers. | **FIXED (`v0.9.6`)** — Wrapped form resets inside `@layer base` in `src/styles/base.css`.                                                                                                      |
| **BUG-02**   | `AppRouter.tsx`, `ActiveSession.tsx`         | Blank dark gap above the 2-Tab Switcher and `Lakshit paid ₹1384.00` card clipped in half on Tab 2.                                          | `overflow-hidden` on `AppRouter.tsx`'s main wrapper interfered with `sticky top-16` scrolling in mobile WebViews.       | **FIXED (`v0.9.6`)** — Replaced `overflow-hidden` with `overflow-x-clip` and adjusted tab body padding (`pt-4`).                                                                               |
| **BUG-03**   | `Ledger.tsx`                                 | Friend name crushed to `Pri...` and `+ ₹484.41` wrapped onto 2 lines next to `QR`, `Nudge`, and `Settle` buttons.                           | Avatar, name, amount, and 3 action buttons were crammed into a single horizontal flex row.                              | **FIXED (`v0.9.6`)** — Refactored `Ledger.tsx` entries into a 2-row card (Identity + Amount on Row 1; Full-width Action Pills on Row 2).                                                       |
| **UX-01**    | `ReceiptWorkbench.tsx`                       | Custom Tax option and existing tax brackets were hidden inside a truncated dropdown; global Discounts & S.C. were buried at the bottom.     | No top-level summary of active rules; `<select>` truncated tax names on mobile.                                         | **FIXED (`v0.9.6`)** — Added top **Bill Rules, Taxes & Offers Card** + visible 1-Tap Tax Bracket Pills & `+ Custom Tax` button in the Add Dish card.                                           |
| **UX-02**    | `ReceiptWorkbench.tsx`                       | `No Item Offer` dropdown was too large and always visible on the Add Dish form.                                                             | Permanent `w-36` `<select>` occupied 65% of the bottom row.                                                             | **FIXED (`v0.9.6`)** — Replaced with a compact `[+ Item Discount]` toggle chip that hides the `% / ₹` input until toggled on.                                                                  |
| **UX-03**    | `ReceiptWorkbench.tsx`, `components.css`     | Dish cards and receipt breakdown felt like disconnected dark boxes rather than a cohesive bill.                                             | Separate card containers for dishes and summary footer.                                                                 | **FIXED (`v0.9.6`)** — Unified Dish List + Breakdown Footer into a **Skeuomorphic Thermal POS Receipt** (`.pos-receipt`) with serrated edges, perforation notches, and monospace ledger lines. |
| **SEC-01**   | `schema_dump_3.sql`, `capacitor.config.json` | Permissive `USING (true)` RLS policies on session tables; `Public Basic Profile Read` on `profiles`; `cleartext: true` in Capacitor config. | Initial rapid-prototyping RLS policies allowed unauthenticated table tampering.                                         | **OPEN (Scheduled for Milestone 10)** — Granular RLS lockdown, locked-session DB trigger, and `cleartext: false`.                                                                              |
| **BRAND-01** | `BrandLoader.tsx`                            | Current geometric bar SVG is a placeholder logo.                                                                                            | Needs final custom Ekwly multi-path vector mark with `idle`, `loading`, `scanning`, and `success` animation states.     | **OPEN (Scheduled for Milestone 11)** — Custom Ekwly Logo & Multi-State SVG Rig.                                                                                                               |
| **UX-04**    | `SpotlightTour.tsx`, `HelpTip.tsx`           | First-time users lack an interactive guided tour, contextual tooltips, and rolling number animations.                                       | Legacy help banners were removed during the 6-step wizard deprecation.                                                  | **OPEN (Scheduled for Milestone 11)** — 4-Step `<SpotlightTour/>`, contextual `(?)` popovers, and `<AnimatedNumber/>` counters.                                                                |

---

## 6. Updated Master Roadmap to `v1.0.0` (and Post-1.0 Desktop)

- [x] **Milestones 1–9 (`v0.1.0` – `v0.9.5`):** Universal Tax & 3-Layer Discount Engine, Gemini 3.5 Flash-Lite CoT OCR, 14 B-Tree/GIN DB Indexes, 2-Tab Workbench, Host UPI QR, Bilateral Netting, Social Dining Network (`Friends.tsx` 2.0), Lazy WebSockets, and 0ms `swrCache.ts`.
- [x] **Milestone 9.5 (`v0.9.6` — Current):** Mobile PWA Visual Bug Fixes (`BUG-01` to `BUG-03`), Prominent Bill Rules & Tax Pills Bar (`UX-01`, `UX-02`), and **Skeuomorphic Live Thermal POS Receipt** (`UX-03`).
- [ ] **Milestone 10 (`v0.9.7` — Cybersecurity, RLS Lockdown & Razorpay/Play Store Legal Compliance):** Lock down Supabase RLS (`SEC-01`), set `cleartext: false`, add Verified UPI shields, and add Razorpay/Play Store legal clauses to `terms.astro`, `privacy.astro`, `refunds.astro`, and `delete-account.astro`.
- [ ] **Milestone 11 (`v0.9.8` — Custom Ekwly Logo Rig, `<SpotlightTour/>` & 240Hz Micro-Animations):** Replace placeholder logo (`BRAND-01`), add interactive onboarding tour & contextual tooltips (`UX-04`), and add rolling currency counters.
- [ ] **Milestone 12 (`v0.9.9` — Ekwly Pro Expansion & Self-Serve Razorpay Checkout):** WhatsApp Bento Receipt Image Generator (`<canvas>`), Category Spend Audit in `Analytics.tsx`, and `<ProUpgradeSheet/>` (`₹49` Trip Pass, `₹99/mo`, `₹799/yr`).
- [ ] **Milestone 13 (`v1.0.0` — Production Release Packaging & Marketing Kit):** Signed `.aab`/`.apk` builder, Google Play Store listing assets, and "Stop Paying the Teetotaler Tax" marketing campaign.
- [ ] **Milestone 14 (`v1.1.0` — Post-1.0 Desktop Pro Split-Screen Workbench):** Responsive 2-column desktop layout (`lg:grid-cols-12`) with keyboard shortcuts.
