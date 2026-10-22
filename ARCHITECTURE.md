# Ekwly — Architecture, Engineering Standards & Product Roadmap (`ARCHITECTURE.md`)

> **Version:** 0.9.93 (Maskable Safe-Zone App Icons, Unified `[E=]kwly` Header Wordmarks, Hardened RLS & Locked-Bill Immutability, Auto-Detect Service Charge Solver, 3-Layer Discount Engine & 0ms SWR Tab Cache)
> **Repository Visibility:** Private Proprietary Repository
> **Stack:** Astro 7 + React 19 + Tailwind CSS v4 + Supabase (Postgres, Auth, Realtime, Edge Functions) + Capacitor 8 (Android & iOS) + Google Gemini Vision API
> **Package Manager:** `pnpm` (v12+ strictly enforced)
> **Core Constraint:** ₹0 Hosting & Operational Cost Architecture + 60Hz–240Hz Frame-Rate Budget (`<4.1ms/frame`)

---

## 1. System Overview & Core Value Proposition

**Ekwly** is a high-frame-rate (60Hz–240Hz), solo-and-multiplayer restaurant bill-splitting, Indian POS multi-bracket tax routing, and social dining ledger application.

1. **Solo-Host First, Multiplayer Ready:** Optimized for the "Designated Treasurer" who logs and splits a group bill from a paper receipt or memory in under 20 seconds using Zero-Friction Room Entry, a front-and-center AI Magic Bill Scanner, 1-tap Friend/Squad chips, and inline item avatar pills—while seamlessly scaling to live QR multiplayer when friends join.
2. **Multi-Bracket Itemized Taxation:** Routes Food GST (5%), Alcohol VAT (0%–25% state-dependent), Aerated/Sin GST (28%), and Tobacco GST (40%) strictly to the members who consumed those specific items.
3. **3-Layer Simultaneous Discount Pipeline:** Models real-world Indian restaurant bills where Item/Category offers (e.g., Happy Hour Beer or 50% off Dessert), Selective Pre-Tax Restaurant Discounts (e.g., 15% off Food only, excluding Alcohol), and Post-Tax App/Bank Coupons (e.g., Swiggy Dineout / Zomato Gold) occur on the same receipt.
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
├── brand-kit/
│   ├── export-png-and-gif.html           # 1-click browser exporter for ICO, Maskable PNGs & 60fps WebM
│   └── svg/                              # 14 production SVG brand marks, wordmarks & 3 loader animations
├── scripts/
│   ├── configure-native.mjs              # Auto-links JBR 21/SDK 36, pins Gradle 8.14.3/AGP 8.13.0, patches Manifest/Info.plist & builds APKs
│   └── generate-brand-assets.mjs         # Generates all vector SVGs, multi-size .ICO packer & Safe-Zone PNG exporter
├── supabase/
│   ├── functions/
│   │   ├── scan-receipt/index.ts         # Deno Edge Function: Auth, Quota Reset, Gemini 3.5 Flash-Lite 3-Layer OCR
│   │   └── razorpay-webhook/index.ts     # Deno Edge Function: HMAC-SHA256 verification & Pro activation
│   └── migrations/
│       ├── 20261019_indexes_and_pruning.sql
│       ├── 20261020_multi_layer_discounts.sql
│       └── 20261021_security_rls_lockdown.sql
├── src/
│   ├── env.d.ts                          # Global TypeScript declarations & env contracts
│   ├── pages/                            # Astro static routes (index, privacy, terms, refunds, delete-account)
│   ├── layouts/LegalLayout.astro         # Shared layout for compliance & legal pages with [E=]kwly wordmark header
│   ├── styles/
│   │   ├── global.css                    # Tailwind v4 entry point
│   │   ├── theme.css                     # Design tokens (Light/Dark OLED palettes, --brand-kwly, status colors)
│   │   ├── base.css                      # Layered (@layer base) form reset, tabular-nums, .gpu-layer, safe-area
│   │   └── components.css                # Custom switches, grid textures, gradients, .pos-receipt tokens
│   ├── lib/
│   │   ├── types.ts                      # Canonical TypeScript interfaces
│   │   ├── supabase.ts                   # Singleton Supabase client
│   │   ├── swrCache.ts                   # In-memory Stale-While-Revalidate cache for 0ms BottomDock tab switches
│   │   ├── mathEngine.ts                 # 3-Layer Discount, Indian POS Tax, Paisa Conservation & Settlement engine
│   │   ├── mathEngine.test.ts            # Vitest unit suite (Model A, Model B, Pre-Tax & 3-Layer Discounts)
│   │   ├── splitwiseCsv.ts               # Splitwise CSV parser & greedy pairwise balance extractor
│   │   ├── splitwiseCsv.test.ts          # Vitest unit suite for Splitwise CSV migration
│   │   ├── useSession.ts                 # Thin composer hook re-exporting sync + mutation sub-hooks
│   │   ├── session/                      # Modularized Session Architecture:
│   │   │   ├── offlineQueue.ts           # Promise-locked localStorage mutation queue
│   │   │   ├── useSessionSync.ts         # Parallel fetch & lazy-activated Realtime WebSocket listeners
│   │   │   └── useSessionMutations.ts    # Memoized optimistic UI + batch & offline-aware CRUD mutations
│   │   ├── SessionContext.tsx            # React Context provider with verified DB host ownership
│   │   ├── pdf.ts                        # Dynamic ESM PDF generator (explicit 'download' & 'share' modes)
│   │   ├── utils.ts                      # Fractions, GCD, haptics, UPI URI, WhatsApp, bilateral netting & squads
│   │   └── utils.test.ts                 # Vitest unit suite for fractions, GST, UPI, netting & dossier stats
│   └── components/
│       ├── AppRouter.tsx                 # React.lazy route state machine, <BrandWordmark/> header & BottomDock
│       ├── Auth.tsx                      # <BrandWordmark/> hero, Google OAuth, Magic Link OTP & Guest CTA
│       ├── Home.tsx                      # Dashboard, Netted Ledger hero card, Quick Action Bar & recent rooms
│       ├── Analytics.tsx                 # Ekwly Pro Personal Analytics (Top Venues, Debtor Concentration, Quota)
│       ├── Lobby.tsx                     # Focused Room Join Gateway (QR Scanner + Room ID & 4-Digit PIN)
│       ├── ActiveSession.tsx             # Translucent 2-Tab Session orchestrator + 1-Tap Cashier Payer Chips
│       ├── Ledger.tsx                    # Bilaterally netted receivables/payables, UPI QR, WhatsApp & CSV import
│       ├── Friends.tsx                   # Social Dining Network: Live Search, Co-Diners, Saved Squads & Dossier
│       ├── Profile.tsx                   # Identity, UPI VPA configuration, Personal UPI Receive QR & deletion
│       ├── PwaUpdater.tsx                # Service worker lifecycle & update banner
│       ├── session/                      # Active room modules:
│       │   ├── ReceiptWorkbench.tsx      # Quota-aware Magic Scan Hero, Collapsible Rules, Sawtooth Live Bill Split
│       │   ├── WorkbenchRuleDrawers.tsx  # Auto-Detect Service Charge, 3-Layer Discounts & Tax Templates
│       │   ├── DebtMatrix.tsx            # Collection Tray, Verified UPI Shields, Host UPI QR modal, PDF actions
│       │   ├── MagicScanner.tsx          # Native/Web camera capture, <canvas> compression & batch DB insert
│       │   └── Payments.tsx              # Multi-payer restaurant cashier input drawer
│       └── ui/                           # Primitives (BottomDock, Portal BottomSheet, BrandLoader, ConfirmSheet, QrScannerModal)
├── ARCHITECTURE.md                       # Authoritative system specification & roadmap
├── BRAND_IDENTITY.md                     # Locked v3 logo geometry, safe-zone icon rules & motion choreography
├── DESIGN_SYSTEM.md                      # 240Hz rendering rules, tokens & UX specification
├── PROJECT-STATE.md                      # Development handoff & issue tracker ledger
├── astro.config.mjs                      # Conditional base path & PWA manifest (explicit 'any' + 'maskable' icons)
├── capacitor.config.json                 # Native Android/iOS WebView container (cleartext: false TLS enforced)
├── package.json                          # Dependencies & build scripts
└── repomix.config.ts                     # Context packing config
```

---

## 3. Brand Identity, Maskable Safe-Zone & Wordmark Architecture (`src/components/ui/BrandLoader.tsx`)

1. **Equilibrium Monolith Icon (`<BrandLogo/>` on `100 × 100` Grid):**
   - Master Path (`EKWLY_E_PATH`): $T = 13.90$, $H = 85.50$, $W = 76.50$, Seam $g = 4.00$, Spine Gap $s = 8.50$, Outer Radius $R_{\text{out}} = 12.00$, Inner Fillet $R_{\text{in}} = 7.00$, Pill Tip Radius $r_{\text{tip}} = 6.00$.
   - **In-App Squircle Badge (`boxed={true}`):** Applies `transform="translate(12, 12) scale(0.76)"` inside the `96 × 96` (`rx="24"`) squircle so the `E=` has balanced margin from the border.
   - **Android/iOS Maskable App Icons (`icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, `ekwly-icon-1024.png`):** Generated via `scripts/generate-brand-assets.mjs` with a full-bleed `100 × 100` (`rx="0"`) background and `transform="translate(19, 19) scale(0.62)"`. This keeps the outermost point of the `E=` at `31.8` units from `(50, 50)`—well inside the W3C `40`-unit maskable safe zone so circular and adaptive phone launchers never clip the logo.
