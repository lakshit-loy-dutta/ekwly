# Ekwly — Universal Indian POS Tax, Discount & Settlement Engine

> **Implementation:** `src/lib/mathEngine.ts` + `src/lib/utils.ts`
> **Test Suites:** `src/lib/mathEngine.test.ts`, `src/lib/utils.test.ts`, `src/lib/splitwiseCsv.test.ts` (14 passing tests)

---

## 1. 3-Layer Simultaneous Discount Pipeline

Every line item $i$ starts with raw base $B_i = \text{qty}_i \times \text{unitPrice}_i$.

1. **Layer 1 — Per-Item / Category Discount (`item.discountType`, `item.discountValue`):**
   - `percentage`: $D_{\text{item}, i} = \min\left(B_i,\; B_i \times \frac{v_i}{100}\right)$
   - `flat`: $D_{\text{item}, i} = \min(B_i,\; v_i)$
   - Post-item-discount base: $B'_i = \max(0,\; B_i - D_{\text{item}, i})$
2. **Layer 2 — Selective Pre-Tax Restaurant Discount (`discountType`, `discountValue`, `item.applyDiscount`):**
   - Eligible base sum: $S_{\text{elig}} = \sum_{i:\,\text{applyDiscount}_i \neq \text{false}} B'_i$
   - Multiplier (`mathEngine.computePreTaxMultiplier`):
     $$M_{\text{pre}} = \max\left(0,\; \frac{S_{\text{elig}} - D_{\text{pre}}}{S_{\text{elig}}}\right)$$
   - Effective taxable base: $E_i = (\text{applyDiscount}_i \neq \text{false}) ? B'_i \cdot M_{\text{pre}} : B'_i$
3. **Layer 3 — Post-Tax Coupon / App Discount (`postTaxDiscountType`, `postTaxDiscountValue`):**
   - Applied after all taxes and Service Charges on Gross Total $G$:
     $$T_{\text{raw}} = G - \min(G,\; D_{\text{post}})$$

---

## 2. Service Charge Topologies & Tax Routing

For item $i$ with preset tax rate $r_{\text{tax}, i} = \text{preset.rate} / 100$ and Service Charge rate $r_{\text{sc}}$:

- **Item Service Charge:** $\text{SC}_i = (\text{isScApplicable} \land \text{applySC}*i \land r*{\text{sc}} > 0) ? E_i \cdot r_{\text{sc}} : 0$
- **Model A (`scTaxPresetId === 'inherit'` — Cascading):** Taxes $(E_i + \text{SC}_i)$ at $r_{\text{tax}, i}$.
- **Model B (`scTaxPresetId === '<preset-uuid>'` — Independent Global Bracket):** Taxes $E_i$ at $r_{\text{tax}, i}$ and taxes $\text{SC}_i$ separately at $r_{\text{scTax}}$.
- **Model C (`scTaxPresetId === 'none'` — Untaxed):** Taxes $E_i$ at $r_{\text{tax}, i}$ with zero tax on $\text{SC}_i$.
- **CGST / SGST Splitting (`preset.split === true`):** Divides accumulated bracket tax 50/50 into `CGST` and `SGST` lines (`utils.getSplitNames`).
- **Auto-Detect Solver (`WorkbenchRuleDrawers.tsx`):** Runs all 3 topologies and picks the closest match within `₹2.00` of a user-entered printed bill Grand Total.

---

## 3. POS Round-Off, Paisa Conservation & Settlement

- **POS Round-Off:** $\text{GrandTotal} = \text{Math.round}(T_{\text{raw}})$, $\text{RoundOff} = \text{round2}(\text{GrandTotal} - T_{\text{raw}})$.
- **Individual Allocation:** Scales each member's `(subtotal + serviceCharge)` by $\text{GrandTotal} / G$.
- **Paisa Conservation Pass:** Adjusts floating-point rounding drift onto the largest individual share so $\sum_m \text{totalOwed}_m \equiv \text{GrandTotal}$.
- **Greedy Debt Minimization (`mathEngine.generateTransactions`):** Matches largest debtors against largest creditors from `paid_amount - totalOwed`.
- **Bilateral Ledger Netting (`utils.netBilateralBalances`):** Offsets opposing unsettled balances between the same counterparty across sessions (`id:<uuid>` for linked users, normalized `name:<lower>` for guests).

---

## 4. Known Edge Cases Queued for Stage 3 (`AUD-27`)

1. `SessionContext.tsx` currently passes `sessionRules.serviceChargeRate` without checking `isScApplicable`.
2. Per-item rounding inside Step 6 can accumulate more than `₹0.05` drift on large tables beyond Step 7's `<= 0.05` guard, and Step 7 does not verify 100% claim coverage before adjusting drift.
3. `utils.parseQty` currently accepts negative/non-finite numbers and `getFractionString` does not guard `dividers === 0`.
