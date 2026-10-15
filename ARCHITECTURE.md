# Ekwly — Architecture, Engineering Standards & Product Roadmap

> **Version:** 0.5.0 (Milestone 3 Completed: Production-Ready Release Candidate)
> **Stack:** Astro 7 + React 19 + Tailwind CSS v4 + Supabase (Postgres, Auth, Realtime, Edge Functions) + Capacitor 8 (Android & iOS) + Google Gemini Vision API

---

## 1. System Overview & Core Value Proposition

**Ekwly** is a real-time, multiplayer bill-splitting and debt-settlement engine built specifically for the Indian dining and group-expense ecosystem. Unlike generic splitters that divide totals evenly or apply taxes as a flat percentage across a bill, Ekwly models the exact accounting logic of Indian Point-of-Sale (POS) systems:

1. **Multi-Bracket Itemized Taxation:** Routes Food GST (5%), Alcohol VAT (0%–25% state-dependent), and Tobacco GST (28%–40%) strictly to the members who consumed those specific items.
2. **Dual Service Charge (S.C.) Topologies:**
   - **Model A (`inherit` / Cascading):** Item tax is computed on `(Effective Base + Item S.C.)`. Common in restobars where Service Charge is bundled per line item before VAT/GST.
   - **Model B (`global` / Independent):** Line items are taxed strictly on `Effective Base`, while the aggregated Service Charge is taxed independently under a global preset (typically 5% GST) or left untaxed (`none`).
3. **AI Receipt OCR ("Magic Scan"):** Powered by `gemini-3.5-flash-lite` via Supabase Edge Functions with Chain-of-Thought (CoT) mathematical self-verification and automatic wizard progression.
4. **Zero-Install Multiplayer, UPI Deep-Links & WhatsApp Nudges:** Guests join rooms via QR/PIN without downloading an app, claim fractional shares in real time using 1-tap fraction pills, and settle via native `upi://pay` deep links or 1-tap WhatsApp reminders.

---

## 2. Directory & Module Architecture

```text
├── astro.config.mjs                  # Conditional Base Path ('/' for Capacitor, '/ekwly' for GH Pages)
├── capacitor.config.json             # Native Android/iOS WebView container settings
├── repomix.config.ts                 # AI context packing configuration
├── scripts/
│   └── configure-native.mjs          # Auto-patches AndroidManifest.xml & iOS Info.plist on build:mobile
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
    │   ├── base.css                  # Reset, tabular-nums typography, native safe-area insets
    │   └── components.css            # Custom switches, grid textures, gradients
    ├── lib/
    │   ├── types.ts                  # Canonical TypeScript interfaces (including DatabaseSession)
    │   ├── supabase.ts               # Singleton Supabase client
    │   ├── mathEngine.ts             # Pure deterministic tax, split, paisa-conservation & settlement engine
    │   ├── mathEngine.test.ts        # Vitest unit suite for Model A (TBC 66) & Model B (Chin Lung) receipts
    │   ├── splitwiseCsv.ts           # Splitwise CSV parser & greedy pairwise balance extractor
    │   ├── splitwiseCsv.test.ts      # Vitest unit suite for Splitwise CSV migration
    │   ├── useSession.ts             # Thin composer hook re-exporting sync + mutation sub-hooks
    │   ├── session/                  # Modularized Session Architecture:
    │   │   ├── offlineQueue.ts       # Promise-locked localStorage mutation queue
    │   │   ├── useSessionSync.ts     # Initial parallel fetch & Realtime WebSocket listeners
    │   │   └── useSessionMutations.ts# Optimistic UI + offline-aware CRUD mutations
    │   ├── SessionContext.tsx        # React Context provider for active room state
    │   ├── pdf.ts                    # On-demand dynamic ESM PDF generator (jsPDF + AutoTable)
    │   ├── utils.ts                  # Fraction parser, GCD formatter, resolvePath, WhatsApp link builder
    │   └── utils.test.ts             # Vitest unit suite for fractional and tax math
    └── components/
        ├── AppRouter.tsx             # View state machine, @capacitor/app back-button & deep-link router
        ├── Auth.tsx                  # Google OAuth, Magic Link OTP & Anonymous Guest sign-in
        ├── Home.tsx                  # Dashboard, Global Ledger summary, QR room scanner, recent rooms
        ├── Analytics.tsx             # Ekwly Pro Personal Analytics (Top Venues, Debtor Concentration, Quota)
        ├── Lobby.tsx                 # Room creation (PIN generation) & Room joining gateway
        ├── ActiveSession.tsx         # 6-step wizard orchestrator & bottom progress stepper
        ├── Ledger.tsx                # Global receivables/payables, WhatsApp nudges & Splitwise CSV importer
        ├── Friends.tsx               # Network connections, QR scanner & personal QR invite links
        ├── Profile.tsx               # Identity, UPI VPA configuration, QR scanner, account deletion
        ├── PwaUpdater.tsx            # Service worker lifecycle & update banner
        ├── session/                  # The 6 Wizard Steps:
        │   ├── SessionRules.tsx      # Step 1: Venue lookup, MagicScanner, SC, Discounts, Tax Presets
        │   ├── MagicScanner.tsx      # Step 1 Sub-module: Camera/Gallery capture & AI Edge invocation
        │   ├── ReceiptEditor.tsx     # Step 2: Line-item CRUD, menu autocomplete, live item total preview
        │   ├── MembersList.tsx       # Step 3: Guest addition, profile search, slot claiming
        │   ├── QuickSplit.tsx        # Step 4 Sub-module: 1-tap even fraction generator
        │   ├── ClaimManager.tsx      # Step 4: Stepper + quick-fraction pill matrix for item claims
        │   ├── Payments.tsx          # Step 5: Cashier payment recording & bill coverage validation
        │   └── DebtMatrix.tsx        # Step 6: Draft summary, room locking, UPI + WhatsApp tray, PDF export
        └── ui/                       # Reusable primitives (BottomSheet, HelpTip, QrScannerModal, SectionHeader, ToggleSwitch)
```

