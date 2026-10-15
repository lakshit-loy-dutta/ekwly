# Ekwly — Architecture, Engineering Standards & Product Roadmap

> **Version:** 0.6.0 (Database Hardened & v1.0 Consumer Fintech Blueprint)
> **Stack:** Astro 7 + React 19 + Tailwind CSS v4 + Supabase (Postgres, Auth, Realtime, Edge Functions) + Capacitor 8 (Android & iOS) + Google Gemini Vision API
> **Package Manager:** `pnpm` (v12+ strictly enforced)
> **Core Constraint:** ₹0 Hosting & Operational Cost Architecture

---

## 1. System Overview & Core Value Proposition

**Ekwly** is a real-time, multiplayer bill-splitting and debt-settlement engine built specifically for the Indian dining and group-expense ecosystem. Unlike generic splitters that divide totals evenly or apply taxes as a flat percentage across a bill, Ekwly models the exact accounting logic of Indian Point-of-Sale (POS) systems:

1. **Multi-Bracket Itemized Taxation:** Routes Food GST (5%), Alcohol VAT (0%–25% state-dependent), and Tobacco GST (28%–40%) strictly to the members who consumed those specific items.
2. **Dual Service Charge (S.C.) Topologies:**
   - **Model A (`inherit` / Cascading):** Item tax is computed on `(Effective Base + Item S.C.)`. Common in restobars where Service Charge is bundled per line item before VAT/GST.
   - **Model B (`global` / Independent):** Line items are taxed strictly on `Effective Base`, while the aggregated Service Charge is taxed independently under a global preset (typically 5% GST) or left untaxed (`none`).
3. **AI Receipt OCR ("Magic Scan"):** Client-side `<canvas>` compression (`max 1400px`, `0.82` JPEG) paired with `gemini-3.5-flash-lite` via Supabase Edge Functions using Chain-of-Thought (CoT) mathematical self-verification and single-shot batch DB insertion.
4. **Zero-Install Multiplayer, UPI Deep-Links & WhatsApp Nudges:** Guests join rooms via QR/PIN without downloading an app, claim fractional shares in real time, and settle via native `upi://pay` deep links, Host-screen UPI QR codes, or 1-tap WhatsApp reminders.

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
    │   │   ├── useSessionSync.ts     # Initial parallel fetch & deduplicated Realtime WebSocket listeners
    │   │   └── useSessionMutations.ts# Optimistic UI + batch & offline-aware CRUD mutations
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
        ├── ActiveSession.tsx         # Session orchestrator
        ├── Ledger.tsx                # Global receivables/payables, WhatsApp nudges & Splitwise CSV importer
        ├── Friends.tsx               # Network connections, QR scanner & personal QR invite links
        ├── Profile.tsx               # Identity, UPI VPA configuration, QR scanner, account deletion
        ├── PwaUpdater.tsx            # Service worker lifecycle & update banner
        ├── session/                  # Session Modules:
        │   ├── SessionRules.tsx      # Venue lookup, MagicScanner, SC, Discounts, Tax Presets
        │   ├── MagicScanner.tsx      # Client-side image compression + AI Edge invocation + batch insert
        │   ├── ReceiptEditor.tsx     # Line-item CRUD, menu autocomplete, live item total preview
        │   ├── MembersList.tsx       # Guest addition, profile search, slot claiming
        │   ├── QuickSplit.tsx        # 1-tap even fraction generator
        │   ├── ClaimManager.tsx      # Stepper + quick-fraction pill matrix for item claims
        │   ├── Payments.tsx          # Cashier payment recording & bill coverage validation
        │   └── DebtMatrix.tsx        # Draft summary, room locking, UPI + WhatsApp tray, PDF export
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

## 4. Database Schema, Triggers & Security Contracts (Supabase)

### 4.1 Core Tables

