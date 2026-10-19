# Ekwly — Architecture, Engineering Standards & Product Roadmap

> **Version:** 0.7.5 (Solo-Host Workbench, Host UPI QR, Bilateral Netting & Indexed Schema)
> **Repository Visibility:** Private Proprietary Repository
> **Stack:** Astro 7 + React 19 + Tailwind CSS v4 + Supabase (Postgres, Auth, Realtime, Edge Functions) + Capacitor 8 (Android & iOS) + Google Gemini Vision API
> **Package Manager:** `pnpm` (v12+ strictly enforced)
> **Core Constraint:** ₹0 Hosting & Operational Cost Architecture

---

## 1. System Overview & Core Value Proposition

**Ekwly** is a high-frame-rate (60Hz–240Hz), solo-and-multiplayer bill-splitting, Indian POS tax routing, and social dining ledger application.

1. **Solo-Host First, Multiplayer Ready:** Optimized for the "Designated Treasurer" who logs and splits a group bill from a paper receipt or memory in under 20 seconds using Zero-Friction Room Entry, 1-tap Friend/Squad chips, and inline Dish Card avatar pills—while seamlessly scaling to live QR multiplayer when friends join.
2. **Multi-Bracket Itemized Taxation:** Routes Food GST (5%), Alcohol VAT (0%–25% state-dependent), and Tobacco GST (28%–40%) strictly to the members who consumed those specific items.
3. **Dual Service Charge (S.C.) Topologies:**
   - **Model A (`inherit` / Cascading):** Item tax is computed on `(Effective Base + Item S.C.)`.
   - **Model B (`global` / Independent):** Line items are taxed strictly on `Effective Base`, while aggregated Service Charge is taxed independently under a global preset or left untaxed (`none`).
4. **AI Receipt OCR ("Magic Scan"):** Client-side `<canvas>` compression (`max 1400px`, `0.82` JPEG) paired with `gemini-3.5-flash-lite` via Supabase Edge Functions using Chain-of-Thought (CoT) math verification and single-shot batch DB insertion.
5. **Social Dining Network & Instant UPI Settlement:** Connects friends via QR/search, tracks shared dining history and Saved Squads, nets bilateral balances, and settles via native `upi://pay` deep links, Host-screen dynamic UPI QR codes, and 1-tap WhatsApp nudges.

---

## 2. Directory & Module Architecture

```text
├── .github/workflows/
│   ├── deploy.yml                    # CI test & static build pipeline
│   └── build-native.yml              # On-demand manual workflow_dispatch APK & IPA builder
├── .vscode/
│   ├── extensions.json               # Workspace extension recommendations
│   └── settings.json                 # Formatter, Tailwind, Deno, JDK 21 & Gradle 8.14.3 config
├── astro.config.mjs                  # Conditional Base Path ('/' for Capacitor, '/ekwly' for GH Pages)
├── capacitor.config.json             # Native Android/iOS WebView container settings
├── repomix.config.ts                 # AI context packing configuration
├── scripts/
│   └── configure-native.mjs          # Auto-links JBR 21/SDK & patches AndroidManifest.xml + Info.plist
├── supabase/
│   └── functions/
│       ├── scan-receipt/index.ts     # Deno Edge Function: Auth, Quota Reset, Gemini CoT OCR
│       └── razorpay-webhook/index.ts # Deno Edge Function: HMAC-SHA256 verification & Pro activation
└── src/
    ├── env.d.ts                      # Global TypeScript declarations & env contracts
    ├── pages/                        # Astro static routes (index, privacy, terms, refunds, delete-account)
    ├── layouts/LegalLayout.astro     # Shared layout for compliance & legal pages
    ├── styles/
    │   ├── global.css                # Tailwind v4 entry point
    │   ├── theme.css                 # Design tokens (Light/Dark OLED palettes, semantic status colors)
    │   ├── base.css                  # High-FPS reset, tabular-nums, .gpu-layer, safe-area insets
    │   └── components.css            # Custom switches, grid textures, gradients
    ├── lib/
    │   ├── types.ts                  # Canonical TypeScript interfaces
    │   ├── supabase.ts               # Singleton Supabase client
    │   ├── mathEngine.ts             # Pure deterministic tax, split, paisa-conservation & settlement engine
    │   ├── mathEngine.test.ts        # Vitest unit suite for Model A (TBC 66) & Model B (Chin Lung) receipts
    │   ├── splitwiseCsv.ts           # Splitwise CSV parser & greedy pairwise balance extractor
    │   ├── splitwiseCsv.test.ts      # Vitest unit suite for Splitwise CSV migration
    │   ├── useSession.ts             # Thin composer hook re-exporting sync + mutation sub-hooks
    │   ├── session/                  # Modularized Session Architecture:
    │   │   ├── offlineQueue.ts       # Promise-locked localStorage mutation queue
    │   │   ├── useSessionSync.ts     # Parallel fetch & lazy-activated Realtime WebSocket listeners
    │   │   └── useSessionMutations.ts# Optimistic UI + batch & offline-aware CRUD mutations
    │   ├── SessionContext.tsx        # React Context provider with verified DB host ownership
    │   ├── pdf.ts                    # Dynamic ESM PDF generator + Native Web Share Level 2 file sharing
    │   ├── utils.ts                  # Fractions, GCD, haptics, UPI URI, WhatsApp link & bilateral netting
    │   └── utils.test.ts             # Vitest unit suite for fractional, tax, UPI & bilateral netting math
    └── components/
        ├── AppRouter.tsx             # View state machine, Zero-Friction Room Entry & BottomDock host
        ├── Auth.tsx                  # Google OAuth, Magic Link OTP & Anonymous Guest sign-in
        ├── Home.tsx                  # Dashboard, Netted Global Ledger summary, QR scanner, recent rooms
        ├── Analytics.tsx             # Ekwly Pro Personal Analytics (Top Venues, Debtor Concentration, Quota)
        ├── Lobby.tsx                 # Room joining gateway (ID & 4-digit PIN)
        ├── ActiveSession.tsx         # 2-Tab Session orchestrator + Smart Cashier Default
        ├── Ledger.tsx                # Bilaterally netted receivables/payables, UPI QR, WhatsApp & CSV import
        ├── Friends.tsx               # Social Dining Network: Friend search, Saved Squads, Shared Outings
        ├── Profile.tsx               # Identity, UPI VPA configuration, QR scanner, account deletion
        ├── PwaUpdater.tsx            # Service worker lifecycle & update banner
        ├── session/                  # Active room modules (ReceiptWorkbench, DebtMatrix, MagicScanner, Payments)
        └── ui/                       # Primitives (BottomDock, BottomSheet, BrandLoader, ConfirmSheet, QrScannerModal)
```

