# Ekwly — Architecture, Engineering Standards & Product Roadmap

> **Version:** 0.9.5 (2-Tab Workbench, 3-Layer Discount Engine, Host UPI QR, Bilateral Netting, Social Dining Network, Lazy WebSockets & 0ms SWR Tab Cache)
> **Repository Visibility:** Private Proprietary Repository
> **Stack:** Astro 7 + React 19 + Tailwind CSS v4 + Supabase (Postgres, Auth, Realtime, Edge Functions) + Capacitor 8 (Android & iOS) + Google Gemini Vision API
> **Package Manager:** `pnpm` (v12+ strictly enforced)
> **Core Constraint:** ₹0 Hosting & Operational Cost Architecture

---

## 1. System Overview & Core Value Proposition

**Ekwly** is a high-frame-rate (60Hz–240Hz), solo-and-multiplayer bill-splitting, Indian POS tax routing, and social dining ledger application.

1. **Solo-Host First, Multiplayer Ready:** Optimized for the "Designated Treasurer" who logs and splits a group bill from a paper receipt or memory in under 20 seconds using Zero-Friction Room Entry, 1-tap Friend/Squad chips, and inline Dish Card avatar pills—while seamlessly scaling to live QR multiplayer when friends join.
2. **Multi-Bracket Itemized Taxation:** Routes Food GST (5%), Alcohol VAT (0%–25% state-dependent), and Tobacco GST (28%–40%) strictly to the members who consumed those specific items.
3. **3-Layer Simultaneous Discount Pipeline:** Models real-world Indian restaurant bills where Item/Section offers (e.g., Happy Hour Beer or 50% off Dessert), Selective Pre-Tax Restaurant Discounts (e.g., 15% off Food only, excluding Alcohol), and Post-Tax App/Bank Coupons (e.g., Swiggy Dineout / Zomato Gold) occur on the same receipt.
4. **Dual Service Charge (S.C.) Topologies:**
   - **Model A (`inherit` / Cascading):** Item tax is computed on `(Effective Base + Item S.C.)`.
   - **Model B (`global` / Independent):** Line items are taxed strictly on `Effective Base`, while aggregated Service Charge is taxed independently under a global preset or left untaxed (`none`).
5. **AI Receipt OCR ("Magic Scan"):** Client-side `<canvas>` compression (`max 1400px`, `0.82` JPEG) paired with `gemini-3.5-flash-lite` via Supabase Edge Functions using Chain-of-Thought (CoT) math verification and single-shot batch DB insertion.
6. **Social Dining Network & Instant UPI Settlement:** Connects friends via QR/search, suggests past dining companions, manages 1-tap Saved Squads, displays Friendship Dining Dossiers, nets bilateral balances, and settles via native `upi://pay` deep links, Host-screen dynamic UPI QR codes, and 1-tap WhatsApp nudges.

---

## 2. Directory & Module Architecture