- **`profiles`**: `id (uuid PK)`, `name`, `email`, `phone`, `avatar_url`, `upi_id`, `ai_scans_used (int4)`, `last_scan_reset (timestamptz)`, `pro_expires_at (timestamptz)`, `updated_at`.
- **`sessions`**: `id (text PK)`, `name`, `venue_name`, `host_id (uuid FK)`, `pin (text)`, `status ('draft'|'locked'|'archived')`, `is_sc_applicable (bool)`, `service_charge_rate (numeric)`, `sc_tax_preset_id (text)`, `discount_type`, `discount_value`, `discount_mode`, `created_at`.
- **`tax_presets`**: `id (uuid PK)`, `session_id (text FK)`, `name`, `rate (numeric)`, `split (bool)`.
- **`items`**: `id (uuid PK)`, `session_id (text FK)`, `name`, `qty (numeric)`, `price (numeric)`, `apply_sc (bool)`, `tax_preset_id (uuid)`.
- **`members`**: `id (uuid PK)`, `session_id (text FK)`, `name`, `user_id (uuid nullable FK)`, `paid_amount (numeric)`.
- **`claims`**: `session_id (text FK)`, `item_id (uuid FK)`, `member_id (uuid FK)`, `value (text)`. Primary Key on `(item_id, member_id)`.
- **`ledger`**: `id (uuid PK)`, `session_id (text FK)`, `creditor_id (uuid nullable)`, `creditor_fallback_name (text)`, `debtor_id (uuid nullable)`, `debtor_fallback_name (text)`, `amount (numeric)`, `settled (bool)`.
- **`connections`**: `user_id (uuid FK)`, `friend_id (uuid FK)`.
- **`venues`**: `id (uuid PK)`, `name (unique)`, `normalized_name (unique)`, `service_charge_rate (numeric)`, `tax_presets (jsonb)`, `times_used (int4)`, `last_updated_at (timestamptz)`.

### 4.2 Views, Triggers & RPCs

- **`global_ledger` (View)**: Aggregates unsettled `ledger` rows grouped by `(creditor_id, creditor_name, debtor_id, debtor_name)`.
- **`personal_analytics` (View)**: Combines settled debtor shares (`ledger.settled = true`) with host/payer net restaurant spend (`members.paid_amount - owed_by_others`) grouped by `(user_id, venue_name)`.
- **`trigger_harvest_venue` (`harvest_venue_data` SECURITY DEFINER)**: Automatically upserts venue tax presets and service charge rates into `public.venues` whenever a session transitions to `status = 'locked'`.
- **`trigger_protect_profile_billing` (`protect_profile_billing_columns` SECURITY DEFINER)**: Blocks client-side tampering with `pro_expires_at` and prevents unauthorized decrements of `ai_scans_used` within the same billing month.
- **RPCs**: `verify_session_pin(p_session_id, p_pin)`, `search_venues(search_term)`, `search_venue_items(p_venue_name, p_search_term)`, `delete_user_account()`.

---

## 5. Free vs. Pro Tier Product Boundaries (₹0 Operational Cost Model)

### 5.1 Ekwly Free Forever (₹0)

- **Unlimited Rooms, Line Items & Splits:** Zero daily expense caps or wait timers.
- **Full Universal Tax Engine:** Model A & B Service Charges, CGST/SGST splits, Pre/Post-Tax Discounts, and Paisa Conservation.
- **Crowd-Sourced Venue & Menu Autocomplete:** Instant loading of known restaurant tax brackets (`search_venues`) and menu item prices (`search_venue_items`) harvested from community sessions.
- **3 Free AI Magic Scans / Month:** Automatically resets on UTC month rollover.
- **Full Settlement Suite:** `upi://pay` deep links, Host Dynamic UPI QR codes, 1-tap WhatsApp nudges, Splitwise CSV imports, and offline-capable PDF receipt exports.

### 5.2 Ekwly Pro (₹99/mo, ₹799/yr, or ₹49 7-Day Trip Pass)

- **Unlimited AI Magic Scans.**
- **Personal Analytics Dashboard:** Lifetime venue spend leaderboards and debtor concentration charts.
- **Saved Squads (Upcoming):** 1-tap room member population for recurring flatmates or office groups.

---

## 6. Master Engineering Roadmap & Action Plan

### Milestones 1–3: Core Hardening, Native Pipeline & Growth Loops (Completed)

