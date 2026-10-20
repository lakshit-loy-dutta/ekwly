# Ekwly — Architecture, Engineering Standards & Product Roadmap

> **Version:** 0.8.0 (Complete Redesign: 2-Tab Workbench, Host UPI QR, Bilateral Netting, Social Dining Network & Lazy WebSockets)
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
5. **Social Dining Network & Instant UPI Settlement:** Connects friends via QR/search, suggests past dining companions, manages 1-tap Saved Squads, displays Friendship Dining Dossiers, nets bilateral balances, and settles via native `upi://pay` deep links, Host-screen dynamic UPI QR codes, and 1-tap WhatsApp nudges.

---

## 2. Master Engineering Roadmap Status

### Milestones 1–4: Core Engine, Native Pipeline & 240Hz Foundation (Completed)

- [x] Universal Tax Engine (Model A & B Service Charges, Pre/Post-Tax Discounts, Paisa Conservation).
- [x] Gemini CoT `reasoning` OCR + client-side `<canvas>` compression + `addItemsBatchToDB`.
- [x] Database security triggers (`harvest_venue_data`, `protect_profile_billing_columns`), `prune_stale_data()` + 14 B-Tree/GIN indexes.
- [x] Modularized `useSession` hooks + `<BrandLoader/>` + `<ConfirmSheet/>` + `<BottomDock/>`.
- [x] Native Web Share Level 2 PDF export (`pdf.ts`) + Windows JBR 21/SDK/Gradle 8.14.3 auto-config (`configure-native.mjs`).

### Milestone 5: The Solo-Host-First "2-Tab Live Receipt Workbench" (Completed)

- [x] **Step 5.1 — 1-Tap Friend & Squad Bar (`src/components/session/ReceiptWorkbench.tsx`)**: Populate table members in 1 tap from Ekwly `connections` (Friends) or Saved Squads without typing names manually.
- [x] **Step 5.2 — Interactive Dish Cards (`src/components/session/ReceiptWorkbench.tsx`)**: Inline `[All] [Member...]` avatar pills, expandable fractional adjuster (`1/4`, `1/3`, `1/2`, `1`, `-`/`+`), and inline `[Tax Bracket ▾]` & `[+S.C. ✓]` controls per dish.
- [x] **Step 5.3 — Live Interactive Receipt Footer & Drawers**: Live Subtotal, Discount, Tax Breakdown, Service Charge, Round Off, and Grand Total with focused `BottomSheet` drawers.

### Milestone 6: Instant Settlement, Host Dynamic UPI QR & Bilateral Netting (Completed)

- [x] **Step 6.1 — Smart Cashier Default & Zero-Friction Room Entry (`ActiveSession.tsx`, `AppRouter.tsx`)**: Auto-assign 100% of restaurant cashier payment to the Host when `totalPaid === 0`, with a `"Change Payer"` drawer for multi-payer bills.
- [x] **Step 6.2 — Host-Side Dynamic UPI QR Modal (`DebtMatrix.tsx`)**: `"Show UPI QR"` modal on each unsettled debt row with inline UPI VPA fallback and 1-tap `"Payment Received — Mark Paid"`.
- [x] **Step 6.3 — Bilateral Netting (`Ledger.tsx`, `Home.tsx`, `utils.ts`)**: Consolidate opposing balances between the same two users (`owedToMe` vs `iOwe`) into a single net balance.

### Milestone 7: The Social Dining Network (`Friends.tsx` 2.0) & Lazy WebSockets (Completed)

- [x] **Step 7.1 — Live Friend Search & "People You've Dined With" (`Friends.tsx`)**: Search registered users by name (`idx_profiles_name_trgm`) and suggest connections from past shared sessions.
- [x] **Step 7.2 — Saved Squads & Friendship Dossier (`Friends.tsx`, `ReceiptWorkbench.tsx`)**: Create 1-tap Saved Squads (e.g., `"Friday Crew"`, `"Flatmates"`) and view shared dining stats (total outings together, favorite venue, net balance) when tapping a friend.
- [x] **Step 7.3 — Lazy Multiplayer WebSockets (`useSessionSync.ts`)**: Keep Realtime `postgres_changes` dormant during solo-host entry until `"Invite QR"` is opened or >1 user joins the room.