---

## 3. Core Mathematical Specification (`src/lib/mathEngine.ts`)

Every change to `mathEngine.ts`, `ReceiptEditor.tsx`, `DebtMatrix.tsx`, or `pdf.ts` **must** preserve the following mathematical invariants:

### 3.1 Pre-Tax Discount Multiplier

Given raw subtotal `S_raw = sum(qty_i * unitPrice_i)`:

- If `discountMode === 'pre-tax'`, compute `D_pre = min(S_raw, discount)`.
- The pre-tax multiplier is:
  `M_pre = S_raw > 0 ? (S_raw - D_pre) / S_raw : 1`
- Each item's effective base is `B_i = totalBase_i * M_pre`.

### 3.2 Service Charge & Tax Routing

For each item `i` with tax rate `r_i` and service charge rate `s`:

- Item Service Charge: `SC_i = applySC_i ? (B_i * s) : 0`.
- **Case 1 (`scTaxPresetId === 'inherit'`):**
  - `T_item_i = B_i * r_i`
  - `T_sc_i = SC_i * r_i`
  - Both `T_item_i` and `T_sc_i` are accumulated into the item's own tax preset bucket (splitting 50/50 into CGST and SGST if `preset.split === true`).
- **Case 2 (`scTaxPresetId !== 'inherit'`):**
  - `T_item_i = B_i * r_i`
  - `T_sc_i = (scTaxPresetId !== 'none' && SC_i > 0) ? (SC_i * r_sc) : 0`
  - `T_item_i` is added to the item's tax bucket, while `T_sc_i` is added to the global S.C. tax preset bucket.

### 3.3 Gross Total, Post-Tax Discount & POS Round-Off

1. `GrossTotal = sum(B_i) + sum(SC_i) + sum(Taxes)`
2. If `discountMode === 'post-tax'`, `D_post = min(GrossTotal, discount)`.
3. `FinalRawTotal = GrossTotal - D_post`
4. `GrandTotal = Math.round(FinalRawTotal)`
5. `RoundOff = round2(GrandTotal - FinalRawTotal)`
6. Distribution Multiplier: `M_dist = FinalRawTotal > 0 ? GrandTotal / FinalRawTotal : 1`

### 3.4 Individual Share & Conservation of Money Invariant

- `individualBreakdowns` is keyed by `member.id` (with `memberName` stored inside the object) to guarantee uniqueness even when two guests share the same display name.
- Each member `m` claiming quantity `q_{m,i}` of item `i` receives share `(q_{m,i} / qty_i)` of `B_i`, `T_item_i`, `SC_i`, and `T_sc_i`, scaled by `M_dist`.
- **Paisa Conservation Pass:** When all items are 100% claimed, `sum(totalOwed_m) === GrandTotal` to the exact paisa (`0.01`). Any `±0.01` to `±0.05` floating-point rounding remainder is automatically allocated to the member with the largest share before running `generateTransactions`.

---

## 4. Database Schema & Security Contracts (Supabase)

### 4.1 Core Tables