---

## 3. Core Mathematical Specification (`src/lib/mathEngine.ts`)

Every UI change **must** preserve 100% of the following mathematical capabilities and invariants:

1. **Pre-Tax vs. Post-Tax Discounts (`flat` ₹ or `percentage` %):**
   - `pre-tax` scales each item's effective base before Service Charge and Taxes are computed.
   - `post-tax` subtracts the discount from `GrossTotal` (`Base + SC + Taxes`) before POS rounding.
2. **Service Charge Topologies & Per-Item Applicability (`applySC`):**
   - Each item can individually toggle `applySC` (`true`/`false`).
   - `scTaxPresetId === 'inherit'` (Model A): Taxes `(EffectiveBase + ItemSC)` at the item's tax rate.
   - `scTaxPresetId === '<uuid>'` (Model B): Taxes `EffectiveBase` at the item's tax rate and taxes `ItemSC` at the selected global preset rate.
   - `scTaxPresetId === 'none'`: Leaves Service Charge untaxed.
3. **Custom Tax Presets & CGST/SGST Split (`preset.split`):**
   - Any tax bracket with `split: true` automatically divides its accumulated amount 50/50 into `CGST` and `SGST` lines.
4. **POS Round-Off & Paisa Conservation Invariant:**
   - `GrandTotal = Math.round(FinalRawTotal)`.
   - When all items are 100% claimed, `sum(totalOwed_m) === GrandTotal` to the exact paisa (`0.01`). Any `±0.01–0.05` floating-point rounding drift is absorbed by the largest share via the Paisa Conservation Pass.

---

## 4. Database Efficiency, Indexing & Realtime WebSocket Architecture

### 4.1 B-Tree & GIN Indexing Strategy (Active in `schema_dump.sql`)

To prevent sequential table scans (`Seq Scan`) on Supabase's free tier:

- All Foreign Keys (`items.session_id`, `members.session_id`, `claims.session_id`, `tax_presets.session_id`, `ledger.session_id`, `sessions.host_id`) are indexed with B-Tree indexes.
- Partial indexes (`WHERE settled = false`) accelerate `global_ledger` queries (`idx_ledger_creditor_unsettled`, `idx_ledger_debtor_unsettled`).
- Trigram GIN indexes (`gin_trgm_ops`) power `<5ms` fuzzy search on `venues.name` (`idx_venues_name_trgm`) and `profiles.name` (`idx_profiles_name_trgm`).
- Unique expression index `LEAST(user_id, friend_id), GREATEST(user_id, friend_id)` (`idx_connections_unique_pair`) on `connections` prevents duplicate bidirectional rows.
- `public.prune_stale_data()` cleans empty claims and abandoned draft rooms older than 30 days.

