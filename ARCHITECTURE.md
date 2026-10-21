# Ekwly — Architecture, Engineering Standards & Product Roadmap (`ARCHITECTURE.md`)

> **Version:** 0.9.9 (Hardened RLS & Locked-Bill Immutability, Verified UPI Shields, Auto-Detect Service Charge Solver, 3-Layer Discount Engine & 0ms SWR Tab Cache)
> **Repository Visibility:** Private Proprietary Repository
> **Stack:** Astro 7 + React 19 + Tailwind CSS v4 + Supabase (Postgres, Auth, Realtime, Edge Functions) + Capacitor 8 (Android & iOS) + Google Gemini Vision API
> **Package Manager:** `pnpm` (v12+ strictly enforced)
> **Core Constraint:** ₹0 Hosting & Operational Cost Architecture + 60Hz–240Hz Frame-Rate Budget (`<4.1ms/frame`)

---

## 1. System Overview & Core Value Proposition

**Ekwly** is a high-frame-rate (60Hz–240Hz), solo-and-multiplayer restaurant bill-splitting, Indian POS multi-bracket tax routing, and social dining ledger application.

1. **Solo-Host First, Multiplayer Ready:** Optimized for the "Designated Treasurer" who logs and splits a group bill from a paper receipt or memory in under 20 seconds using Zero-Friction Room Entry, a front-and-center AI Magic Bill Scanner, 1-tap Friend/Squad chips, and inline item avatar pills—while seamlessly scaling to live QR multiplayer when friends join.
2. **Multi-Bracket Itemized Taxation:** Routes Food GST (5%), Alcohol VAT (0%–25% state-dependent), Aerated/Sin GST (28%), and Tobacco GST (40%) strictly to the members who consumed those specific items.
3. **3-Layer Simultaneous Discount Pipeline:** Models real-world Indian restaurant bills where Item/Category offers, Selective Pre-Tax Restaurant Discounts (with per-item Alcohol/MRP exclusions), and Post-Tax App/Bank Coupons occur on the same receipt.
4. **Dual Service Charge (S.C.) Topologies with Auto-Detection Solver:**
   - **Model A (`inherit` / Standard Cascading):** Item tax is computed on `(Effective Base + Item S.C.)`.
   - **Model B (`<uuid>` / Global Bracket):** Line items are taxed strictly on `Effective Base`, while aggregated Service Charge is taxed independently under a global preset (such as 5% Food GST).
   - **Model C (`none` / Untaxed):** Service Charge is added flat without additional tax.
   - **Auto-Detect Solver (`WorkbenchRuleDrawers.tsx`):** Computes live rupee previews (`Total Tax` & `Bill Total`) for all 3 models simultaneously and lets the user enter the printed Grand Total from their paper bill to automatically select the exact model used by the restaurant's POS.
5. **AI Receipt OCR ("Magic Scan"):** Client-side `<canvas>` compression (`max 1400px`, `0.82` JPEG) paired with `gemini-3.5-flash-lite` via Supabase Edge Functions using Chain-of-Thought (CoT) math verification and single-shot batch DB insertion.
6. **Social Dining Network & Instant UPI Settlement:** Connects friends via QR/search, suggests past dining companions, manages 1-tap Saved Squads, displays Friendship Dining Dossiers, nets bilateral balances, and settles via native `upi://pay` deep links, Host-screen dynamic UPI QR codes (with anti-spoofing `Verified UPI` badges), and context-aware WhatsApp nudges.

---

## 2. Complete Directory & Module Architecture