2. **Unified Single-SVG Wordmark (`<BrandWordmark/>` on `354 × 114` Grid):**
   - Renders the `1.0x` unboxed `E=` monolith alongside custom rounded-capsule vector strokes for `kwly` (`Gap = 3`, `Scale = 109%`, `Y = -8` / `4.09`, `Stroke = 15`) inside a single `viewBox="0 0 354 114"` SVG so the `y` descender ($Y_{\max} = 109.82$) is never clipped.
   - Deployed in `AppRouter.tsx` (top navbar), `Auth.tsx` (sign-in hero), and `LegalLayout.astro` (legal pages).
3. **3-Mode Animated Loader (`<BrandLoader/>`):**
   - Animates only the standalone `E=` icon mark across `lockin` (`1.0s` Magnetic Lock-In), `equalizer` (`1.0s` Counter-Phase Equalizer), `scan` (`1.2s` AI Laser Scan), and `success` states.

---

## 4. Core Mathematical Specification (`src/lib/mathEngine.ts`)

1. **Layer 1 — Per-Item & Category/Section Discounts (`item.discountType`, `item.discountValue`):**
   - Subtracted from raw item base $B_i = \text{qty}_i \times \text{unitPrice}_i$ before Pre-Tax bill discounts.
2. **Layer 2 — Selective Pre-Tax Restaurant Discount (`discountType`, `discountValue`, `item.applyDiscount`):**
   - Scales only eligible items (`applyDiscount !== false`) via multiplier $M_{\text{pre}} = \frac{S_{\text{elig}} - D_{\text{pre}}}{S_{\text{elig}}}$.