- **`profiles`**: `id (uuid PK)`, `name`, `email`, `avatar_url`, `upi_id`, `ai_scans_used (int4)`, `last_scan_reset (timestamptz)`, `pro_expires_at (timestamptz)`, `updated_at`.
- **`sessions`**: `id (text PK)`, `name`, `venue_name`, `host_id (uuid FK)`, `pin (text)`, `status ('draft'|'locked'|'archived')`, `is_sc_applicable (bool)`, `service_charge_rate (numeric)`, `sc_tax_preset_id (text)`, `discount_type`, `discount_value`, `discount_mode`, `created_at`.
- **`tax_presets`**: `id (uuid PK)`, `session_id (text FK)`, `name`, `rate (numeric)`, `split (bool)`.
- **`items`**: `id (uuid PK)`, `session_id (text FK)`, `name`, `qty (numeric)`, `price (numeric)`, `apply_sc (bool)`, `tax_preset_id (uuid)`.
- **`members`**: `id (uuid PK)`, `session_id (text FK)`, `name`, `user_id (uuid nullable FK)`, `paid_amount (numeric)`.
- **`claims`**: `session_id (text FK)`, `item_id (uuid FK)`, `member_id (uuid FK)`, `value (text)`. Unique constraint on `(item_id, member_id)`.
- **`ledger`**: `id (uuid PK)`, `session_id (text FK)`, `creditor_id (uuid nullable)`, `creditor_fallback_name (text)`, `debtor_id (uuid nullable)`, `debtor_fallback_name (text)`, `amount (numeric)`, `settled (bool)`.
- **`connections`**: `user_id (uuid FK)`, `friend_id (uuid FK)`.

### 4.2 Views & RPCs

- **`global_ledger` (View)**: Aggregates unsettled `ledger` rows grouped by `(creditor_id, creditor_fallback_name, debtor_id, debtor_fallback_name)`.
- **`personal_analytics` (View)**: Aggregates settled `ledger` rows joined with `sessions` by `(debtor_id, venue_name)` for Pro spending insights.
- **RPCs**: `verify_session_pin(p_session_id, p_pin)`, `search_venues(search_term)`, `search_venue_items(p_venue_name, p_search_term)`, `delete_user_account()`.

---

## 5. Engineering Roadmap & Technical Debt Ledger

### Milestone 1: Core Hardening (Completed)

- [x] Universal Tax Engine (`inherit` vs `global` vs `none` Service Charge taxation).
- [x] Gemini CoT `reasoning` schema in `scan-receipt` Edge Function.
- [x] Monthly quota reset & `pro_expires_at` temporal subscription check.
- [x] Patch `scansUsed + 1` quota increment bug in `scan-receipt/index.ts`.
- [x] Remove leaked JSX comment in `DebtMatrix.tsx` (line 235).
- [x] Patch Paisa Conservation Pass in `mathEngine.ts` and key `individualBreakdowns` by `member.id`.
- [x] Add quick-tap fraction pills (`1/4`, `1/3`, `1/2`, `1`) and stepper buttons to `ClaimManager.tsx`.
- [x] Auto-advance from Step 1 to Step 2 upon successful Magic Scan completion.
- [x] Add missing semantic design tokens (`warning`, `warning-700`, `success-dark`) and `tabular-nums` alignment.

### Milestone 2: Native Mobile & Offline Perfection (Completed)

- [x] Make Astro `base` path conditional (`/` for Capacitor, `/ekwly` for GitHub Pages) and add `utils.resolvePath`.
- [x] Wire `@capacitor/app` hardware back-button into `AppRouter.tsx` and add dynamic Sun/Moon theme icon.
- [x] Deconstruct `useSession.ts` into `offlineQueue.ts`, `useSessionSync.ts`, and `useSessionMutations.ts` with Promise-locked queue flushing.
- [x] Replace render-blocking `cdnjs` `jspdf` scripts in `index.astro` with bundled dynamic `import('jspdf')` in `src/lib/pdf.ts`.
- [x] Extract unified `<QrScannerModal/>` to power both Room QR joins (`Home.tsx`) and Friend QR connections (`Friends.tsx`, `Profile.tsx`).
- [x] Add Vitest unit suite (`src/lib/mathEngine.test.ts`) verifying TBC 66 (Model A) and Chin Lung (Model B) receipts.

### Milestone 3: Growth, Analytics & Autonomous Monetization (Completed)

- [x] Build `src/components/Analytics.tsx` consuming `personal_analytics` SQL view and wire it into `AppRouter.tsx`.
- [x] Add "Remind on WhatsApp" deep-link generator (`utils.buildWhatsAppReminderUrl`) with pre-filled UPI links in `DebtMatrix.tsx` and `Ledger.tsx`.
- [x] Build Splitwise CSV importer (`src/lib/splitwiseCsv.ts`) and unit test suite (`src/lib/splitwiseCsv.test.ts`) in `Ledger.tsx`.
- [x] Automate `AndroidManifest.xml` (`upi://` queries + ML Kit barcode metadata) and `Info.plist` (`NSCameraUsageDescription`) patching via `scripts/configure-native.mjs`.
- [x] Create Razorpay Webhook Edge Function (`supabase/functions/razorpay-webhook/index.ts`) for automated `Ekwly Pro` (₹99/mo, ₹799/yr) and `7-Day Trip Pass` (₹49) activation.