```text
├── .github/workflows/
│   ├── deploy.yml                        # CI unit test & static build pipeline
│   └── build-native.yml                  # On-demand manual workflow_dispatch APK & IPA builder
├── .vscode/
│   ├── extensions.json                   # Workspace extension recommendations
│   └── settings.json                     # Formatter, Tailwind, Deno, JDK 21 & Gradle 8.14.3 config
├── astro.config.mjs                      # Conditional Base Path ('/' for Capacitor, '/ekwly' for GH Pages)
├── capacitor.config.json                 # Native Android/iOS WebView container (cleartext: false TLS enforced)
├── repomix.config.ts                     # AI context packing configuration
├── scripts/
│   └── configure-native.mjs              # Auto-links JBR 21/SDK 36, pins Gradle 8.14.3/AGP 8.13.0, patches Manifest/Info.plist & builds APKs
├── supabase/
│   ├── functions/
│   │   ├── scan-receipt/index.ts         # Deno Edge Function: Auth, Quota Reset, Gemini 3.5 Flash-Lite 3-Layer OCR
│   │   └── razorpay-webhook/index.ts     # Deno Edge Function: HMAC-SHA256 verification & Pro activation
│   └── migrations/
│       ├── 20261019_indexes_and_pruning.sql
│       ├── 20261020_multi_layer_discounts.sql
│       └── 20261021_security_rls_lockdown.sql
└── src/
    ├── env.d.ts                          # Global TypeScript declarations & env contracts
    ├── pages/                            # Astro static routes (index, privacy, terms, refunds, delete-account)
    ├── layouts/LegalLayout.astro         # Shared layout for compliance & legal pages
    ├── styles/
    │   ├── global.css                    # Tailwind v4 entry point
    │   ├── theme.css                     # Design tokens (Light/Dark OLED palettes, semantic status colors)
    │   ├── base.css                      # Layered (@layer base) form reset, tabular-nums, .gpu-layer, safe-area
    │   └── components.css                # Custom switches, grid textures, gradients, .pos-receipt tokens
    ├── lib/
    │   ├── types.ts                      # Canonical TypeScript interfaces
    │   ├── supabase.ts                   # Singleton Supabase client
    │   ├── swrCache.ts                   # In-memory Stale-While-Revalidate cache for 0ms BottomDock tab switches
    │   ├── mathEngine.ts                 # 3-Layer Discount, Indian POS Tax, Paisa Conservation & Settlement engine
    │   ├── mathEngine.test.ts            # Vitest unit suite (Model A, Model B, Pre-Tax & 3-Layer Discounts)
    │   ├── splitwiseCsv.ts               # Splitwise CSV parser & greedy pairwise balance extractor
    │   ├── splitwiseCsv.test.ts          # Vitest unit suite for Splitwise CSV migration
    │   ├── useSession.ts                 # Thin composer hook re-exporting sync + mutation sub-hooks
    │   ├── session/                      # Modularized Session Architecture:
    │   │   ├── offlineQueue.ts           # Promise-locked localStorage mutation queue
    │   │   ├── useSessionSync.ts         # Parallel fetch & lazy-activated Realtime WebSocket listeners
    │   │   └── useSessionMutations.ts    # Memoized optimistic UI + batch & offline-aware CRUD mutations
    │   ├── SessionContext.tsx            # React Context provider with verified DB host ownership
    │   ├── pdf.ts                        # Dynamic ESM PDF generator (explicit 'download' & 'share' modes)
    │   ├── utils.ts                      # Fractions, GCD, haptics, UPI URI, WhatsApp, bilateral netting & squads
    │   └── utils.test.ts                 # Vitest unit suite for fractions, GST, UPI, netting & dossier stats
    └── components/
        ├── AppRouter.tsx                 # React.lazy route state machine, Zero-Friction Room Entry & BottomDock
        ├── Auth.tsx                      # Google OAuth, Magic Link OTP confirmation card & Instant Guest CTA
        ├── Home.tsx                      # Dashboard, Netted Ledger hero card, Quick Action Bar & recent rooms
        ├── Analytics.tsx                 # Ekwly Pro Personal Analytics (Top Venues, Debtor Concentration, Quota)
        ├── Lobby.tsx                     # Focused Room Join Gateway (QR Scanner + Room ID & 4-Digit PIN)
        ├── ActiveSession.tsx             # Translucent 2-Tab Session orchestrator + 1-Tap Cashier Payer Chips
        ├── Ledger.tsx                    # Bilaterally netted receivables/payables, UPI QR, WhatsApp & CSV import
        ├── Friends.tsx                   # Social Dining Network: Live Search, Co-Diners, Saved Squads & Dossier
        ├── Profile.tsx                   # Identity, UPI VPA configuration, Personal UPI Receive QR & deletion
        ├── PwaUpdater.tsx                # Service worker lifecycle & update banner
        ├── session/                      # Active room modules:
        │   ├── ReceiptWorkbench.tsx      # Quota-aware Magic Scan Hero, Collapsible Rules, Sawtooth Live Bill Split
        │   ├── WorkbenchRuleDrawers.tsx  # Auto-Detect Service Charge, 3-Layer Discounts & Tax Templates
        │   ├── DebtMatrix.tsx            # Collection Tray, Verified UPI Shields, Host UPI QR modal, PDF actions
        │   ├── MagicScanner.tsx          # Native/Web camera capture, <canvas> compression & batch DB insert
        │   └── Payments.tsx              # Multi-payer restaurant cashier input drawer
        └── ui/                           # Primitives (BottomDock, Portal BottomSheet, BrandLoader, ConfirmSheet, QrScannerModal)
```

---

## 3. Cybersecurity, RLS & Data Integrity Architecture

