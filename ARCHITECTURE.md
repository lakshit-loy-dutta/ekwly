# Ekwly — Architecture, Engineering Standards & Product Roadmap (`ARCHITECTURE.md`)

> **Version:** 0.9.92 (Equilibrium Monolith Brand Identity, Hardened RLS & Locked-Bill Immutability, Verified UPI Shields, Auto-Detect Service Charge Solver, 3-Layer Discount Engine & 0ms SWR Tab Cache)
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
│   ├── export-png-and-gif.html           # 1-click browser exporter for PNGs (192, 512, 1024) & 60fps WebM
│   └── svg/                              # 10 production SVG brand marks & wordmarks (Dark, Light, Mono, Animated)
├── scripts/
│   ├── configure-native.mjs              # Auto-links JBR 21/SDK 36, pins Gradle 8.14.3/AGP 8.13.0, patches Manifest/Info.plist & builds APKs
│   └── generate-brand-assets.mjs         # Generates all vector SVGs & the PNG/WebM exporter suite
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
│   ├── layouts/LegalLayout.astro         # Shared layout for compliance & legal pages
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
│       ├── AppRouter.tsx                 # React.lazy route state machine, Zero-Friction Room Entry & BottomDock
│       ├── Auth.tsx                      # Google OAuth, Magic Link OTP confirmation card & Instant Guest CTA
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
├── BRAND_IDENTITY.md                     # Locked v3 logo geometry, colorways & motion choreography spec
├── DESIGN_SYSTEM.md                      # 240Hz rendering rules, tokens & UX specification
├── PROJECT-STATE.md                      # Development handoff & issue tracker ledger
├── UI_UX_REDESIGN.md                     # Rationale & blueprint for the 2-Tab Workbench & Social Network
├── astro.config.mjs                      # Conditional base path ('/' for Capacitor, '/ekwly' for GH Pages)
├── capacitor.config.json                 # Native Android/iOS WebView container (cleartext: false TLS enforced)
├── package.json                          # Dependencies & build scripts
└── repomix.config.ts                     # Context packing config
```

---

## 3. Core Mathematical Specification (`src/lib/mathEngine.ts`)

Every UI component, PDF export, and settlement calculation uses `mathEngine.calculateItemBreakdown` and `mathEngine.generateSplit` as the single source of truth:

1. **Layer 1 — Per-Item & Category/Section Discounts (`item.discountType`, `item.discountValue`):**
   - For each item $i$ with raw base $B_i = \text{qty}_i \times \text{unitPrice}_i$:
     - If `item.discountType === 'percentage'`, $D_{\text{item}, i} = \min(B_i, B_i \times \frac{v_i}{100})$.
     - If `item.discountType === 'flat'`, $D_{\text{item}, i} = \min(B_i, v_i)$.
   - When a flat ₹ discount is applied to a multi-item category in `WorkbenchRuleDrawers.tsx`, it distributes proportionally across the selected items by their share of the category base.
   - Base after item discount: $B'_{i} = \max(0, B_i - D_{\text{item}, i})$.
2. **Layer 2 — Selective Pre-Tax Restaurant Discount (`discountType`, `discountValue`, `item.applyDiscount`):**
   - Eligible pre-tax subtotal: $S_{\text{elig}} = \sum_{i: \text{applyDiscount}_i \neq \text{false}} B'_i$.
   - Pre-tax multiplier: $M_{\text{pre}} = \frac{S_{\text{elig}} - D_{\text{pre}}}{S_{\text{elig}}}$ for eligible items, and $1$ for excluded items (`applyDiscount === false`).
   - Taxable effective base: $E_i = B'_i \times M_{\text{pre}}$.
3. **Service Charge Topologies, Per-Item Applicability (`applySC`) & Auto-Detection:**
   - Item Service Charge: $\text{SC}_i = (\text{isScApplicable} \land \text{applySC}_i) ? E_i \times r_{\text{sc}} : 0$.
   - `scTaxPresetId === 'inherit'` (Model A — Cascading): Taxes $(E_i + \text{SC}_i)$ at the item's tax rate $r_{\text{tax}, i}$.
   - `scTaxPresetId === '<uuid>'` (Model B — Independent Global Bracket): Taxes $E_i$ at $r_{\text{tax}, i}$ and taxes $\text{SC}_i$ at the selected global preset rate $r_{\text{scTax}}$.
   - `scTaxPresetId === 'none'` (Model C — Untaxed): Taxes $E_i$ at $r_{\text{tax}, i}$ and leaves $\text{SC}_i$ untaxed.
   - **Auto-Detection Solver:** Evaluates `generateSplit` across all three topologies (`inherit`, `foodPresetId`, `none`) and selects $\arg\min_{m} \vert{}\text{GrandTotal}_m - \text{PrintedTotal}\vert{}$ when within `₹2.00`.
4. **Custom Tax Presets & CGST/SGST Split (`preset.split`):**
   - Any tax bracket with `split: true` automatically divides its accumulated amount 50/50 into `CGST` and `SGST` lines.
5. **Layer 3 — Simultaneous Post-Tax Coupon/App Discount (`postTaxDiscountType`, `postTaxDiscountValue`):**
   - Gross total before post-tax discount: $G = \sum E_i + \sum \text{SC}_i + \sum \text{Taxes}$.
   - Post-tax discount $D_{\text{post}}$ (`percentage` or `flat`) is subtracted from $G$: $T_{\text{raw}} = G - D_{\text{post}}$.
6. **POS Round-Off & Paisa Conservation Invariant:**
   - $\text{GrandTotal} = \text{Math.round}(T_{\text{raw}})$ and $\text{RoundOff} = \text{GrandTotal} - T_{\text{raw}}$.
   - Individual member shares scale by $\frac{\text{GrandTotal}}{G}$.
   - When all items are 100% claimed, $\sum_m \text{totalOwed}_m \equiv \text{GrandTotal}$ to the exact paisa (`₹0.01`). Any `±0.01–0.05` floating-point drift is absorbed by the member with the largest share via the Paisa Conservation Pass.

---

## 4. Brand Identity & Logo Geometry Architecture (`src/components/ui/BrandLoader.tsx`)

1. **Equilibrium Monolith Icon (`<BrandLogo/>` on `100 × 100` Grid):**
   - All 3 horizontal arms of the `E` and both bars of the negative-space `=` share identical bar height $T = 13.90$ units ($H = 85.50$, $W = 76.50$, Seam $g = 4.00$, Spine Gap $s = 8.50$, Outer Radius $R_{\text{out}} = 12.00$, Inner Concave Fillet $R_{\text{in}} = 7.00$, Pill Tip Radius $r_{\text{tip}} = 6.00$).
2. **Unified Single-SVG Wordmark (`<BrandWordmark/>` on `354 × 100` Grid):**
   - Combines the `E=` monolith with custom rounded-capsule vector paths for `kwly` (`Gap = 3`, `Scale = 109%`, `Y = -8` / `4.09`, `Stroke = 15`) inside a single `<svg>` so Hero and Navbar instances scale in 100% lockstep.
3. **1.0s Magnetic Lock-In Loader (`<BrandLoader/>`):**
   - Animates only the standalone `E=` icon mark across `loading`, `scanning`, and `success` states.

---

## 5. Cybersecurity, RLS & Data Integrity Architecture

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

## 6. Database Efficiency, Indexing & Client Caching Architecture

### 6.1 B-Tree & GIN Indexing Strategy (Active in `schema_dump_3.sql`)

- **B-Tree Foreign Key Indexes:** `idx_items_session_id`, `idx_members_session_id`, `idx_members_user_id`, `idx_claims_session_id`, `idx_tax_presets_session_id`, `idx_ledger_session_id`, `idx_sessions_host_id`, `idx_sessions_venue_name`, `idx_connections_friend_id`.
- **Partial Unsettled Indexes:** `idx_ledger_creditor_unsettled` and `idx_ledger_debtor_unsettled` (`WHERE settled = false`) accelerate `global_ledger` queries.
- **Trigram GIN Indexes (`gin_trgm_ops`):** `idx_venues_name_trgm` and `idx_profiles_name_trgm` power `<5ms` fuzzy search.
- **Bidirectional Uniqueness Index:** `idx_connections_unique_pair` (`LEAST(user_id, friend_id), GREATEST(user_id, friend_id)`) prevents duplicate friendship rows.

### 6.2 Lazy Realtime WebSockets & 0ms SWR Tab Cache

- **Lazy WebSockets (`useSessionSync.ts`):** Realtime `postgres_changes` listeners stay dormant during solo-host entry and activate automatically when `Invite QR` is opened, `Solo Mode` is toggled to `Live Sync`, or >1 user links to the room.
- **Stale-While-Revalidate Tab Cache (`swrCache.ts`):** Caches view state for `Home`, `Ledger`, `Friends`, `Analytics`, and `Profile` in memory so switching tabs on `<BottomDock/>` renders in `0ms` while revalidating silently in the background.

---

## 7. Master Engineering Roadmap

### Completed Milestones (Milestones 1–11 Part 1)

- [x] **Milestones 1–4:** Universal Tax Engine, Gemini CoT OCR, DB security triggers, 14 B-Tree/GIN indexes, `<BottomDock/>`, `<BrandLoader/>`, `<ConfirmSheet/>`, `<QrScannerModal/>`, `Analytics.tsx`, `splitwiseCsv.ts`, and `configure-native.mjs`.
- [x] **Milestone 5:** Solo-Host-First 2-Tab Live Receipt Workbench (`ReceiptWorkbench.tsx`, `WorkbenchRuleDrawers.tsx`, `ActiveSession.tsx`).
- [x] **Milestone 6:** Zero-Friction Room Entry, Smart Cashier Default, Host Dynamic UPI QR Modal (`DebtMatrix.tsx`), and Bilateral Balance Netting (`Ledger.tsx`, `Home.tsx`, `utils.ts`).
- [x] **Milestone 7:** Social Dining Network (`Friends.tsx` 2.0: Live Search, Co-Diners, Saved Squads, Friendship Dossiers) & Lazy Multiplayer WebSockets.
- [x] **Milestone 8:** 3-Layer Simultaneous Discount Engine (Item/Section + Selective Pre-Tax + Post-Tax), `React.lazy` code-splitting, and `Auth.tsx` / `Home.tsx` UX redesign.
- [x] **Milestone 9 – 9.8:** 0ms `swrCache.ts` across all 5 `<BottomDock/>` tabs, React Portal `<BottomSheet/>`, Quota-Aware AI Magic Scan Hero, Inline Community Venue Tray, Segmented Quantity Stepper, Auto-Detect Service Charge Solver, and 32-Tooth SVG Sawtooth `★ LIVE BILL SPLIT ★` Receipt.
- [x] **Milestone 10:** Cybersecurity RLS Lockdown (`20261021_security_rls_lockdown.sql`), Locked-Bill Immutability Trigger, `cleartext: false`, Verified UPI Shields, and Razorpay/Play Store Legal Compliance Pages.
- [x] **Milestone 11 (Part 1):** Locked v3 Equilibrium Monolith `<BrandLogo/>`, Unified Single-SVG `<BrandWordmark/>`, 1.0s Lock-In `<BrandLoader/>`, `BRAND_IDENTITY.md`, and `scripts/generate-brand-assets.mjs`.

### Upcoming Milestones (Milestones 11 Part 2 – 14)

- [ ] **Milestone 11 (Part 2) — `<SpotlightTour/>` & `<AnimatedNumber/>` Rolling Counters:** 4-step interactive onboarding tour for first-time users, contextual `(?)` coachmarks, and 240Hz rolling rupee counters.
- [ ] **Milestone 12 — Ekwly Pro Expansion & Self-Serve Razorpay Checkout:** Client-side `<canvas>` WhatsApp Bento Receipt Card generator, Category Spend Audit in `Analytics.tsx`, and `<ProUpgradeSheet/>` (`₹49` 7-Day Trip Pass, `₹99/mo`, `₹799/yr`).
- [ ] **Milestone 13 — `v1.0.0` Production Release Packaging & Marketing Kit:** Signed `.aab`/`.apk` release builder and Google Play Store launch assets.
- [ ] **Milestone 14 (Post-1.0) — Desktop Pro Split-Screen Workbench:** Responsive 2-column desktop layout (`lg:grid-cols-12`) with keyboard shortcuts.