```text
├── .github/workflows/
│   ├── deploy.yml                        # CI test & static build pipeline
│   └── build-native.yml                  # On-demand manual workflow_dispatch APK & IPA builder
├── .vscode/
│   ├── extensions.json                   # Workspace extension recommendations
│   └── settings.json                     # Formatter, Tailwind, Deno, JDK 21 & Gradle 8.14.3 config
├── astro.config.mjs                      # Conditional Base Path ('/' for Capacitor, '/ekwly' for GH Pages)
├── capacitor.config.json                 # Native Android/iOS WebView container settings
├── repomix.config.ts                     # AI context packing configuration
├── scripts/
│   └── configure-native.mjs              # Auto-links JBR 21/SDK 36 & patches AndroidManifest.xml + Info.plist
├── supabase/
│   ├── functions/
│   │   ├── scan-receipt/index.ts         # Deno Edge Function: Auth, Quota Reset, Gemini 3.5 Flash-Lite 3-Layer OCR
│   │   └── razorpay-webhook/index.ts     # Deno Edge Function: HMAC-SHA256 verification & Pro activation
│   └── migrations/                       # SQL schema migrations (B-Tree/GIN indexes, pruning, 3-layer discounts)
└── src/
    ├── env.d.ts                          # Global TypeScript declarations & env contracts
    ├── pages/                            # Astro static routes (index, privacy, terms, refunds, delete-account)
    ├── layouts/LegalLayout.astro         # Shared layout for compliance & legal pages
    ├── styles/
    │   ├── global.css                    # Tailwind v4 entry point
    │   ├── theme.css                     # Design tokens (Light/Dark OLED palettes, semantic status colors)
    │   ├── base.css                      # Zero-specificity (:where) reset, tabular-nums, .gpu-layer, safe-area
    │   └── components.css                # Custom switches, grid textures, gradients
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
    │   ├── pdf.ts                        # Dynamic ESM PDF generator + Native Web Share Level 2 file sharing
    │   ├── utils.ts                      # Fractions, GCD, haptics, UPI URI, WhatsApp, bilateral netting & squads
    │   └── utils.test.ts                 # Vitest unit suite for fractions, GST, UPI, netting & dossier stats
    └── components/
        ├── AppRouter.tsx                 # React.lazy route state machine, Zero-Friction Room Entry & BottomDock
        ├── Auth.tsx                      # Google OAuth, Magic Link OTP confirmation card & Instant Guest CTA
        ├── Home.tsx                      # Dashboard, Netted Ledger hero card, Quick Action Bar & recent rooms
        ├── Analytics.tsx                 # Ekwly Pro Personal Analytics (Top Venues, Debtor Concentration, Quota)
        ├── Lobby.tsx                     # Focused Room Join Gateway (QR Scanner + Room ID & 4-Digit PIN)
        ├── ActiveSession.tsx             # 2-Tab Session orchestrator + Smart Cashier Default
        ├── Ledger.tsx                    # Bilaterally netted receivables/payables, UPI QR, WhatsApp & CSV import
        ├── Friends.tsx                   # Social Dining Network: Live Search, Co-Diners, Saved Squads & Dossier
        ├── Profile.tsx                   # Identity, UPI VPA configuration, Personal UPI Receive QR & deletion
        ├── PwaUpdater.tsx                # Service worker lifecycle & update banner
        ├── session/                      # Active room modules (ReceiptWorkbench, WorkbenchRuleDrawers, DebtMatrix, MagicScanner, Payments)
        └── ui/                           # Primitives (BottomDock, BottomSheet, BrandLoader, ConfirmSheet, QrScannerModal)
```

---

## 3. Core Mathematical Specification (`src/lib/mathEngine.ts`)

Every UI component, PDF export, and settlement calculation uses `mathEngine.calculateItemBreakdown` and `mathEngine.generateSplit` as the single source of truth:

1. **Layer 1 — Per-Item & Section/Category Discounts (`item.discountType`, `item.discountValue`):**
   - For each item $i$ with raw base $B_i = \text{qty}_i \times \text{unitPrice}_i$:
     - If `item.discountType === 'percentage'`, $D_{\text{item}, i} = \min(B_i, B_i \times \frac{v_i}{100})$.
     - If `item.discountType === 'flat'`, $D_{\text{item}, i} = \min(B_i, v_i)$.
   - When a flat ₹ discount is applied to a multi-item section in `WorkbenchRuleDrawers.tsx`, it distributes proportionally across the selected items by their share of the section base.
   - Base after item discount: $B'_{i} = \max(0, B_i - D_{\text{item}, i})$.
2. **Layer 2 — Selective Pre-Tax Restaurant Discount (`discountType`, `discountValue`, `item.applyDiscount`):**
   - Eligible pre-tax subtotal: $S_{\text{elig}} = \sum_{i: \text{applyDiscount}_i \neq \text{false}} B'_i$.
   - Pre-tax multiplier: $M_{\text{pre}} = \frac{S_{\text{elig}} - D_{\text{pre}}}{S_{\text{elig}}}$ for eligible items, and $1$ for excluded items (`applyDiscount === false`).
   - Taxable effective base: $E_i = B'_i \times M_{\text{pre}}$.
3. **Service Charge Topologies & Per-Item Applicability (`applySC`):**
   - Item Service Charge: $\text{SC}_i = (\text{isScApplicable} \land \text{applySC}_i) ? E_i \times r_{\text{sc}} : 0$.
   - `scTaxPresetId === 'inherit'` (Model A — Cascading): Taxes $(E_i + \text{SC}_i)$ at the item's tax rate $r_{\text{tax}, i}$.
   - `scTaxPresetId === '<uuid>'` (Model B — Independent): Taxes $E_i$ at $r_{\text{tax}, i}$ and taxes $\text{SC}_i$ at the selected global preset rate $r_{\text{scTax}}$.
   - `scTaxPresetId === 'none'`: Taxes $E_i$ at $r_{\text{tax}, i}$ and leaves $\text{SC}_i$ untaxed.
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