3. **Service Charge Topologies (`scTaxPresetId`) & Auto-Detection:**
   - `inherit` (Model A): Taxes $(E_i + \text{SC}_i)$ at item tax rate $r_{\text{tax}, i}$.
   - `<uuid>` (Model B): Taxes $E_i$ at $r_{\text{tax}, i}$ and taxes $\text{SC}_i$ at global preset rate $r_{\text{scTax}}$.
   - `none` (Model C): Leaves $\text{SC}_i$ untaxed.
4. **Layer 3 — Simultaneous Post-Tax Coupon/App Discount (`postTaxDiscountType`, `postTaxDiscountValue`):**
   - Subtracted from Gross Total $G = \sum E_i + \sum \text{SC}_i + \sum \text{Taxes}$ before POS rounding.
5. **POS Round-Off & Paisa Conservation Invariant:**
   - $\text{GrandTotal} = \text{Math.round}(G - D_{\text{post}})$, with any `±0.01–0.05` drift absorbed by the largest share so $\sum_m \text{totalOwed}_m \equiv \text{GrandTotal}$.

---

## 5. Master Engineering Roadmap

- [x] **Milestones 1–10 (`v0.1.0` – `v0.9.9`):** Universal Tax & 3-Layer Discount Engine, Gemini 3.5 Flash-Lite CoT OCR, 14 B-Tree/GIN DB Indexes, 2-Tab Workbench, 32-Tooth SVG Sawtooth Live Bill Split, Auto-Detect Service Charge Solver, Host UPI QR, Bilateral Netting, Social Dining Network (`Friends.tsx` 2.0), Lazy WebSockets, Portal Modals, 0ms `swrCache.ts`, Hardened RLS, Locked-Bill Immutability Trigger, and Legal Compliance Pages.
- [x] **Milestone 11 — Part 1 (`v0.9.93` — Brand Identity, Maskable Safe-Zone Icons & Wordmark Integration):** Completed.
- [ ] **Milestone 11 — Part 2 (`v0.9.95` — Next Up):** 4-Step Interactive `<SpotlightTour/>` for first-time users and `<AnimatedNumber/>` 240Hz rolling rupee counters.
- [ ] **Milestone 12 (`v1.0.0-rc1`):** WhatsApp Bento Receipt Card Generator (`<canvas>`), Category Spend Audit in `Analytics.tsx`, and Self-Serve `<ProUpgradeSheet/>` (`₹49` Trip Pass, `₹99/mo`, `₹799/yr`).
- [ ] **Milestone 13 (`v1.0.0`):** Signed `.aab`/`.apk` Release Builder & Google Play Store Launch Kit.
- [ ] **Milestone 14 (`v1.1.0` — Post-1.0):** Desktop Pro Split-Screen Workbench (`lg:grid-cols-12`).
