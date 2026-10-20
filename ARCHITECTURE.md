# Ekwly — Architecture, Engineering Standards & Product Roadmap

> **Version:** 0.9.0 (2-Tab Workbench, 3-Layer Discount Engine, Host UPI QR, Bilateral Netting, Social Dining Network & Lazy WebSockets)
> **Repository Visibility:** Private Proprietary Repository
> **Stack:** Astro 7 + React 19 + Tailwind CSS v4 + Supabase (Postgres, Auth, Realtime, Edge Functions) + Capacitor 8 (Android & iOS) + Google Gemini Vision API
> **Package Manager:** `pnpm` (v12+ strictly enforced)
> **Core Constraint:** ₹0 Hosting & Operational Cost Architecture

---

## 1. Core Mathematical Specification (`src/lib/mathEngine.ts`)

1. **3-Layer Simultaneous Discount Pipeline (`calculateItemBreakdown` & `generateSplit`):**
   - **Layer 1 — Per-Item & Section/Category Discounts (`item.discountType`, `item.discountValue`):** Applied directly to individual dishes or distributed proportionally across a selected section (e.g., Beverages, Desserts, Starters) before Pre-Tax bill discounts.
   - **Layer 2 — Selective Pre-Tax Restaurant Discount (`discountType`, `discountValue` + `item.applyDiscount`):** Scales only items where `applyDiscount !== false` (allowing Food-only restaurant discounts that exclude Alcohol/Tobacco) before Service Charge and Taxes.
   - **Layer 3 — Simultaneous Post-Tax Coupon/App Discount (`postTaxDiscountType`, `postTaxDiscountValue`):** Subtracted from `GrossTotal` (`Base + SC + Taxes`) after taxes and before POS rounding.
2. **Service Charge Topologies & Per-Item Applicability (`applySC`):**
   - `scTaxPresetId === 'inherit'` (Model A): Taxes `(EffectiveBase + ItemSC)` at the item's tax rate.
   - `scTaxPresetId === '<uuid>'` (Model B): Taxes `EffectiveBase` at the item's tax rate and taxes `ItemSC` at the selected global preset rate.
   - `scTaxPresetId === 'none'`: Leaves Service Charge untaxed.
3. **Custom Tax Presets & CGST/SGST Split (`preset.split`):**
   - Any tax bracket with `split: true` automatically divides its accumulated amount 50/50 into `CGST` and `SGST` lines.
4. **POS Round-Off & Paisa Conservation Invariant:**
   - `GrandTotal = Math.round(FinalRawTotal)`.
   - When all items are 100% claimed, `sum(totalOwed_m) === GrandTotal` to the exact paisa (`0.01`).

---

## 2. Master Engineering Roadmap Status

- [x] **Milestones 1–4:** Core Tax Engine, Gemini CoT OCR, 14 B-Tree/GIN DB Indexes, `<BottomDock/>`, `<BrandLoader/>`, `<ConfirmSheet/>`, `<QrScannerModal/>`, `Analytics.tsx`, `splitwiseCsv.ts`.
- [x] **Milestone 5:** 2-Tab Live Receipt Workbench (`ReceiptWorkbench.tsx` + `WorkbenchRuleDrawers.tsx`).
- [x] **Milestone 6:** Smart Cashier Default, Host-Side Dynamic UPI QR Modal (`DebtMatrix.tsx`), and Bilateral Balance Netting (`Ledger.tsx`, `Home.tsx`).
- [x] **Milestone 7:** Social Dining Network (`Friends.tsx` 2.0: Live Search, Co-Diner Suggestions, Saved Squads, Friendship Dossiers) & Lazy Multiplayer WebSockets (`useSessionSync.ts`).
- [x] **Milestone 8:** 3-Layer Simultaneous Discount Engine (Item/Section + Selective Pre-Tax + Post-Tax), `WorkbenchRuleDrawers.tsx` extraction, `Auth.tsx` & `Home.tsx` UX overhaul, and `React.lazy` route splitting.