### 4.2 Lazy Realtime WebSockets

- Because 90%+ of sessions are logged by a Solo Host, Realtime `postgres_changes` subscriptions can operate lazily—activating only when a room is shared (`Invite QR` opened) or when >1 user joins the session, cutting unnecessary WAL decoding and WebSocket echo traffic by 80%+.

---

## 5. Master Engineering Roadmap & Action Plan

### Milestones 1–4: Core Engine, Native Pipeline & 240Hz Foundation (Completed)

- [x] Universal Tax Engine (Model A & B Service Charges, Pre/Post-Tax Discounts, Paisa Conservation).
- [x] Gemini CoT `reasoning` OCR + client-side `<canvas>` compression + `addItemsBatchToDB`.
- [x] Database security triggers (`harvest_venue_data`, `protect_profile_billing_columns`), `prune_stale_data()` + 14 B-Tree/GIN indexes.
- [x] Modularized `useSession` hooks + `<BrandLoader/>` + `<ConfirmSheet/>` + `<BottomDock/>`.
- [x] Native Web Share Level 2 PDF export (`pdf.ts`) + Windows JBR 21/SDK/Gradle 8.14.3 auto-config (`configure-native.mjs`).

### Milestone 5: The Solo-Host-First "2-Tab Live Receipt Workbench" (Completed)

- [x] **Step 5.1 — 1-Tap Friend & Member Bar (`src/components/session/ReceiptWorkbench.tsx`)**: Populate table members in 1 tap from Ekwly `connections` (Friends) or live profile search without typing names manually.
- [x] **Step 5.2 — Interactive Dish Cards (`src/components/session/ReceiptWorkbench.tsx`)**:
  - Inline `[All] [Member...]` avatar pills on each dish card for 1-tap even splitting as the host reads down the receipt.
  - Inline expandable fractional adjuster (`1/4`, `1/3`, `1/2`, `1`, `-`/`+`, custom text) for uneven splits.
  - Inline `[Tax Bracket ▾]` selector and `[+S.C. ✓]` toggle per dish.
- [x] **Step 5.3 — Live Interactive Receipt Footer & Drawers**:
  - Display live Subtotal, Discount, Tax Breakdown, Service Charge, Round Off, and Grand Total directly below the dishes.
  - Tapping the Discount, Service Charge, or Tax lines opens focused `BottomSheet` drawers to adjust `Pre-Tax`/`Post-Tax`, `Inherit`/`Global`/`None` SC taxation, and custom CGST/SGST brackets with instant visual feedback.

### Milestone 6: Instant Settlement, Host Dynamic UPI QR & Bilateral Netting (Completed)

- [x] **Step 6.1 — Smart Cashier Default & Zero-Friction Room Entry (`ActiveSession.tsx`, `AppRouter.tsx`)**: Launch new rooms immediately with a silent 4-digit PIN and default 100% of restaurant cashier payment to the Host when entering `Settle & Collect`, with a 1-tap `"Change Payer"` drawer for multi-payer bills.
- [x] **Step 6.2 — Host-Side Dynamic UPI QR Modal (`DebtMatrix.tsx`)**: `"Show UPI QR"` button on each unsettled debt row rendering a scan-to-pay UPI QR (`upi://pay?pa=...&am=...&cu=INR`) on the Host's screen with inline UPI VPA fallback and 1-tap `"Payment Received — Mark Paid"`.
- [x] **Step 6.3 — Bilateral Netting (`Ledger.tsx`, `Home.tsx`, `utils.ts`)**: Net opposing balances between the same two users (`owedToMe` vs `iOwe`) into a single consolidated balance and settle both directions atomically.

### Milestone 7: The Social Dining Network (`Friends.tsx` 2.0) & Lazy WebSockets (Next Up)

- [ ] **Step 7.1 — Live Friend Search & "People You've Dined With"**: Search registered users by name and suggest connections from past shared sessions.
- [ ] **Step 7.2 — Saved Squads & Friendship Dossier**: Create 1-tap Saved Squads (e.g., `"Friday Crew"`, `"Flatmates"`) and view shared dining stats (total outings together, favorite venue, net balance) when tapping a friend.
- [ ] **Step 7.3 — Lazy Multiplayer WebSockets (`src/lib/session/useSessionSync.ts`)**: Keep Realtime `postgres_changes` dormant during solo-host entry until `"Invite QR"` is opened or >1 user links to the room.