## 4. Database Efficiency, Indexing & Client Caching Architecture

### 4.1 B-Tree & GIN Indexing Strategy (Active in `schema_dump_3.sql`)

- **B-Tree Foreign Key Indexes:** `idx_items_session_id`, `idx_members_session_id`, `idx_members_user_id`, `idx_claims_session_id`, `idx_tax_presets_session_id`, `idx_ledger_session_id`, `idx_sessions_host_id`, `idx_sessions_venue_name`, `idx_connections_friend_id`.
- **Partial Unsettled Indexes:** `idx_ledger_creditor_unsettled` and `idx_ledger_debtor_unsettled` (`WHERE settled = false`) accelerate `global_ledger` queries.
- **Trigram GIN Indexes (`gin_trgm_ops`):** `idx_venues_name_trgm` and `idx_profiles_name_trgm` power `<5ms` fuzzy search.
- **Bidirectional Uniqueness Index:** `idx_connections_unique_pair` (`LEAST(user_id, friend_id), GREATEST(user_id, friend_id)`) prevents duplicate friendship rows.

### 4.2 Lazy Realtime WebSockets & 0ms SWR Tab Cache

- **Lazy WebSockets (`useSessionSync.ts`):** Realtime `postgres_changes` listeners stay dormant during solo-host entry and activate automatically when `Invite QR` is opened, `Solo Mode` is toggled to `Live Sync`, or >1 user links to the room.
- **Stale-While-Revalidate Tab Cache (`swrCache.ts`):** Caches view state for `Home`, `Ledger`, `Friends`, `Analytics`, and `Profile` in memory so switching tabs on `<BottomDock/>` renders in `0ms` while revalidating silently in the background.

---

## 5. Master Engineering Roadmap

### Completed Milestones (Milestones 1–9)

- [x] **Milestones 1–4:** Universal Tax Engine, Gemini CoT OCR, DB security triggers, 14 B-Tree/GIN indexes, `<BottomDock/>`, `<BrandLoader/>`, `<ConfirmSheet/>`, `<QrScannerModal/>`, `Analytics.tsx`, `splitwiseCsv.ts`, and `configure-native.mjs`.
- [x] **Milestone 5:** Solo-Host-First 2-Tab Live Receipt Workbench (`ReceiptWorkbench.tsx`, `WorkbenchRuleDrawers.tsx`, `ActiveSession.tsx`).
- [x] **Milestone 6:** Zero-Friction Room Entry, Smart Cashier Default, Host Dynamic UPI QR Modal (`DebtMatrix.tsx`), and Bilateral Balance Netting (`Ledger.tsx`, `Home.tsx`, `utils.ts`).
- [x] **Milestone 7:** Social Dining Network (`Friends.tsx` 2.0: Live Search, Co-Diners, Saved Squads, Friendship Dossiers) & Lazy Multiplayer WebSockets.
- [x] **Milestone 8:** 3-Layer Simultaneous Discount Engine (Item/Section + Selective Pre-Tax + Post-Tax), `React.lazy` code-splitting, and `Auth.tsx` / `Home.tsx` UX redesign.
- [x] **Milestone 9:** 0ms `swrCache.ts` across all 5 `<BottomDock/>` tabs, `Profile.tsx` & `Lobby.tsx` UX overhaul, `scan-receipt` Edge Function deployment, and verified Android APK build.

### Upcoming Milestones (Milestones 10–12 to `v1.0.0`)

- [ ] **Milestone 10 — Self-Serve Razorpay Checkout Integration (`src/lib/razorpay.ts`, `Analytics.tsx`, `MagicScanner.tsx`):** Replace `mailto:` upgrade placeholders with an interactive 3-plan selector (`₹49 7-Day Trip Pass`, `₹99/mo Pro`, `₹799/yr Pro`) launching Razorpay Checkout wired to `razorpay-webhook`.
- [ ] **Milestone 11 — Offline Status Indicator & Automated DB Hygiene:** Add a live offline/syncing indicator pill in `AppRouter.tsx` when `!navigator.onLine` and wire periodic `prune_stale_data()` execution.
- [ ] **Milestone 12 — v1.0 Production Release & Store Packaging:** Add Android release keystore signing (`assembleRelease` / `bundleRelease` `.aab`) to `scripts/configure-native.mjs` and finalize production deployment configuration.