- [x] Universal Tax Engine (`inherit` vs `global` vs `none` Service Charge taxation) + Paisa Conservation Pass.
- [x] Gemini CoT `reasoning` schema in `scan-receipt` Edge Function + client-side `<canvas>` image compression + `addItemsBatchToDB`.
- [x] Monthly quota reset & `pro_expires_at` temporal subscription check + `protect_profile_billing_columns` DB trigger.
- [x] Modularized `useSession.ts` (`offlineQueue.ts`, `useSessionSync.ts`, `useSessionMutations.ts`) with deduplicated initial fetch.
- [x] Dynamic local `jspdf` + `jspdf-autotable` bundling, unified `<QrScannerModal/>`, `Analytics.tsx`, WhatsApp nudges, Splitwise CSV importer, `scripts/configure-native.mjs`, and `razorpay-webhook`.

### Milestone 4: UI/UX Foundation, Thumb-Zone Navigation & Dialog Overhaul (Next Up)

- [ ] **Step 4.1 — Scoped Input Styling (`src/styles/base.css`)**: Remove global height/width/border rules from raw `input, select` tags and introduce `.input-field` so components never require `!important` overrides.
- [ ] **Step 4.2 — Custom `<ConfirmSheet/>` (`src/components/ui/ConfirmSheet.tsx`)**: Replace all `window.confirm` and `window.prompt` calls in `Home.tsx`, `Friends.tsx`, `Ledger.tsx`, and `Profile.tsx` with a native-feeling bottom-sheet confirmation modal.
- [ ] **Step 4.3 — Floating Glass `<BottomDock/>` (`src/components/ui/BottomDock.tsx`)**: Add a thumb-friendly floating bottom navigation bar (`Home`, `Ledger`, `+ Scan/New`, `Friends`, `Insights`) to `AppRouter.tsx`.
- [ ] **Step 4.4 — Host Verification & Clean URLs (`src/components/AppRouter.tsx`)**: Derive `isHost` from `currentUserId === hostId` once loaded and strip `?p=<pin>` from `window.location.search` after room entry so PINs are not exposed in browser history.

### Milestone 5: The 2-Screen "Live Receipt Canvas" (Replacing the 6-Step Wizard)

- [ ] **Step 5.1 — Pinned Member Avatar Bar (`src/components/session/MemberAvatarBar.tsx`)**: Horizontal bar at the top of the room displaying member avatars, live rupee subtotals per member, `+ Add Member` trigger, and 1-tap `Claim Identity` for guests.
- [ ] **Step 5.2 — Interactive Dish Cards & 1-Tap Avatar Claiming (`src/components/session/ReceiptCanvas.tsx`)**:
  - Tap a dish card to toggle the active member's avatar onto that dish; automatically divides quantity `1/N` across all avatars on that dish via `batchUpdateClaimsInDB`.
  - Tap an avatar badge on a dish to open a focused fractional adjuster (`1/4`, `1/3`, `1/2`, `1`, `-`/`+`) for uneven shares.
- [ ] **Step 5.3 — Contextual Rules & Tax Chips (`src/components/session/RulesDrawer.tsx`)**: Move Venue Search, Service Charge config, Discounts, and Tax Presets into interactive summary pills at the bottom of the receipt card that open focused `BottomSheet` drawers on demand.

### Milestone 6: Instant Settlement, Host Dynamic UPI QR & Bilateral Netting

- [ ] **Step 6.1 — Smart Cashier Default (`src/components/session/DebtMatrix.tsx`)**: Default 100% of restaurant cashier payment to the Host automatically if `sum(paid_amount) === 0`, with an expandable `"Multiple people paid the waiter"` override drawer.
- [ ] **Step 6.2 — Host-Side Dynamic UPI QR Modal (`src/components/session/DebtMatrix.tsx`)**: Add a `"Show QR"` button on each unsettled debt row that renders a live QR code (`upi://pay?pa=...&am=...&cu=INR`) so friends at the table can scan the Host's screen directly from GPay/PhonePe.
- [ ] **Step 6.3 — Bilateral Netting (`src/components/Ledger.tsx`)**: Net opposing balances between the same counterparty (`owedToMe` vs `iOwe`) into a single consolidated net balance.

### Milestone 7: ₹0 Cost Operational Guardrails

- [ ] **Step 7.1 — Automated Stale Session Pruning (SQL + GitHub Actions)**: Add a scheduled cleanup function that purges abandoned `draft` sessions older than 30 days with zero ledger rows to keep Postgres storage under 20MB permanently.