1. **Transport Security (`capacitor.config.json`):**
   - `cleartext: false` blocks plain HTTP connections inside native Android/iOS WebViews, enforcing HTTPS and WSS over TLS 1.3.
2. **Row Level Security (`20261021_security_rls_lockdown.sql`):**
   - **Host Ownership Enforcement:** Only `sessions.host_id = auth.uid()` can update session rules/status, mutate `items` or `tax_presets`, or delete a session.
   - **Locked-Bill Immutability (`enforce_session_lock_integrity`):** Database trigger prevents any `INSERT`, `UPDATE`, or `DELETE` on `items`, `claims`, and `tax_presets` while `sessions.status = 'locked'`.
   - **Ledger Settlement Guard:** Only the Host, `creditor_id`, or `debtor_id` can toggle `ledger.settled`.
   - **Billing Quota & Pro Status Guard (`protect_profile_billing_columns`):** Prevents any non-`service_role` request from modifying `pro_expires_at` or decrementing `ai_scans_used`.
3. **Anti-Spoofing UPI Verification (`DebtMatrix.tsx`):**
   - Displays a `<ShieldCheck/> Verified UPI` badge when a creditor's VPA is loaded from their authenticated `profiles` row, vs. `Manual Entry` for ad-hoc guest VPAs.

---

## 4. Core Mathematical Specification (`src/lib/mathEngine.ts`)

1. **Layer 1 — Per-Item & Category/Section Discounts (`item.discountType`, `item.discountValue`):**
   - Applied directly to individual items or distributed proportionally across a selected category before Pre-Tax bill discounts.
2. **Layer 2 — Selective Pre-Tax Restaurant Discount (`discountType`, `discountValue`, `item.applyDiscount`):**
   - Scales only items where `applyDiscount !== false` before Service Charge and Taxes.
3. **Service Charge Topologies (`scTaxPresetId`):**
   - `inherit` (Model A): Taxes `(EffectiveBase + ItemSC)` at the item's tax rate.
   - `<uuid>` (Model B): Taxes `EffectiveBase` at the item's tax rate and taxes `ItemSC` at the selected global preset rate.
   - `none` (Model C): Leaves Service Charge untaxed.
4. **Custom Tax Presets & CGST/SGST Split (`preset.split`):**
   - Divides any `split: true` bracket 50/50 into `CGST` and `SGST` lines.
5. **Layer 3 — Simultaneous Post-Tax Coupon/App Discount (`postTaxDiscountType`, `postTaxDiscountValue`):**
   - Subtracted from `GrossTotal` (`Base + SC + Taxes`) before POS rounding.
6. **POS Round-Off & Paisa Conservation Invariant:**
   - `GrandTotal = Math.round(FinalRawTotal)`. Any `±0.01–0.05` floating-point drift is absorbed by the largest share so $\sum_m \text{totalOwed}_m \equiv \text{GrandTotal}$ to the exact paisa.

---

## 5. Master Engineering Roadmap

- [x] **Milestones 1–9.8:** Universal Tax & 3-Layer Discount Engine, Gemini 3.5 Flash-Lite CoT OCR, 14 B-Tree/GIN DB Indexes, 2-Tab Workbench, Sawtooth Live Bill Split, Auto-Detect Service Charge Solver, Host UPI QR, Bilateral Netting, Social Dining Network (`Friends.tsx` 2.0), Lazy WebSockets, Portal Modals, and 0ms `swrCache.ts`.
- [x] **Milestone 10 (`v0.9.9` — Current):** Cybersecurity RLS Lockdown (`20261021_security_rls_lockdown.sql`), Locked-Bill Immutability Trigger, `cleartext: false`, Verified UPI Shields, and Razorpay/Play Store Legal Compliance Pages.
- [ ] **Milestone 11 (`v0.9.95` — Next Up):** Custom Ekwly Logo & Multi-State `<BrandLoader/>` Rig (`idle`, `loading`, `scanning`, `success`), 4-Step `<SpotlightTour/>`, contextual `(?)` coachmarks, and `<AnimatedNumber/>` rolling rupee counters.
- [ ] **Milestone 12 (`v1.0.0-rc1`):** WhatsApp Bento Receipt Card Generator (`<canvas>`), Category Spend Audit in `Analytics.tsx`, and Self-Serve `<ProUpgradeSheet/>` (`₹49` Trip Pass, `₹99/mo`, `₹799/yr`).
- [ ] **Milestone 13 (`v1.0.0`):** Signed `.aab`/`.apk` Release Builder & Google Play Store Launch Kit.
- [ ] **Milestone 14 (`v1.1.0` — Post-1.0):** Desktop Pro Split-Screen Workbench (`lg:grid-cols-12`).
