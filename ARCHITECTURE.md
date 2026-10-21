# Ekwly — Architecture, Engineering Standards & Product Roadmap

> **Version:** 0.9.7 (Skeuomorphic Live Bill Split, Collapsible Idiot-Proof Tax Setup, Portal Modals & Quota-Aware AI Magic Scanner)
> **Repository Visibility:** Private Proprietary Repository
> **Stack:** Astro 7 + React 19 + Tailwind CSS v4 + Supabase (Postgres, Auth, Realtime, Edge Functions) + Capacitor 8 (Android & iOS) + Google Gemini Vision API
> **Package Manager:** `pnpm` (v12+ strictly enforced)
> **Core Constraint:** ₹0 Hosting & Operational Cost Architecture

---

## 1. Solo-Host Workbench & Skeuomorphic Live Bill Split Architecture (`ReceiptWorkbench.tsx`)

1. **Zone 1 — Quota-Aware AI Magic Scanner Hero & Crowdsourced Venue Autocomplete:**
   - Queries `profiles` (`ai_scans_used`, `last_scan_reset`, `pro_expires_at`) on mount.
   - Displays a front-and-center **AI Magic Bill Scanner Hero Card** when scans are available (`Pro • Unlimited` or `X of 3 Free Scans Left`), or a greyed-out upsell trigger when monthly free quota is exhausted (`0/3 Left`).
   - Pairs with the **Crowdsourced Restaurant / Venue Search** (`search_venues` & `search_venue_items` RPCs), which auto-loads community-verified tax brackets, service charge rates, and menu prices separately from the custom Session Name.
2. **Zone 2.5 — Collapsible, Idiot-Proof Bill Rules Card (`WorkbenchRuleDrawers.tsx`):**
   - Guides the user to check the bottom of their physical receipt and tap matching taxes (`Food GST 5%`, `Alcohol VAT`, `Exempt 0%`, or custom rates), configure Service Charge in plain English, and collapse the card once confirmed.
3. **Zone 3 — Add Item Form with Stepper Controls:**
   - Labeled `Quantity (No. of Items)` (`[ − ] 1 [ + ]`) and `Unit Price (₹ per item)` inputs, 1-tap tax bracket pills, and a compact `+ Item Discount` toggle chip.
4. **Zone 4 — Skeuomorphic `★ LIVE BILL SPLIT ★` Thermal Receipt:**
   - Rendered with inline SVG sawtooth thermal-blade edges (`<ThermalReceiptSawtooth/>`), perforation notches, itemized rows with 1-tap member split pills, and live clickable tax/discount/SC breakdown lines.
5. **Root Portal Modals (`BottomSheet.tsx`):**
   - All `<BottomSheet/>` instances render via `createPortal(..., document.body)` so fixed positioning is never trapped inside `backdrop-blur` or `transform` ancestors.
