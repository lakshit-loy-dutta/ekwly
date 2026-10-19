# Ekwly — UI/UX Redesign Architecture & Product Vision (`UI_UX_REDESIGN.md`)

> **Document Version:** 1.0.0  
> **Design Paradigm:** "Tactile Financial Equilibrium" — Solo-Host-First Speed, Multiplayer-Ready Sync, Bento Spatial Geometry, and 60Hz–240Hz Spring Physics  
> **Target Platforms:** Web PWA, Android Native (Capacitor 8), iOS Native (Capacitor 8) — 100% Feature Parity[cite: 9]

---

## 1. Executive Summary: What Is Changing and Why?

Ekwly’s backend math engine (`src/lib/mathEngine.ts`) and AI receipt OCR (`supabase/functions/scan-receipt/index.ts`) solve one of the hardest problems in Indian consumer fintech: accurately routing multi-bracket taxes (Food GST 5%, Alcohol VAT 0%–25%, Tobacco GST 28%–40%), cascading vs. independent Service Charges, Pre/Post-Tax Discounts, and POS Round-Offs to the exact paisa[cite: 9].

However, Ekwly’s original **6-Step Linear Wizard UI** (`Step 1: Rules` $\rightarrow$ `Step 2: Items` $\rightarrow$ `Step 3: Members` $\rightarrow$ `Step 4: Claims` $\rightarrow$ `Step 5: Payments` $\rightarrow$ `Step 6: Summary`) exposed that accounting complexity in the wrong order and optimized for the wrong primary user behavior[cite: 9].

The UI/UX redesign transforms Ekwly from a **6-screen sequential accounting form** into a **2-Tab Live Receipt Workbench** and **Social Dining Network**—preserving **100% of existing tax, service charge, discount, and fractional splitting features** while cutting the time required to split a bill from ~3 minutes to **under 20 seconds**.

---

## 2. Why the Redesign Was Needed (5 Core Pain Points of the Legacy UI)

### 2.1 The "Solo Host / Designated Treasurer" Reality vs. The Multiplayer Assumption

- **The Old Assumption:** The original 6-step flow assumed that every time a group ate out, 6 friends would pull out their phones, scan a room QR code, enter a 4-digit PIN, and claim their own items live[cite: 9].
- **The Real-World Reality:** In 90%+ of real-world dining scenarios, **one person (the "Solo Host" or "Designated Treasurer")** takes responsibility for the table—scanning the paper bill or logging items from memory and assigning who ate what on a single phone.
- **How the Old UI Hurt the Solo Host:**
  1. **Forced PIN Lobby Ceremony (`Lobby.tsx`):** Even when splitting a bill solo, the user was forced through a setup screen asking for a Room Name and 4-digit PIN[cite: 9].
  2. **Manual Name Typing (`MembersList.tsx`):** The Solo Host had to manually type `"Rahul"`, `"Priya"`, `"Manish"` into every new session instead of tapping existing connections from their Friends list in 1 tap[cite: 9].
  3. **Mandatory Cashier Step (`Payments.tsx`):** On Step 5, even though the Host paid the restaurant 95% of the time, the UI forced the Host to manually type the exact Grand Total (`₹3,419.00`) next to their own name before allowing them to view the settlement[cite: 9].

### 2.2 The "Tax-Accountant First" Wizard Friction (`SessionRules.tsx` on Step 1)

- In the legacy 6-step wizard, the very first screen (`Step 1: Taxes & Extra Charges`) presented an intimidating configuration form asking for Service Charge rates, Service Charge Tax Inheritance (`Inherit Item's Tax` vs. `Custom Global Tax` vs. `Not Taxed`), Pre-Tax vs. Post-Tax Discounts, and a 12-column Manual Tax Preset builder _before a single dish was even on the screen_[cite: 9].
- **The 10-Tap Debugging Loop:** Users only realize a restaurant taxed Service Charge globally or applied a Pre-Tax discount when they look at the **bottom of the physical receipt** and compare it to the **Grand Total on Step 6** (`DebtMatrix.tsx`)[cite: 9]. If the total was off by ₹40 on Step 6, the user had to tap **Back 5 times** to Step 1 or Step 2, flip a toggle, and tap **Next 5 times** back to Step 6 to check if the numbers matched[cite: 9].

### 2.3 The $M \times N$ "Scroll of Death" (`ClaimManager.tsx` on Step 4)

- `ClaimManager.tsx` grouped claims by **Member $\rightarrow$ All Dishes** (`props.members.map` outer loop $\times$ `props.items.map` inner loop)[cite: 9].
- **The Ergonomic Flaw:** For a table of 6 friends ordering 12 dishes, Step 4 rendered **$6 \times 12 = 72$ vertical input rows**[cite: 9]. When a Solo Host reads down a paper receipt item by item (_"Crispy Corn—everyone shared it; LIIT Pitcher—Rahul and Priya split it"_), grouping by person forced constant vertical scrolling across 6 separate sections or jumping back and forth into `QuickSplit.tsx`[cite: 9].
- Additionally, `inputMode="decimal"` on the old claim input prevented iOS keyboards from typing the `/` character needed for fractions like `1/3`[cite: 9].

### 2.4 Visual Personality Split & Buried Navigation

- **Conflicting Visual Languages:** `Home.tsx`, `Lobby.tsx`, and `Analytics.tsx` used modern floating `rounded-2xl` / `rounded-3xl` cards, whereas the 6 session steps (`SessionRules`, `ReceiptEditor`, `MembersList`, `ClaimManager`, `Payments`, `DebtMatrix`) used dated, edge-to-edge `border-y` settings strips with zero horizontal margin[cite: 9].
- **Hidden Primary Navigation:** Core destinations (`Global Ledger`, `Personal Analytics`, `Friends Network`, `Profile`) were buried inside a `BottomSheet` menu triggered by a small `36px` avatar in the top-right corner—the hardest zone to reach one-handed on modern 6.7-inch phones[cite: 9].
- **Jarring Browser Dialogs:** Destructive and settlement actions relied on native browser `window.confirm` and `window.prompt` popups, which display ugly `"localhost says..."` system alerts inside native Android/iOS WebViews[cite: 9].

### 2.5 High-Refresh-Rate (60Hz–240Hz) Performance Bottlenecks

- Repeating `backdrop-blur-xl` on every session card inside a scrolling list (`Home.tsx`) caused mobile GPU overdraw on 120Hz+ screens[cite: 9].
- Animating `height: 0` $\rightarrow$ `height: 'auto'` when adding/removing items or members (`ReceiptEditor.tsx`, `MembersList.tsx`) forced CPU main-thread layout recalculations every frame[cite: 9].
- Global `!important` CSS color/shadow transitions in `base.css` and proportional numerals caused visual jitter during live math updates[cite: 9].

---

## 3. Redesign Goals Already Met (Completed & Active in the Codebase)

The foundational layer of the UI/UX and performance overhaul (Milestones 1–4) is **already implemented and active** in the repository[cite: 9]:

### 3.1 Thumb-Zone Floating Glass `<BottomDock/>` (`src/components/ui/BottomDock.tsx`)

- Replaced the buried top-right menu with a floating, pill-shaped bottom navigation dock (`Home`, `Ledger`, central elevated `+ New Session` button, `Friends`, `Insights`)[cite: 9].
- Uses Framer Motion’s shared layout indicator (`layoutId="ekwly-dock-pill"`) with snappy spring physics (`stiffness: 500, damping: 34, mass: 0.8`) and tactile haptic feedback (`utils.haptic`)[cite: 9].

### 3.2 Multi-Path Vector `<BrandLogo/>` & 240fps `<BrandLoader/>` (`src/components/ui/BrandLoader.tsx`)

- Replaced generic spinning icons and plain `"Syncing..."` text across `Home.tsx`, `Friends.tsx`, `Ledger.tsx`, `Profile.tsx`, and `Analytics.tsx` with the **Equilibrium Mark**—a custom multi-path SVG whose three geometric bars oscillate in phase-shifted spring harmony at up to 240fps[cite: 9].
- Centralizes brand geometry into a single file so future custom Illustrator SVG paths drop in seamlessly[cite: 9].

### 3.3 Native-Grade `<ConfirmSheet/>` Dialogs (`src/components/ui/ConfirmSheet.tsx`)

- Eliminated every `window.confirm` and `window.prompt` across `Home.tsx`, `Friends.tsx`, `Ledger.tsx`, and `Profile.tsx`[cite: 9].
- Supports danger/success semantic variants and interactive text-match verification (`requireMatchText="DELETE"` for permanent account deletion) inside a spring-animated bottom sheet[cite: 9].

### 3.4 240Hz Rendering & Financial Typography Discipline (`src/styles/base.css`, `src/styles/theme.css`)

- **Neutralized Slate Hierarchy:** Updated `--text-muted` from saturated blue to crisp slate (`#475569` in light mode, `#94a3b8` in dark mode) so semantic financial colors—Azure (`#0080ff`), Emerald (`#10b981`), Amber (`#f59e0b`), and Rose (`#df1b41`)—pop immediately[cite: 9].
- **Tabular Numerals Invariant:** Enforced `font-variant-numeric: tabular-nums` across all rupee figures, quantities, and PINs so numbers never jitter horizontally[cite: 9].
- **GPU Layer Promotion:** Removed `backdrop-blur` from scrolling list cards in `Home.tsx`, stripped global `!important` CSS transition lag from `base.css`, added `.gpu-layer` (`will-change: transform, opacity; transform: translateZ(0)`), and injected `<key>CADisableMinimumFrameDurationOnPhone</key><true/>` into iOS `Info.plist` via `scripts/configure-native.mjs` to unlock 120Hz ProMotion on iPhones[cite: 9].

### 3.5 Unified `<QrScannerModal/>` & Hardware Back Parity (`src/components/ui/QrScannerModal.tsx`, `AppRouter.tsx`)

- Extracted a single QR scanner modal supporting both `@capacitor-mlkit/barcode-scanning` (native Android/iOS) and `Html5Qrcode` (web fallback) to power both Room QR joins and Friend QR connections[cite: 9].
- Wired `@capacitor/app` hardware back-button listeners and browser `popstate` history synchronization into `AppRouter.tsx`, while stripping plaintext room PINs (`&p=...`) from the URL bar after join verification[cite: 9].

### 3.6 Viral Growth & Migration Flows (`Analytics.tsx`, `Ledger.tsx`, `DebtMatrix.tsx`)

- Built the **Personal Analytics Dashboard (`src/components/Analytics.tsx`)** with animated Framer Motion bar meters for Top Dining Venues, Top Outstanding Debtors, and AI Magic Scan quota tracking[cite: 9].
- Added **1-Tap WhatsApp Payment Nudges (`utils.buildWhatsAppReminderUrl`)** pre-filled with clickable `upi://pay` deep links in `DebtMatrix.tsx` and `Ledger.tsx`, plus a **1-Click Splitwise CSV Importer (`src/lib/splitwiseCsv.ts`)**[cite: 9].

---

## 4. The Final Vision (Milestones 5, 6 & 7 — Where We Are Heading Now)

### 4.1 Feature Preservation Guarantee (Zero Capability Loss)

The redesign **never removes or simplifies Ekwly’s accounting capabilities**. Every feature of the 6-step wizard is preserved and made faster to reach:

| Accounting / Splitting Capability                                           | Legacy 6-Step Location                                 | New 2-Tab Workbench Location                                                                                                                                                                |
| :-------------------------------------------------------------------------- | :----------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Pre-Tax vs. Post-Tax Discounts (`%` or `₹`)**[cite: 9]                    | Step 1 (`SessionRules.tsx`)[cite: 9]                   | **Live Receipt Footer (`Discount` pill/row)** — toggle `Pre-Tax` $\leftrightarrow$ `Post-Tax` and watch the Grand Total update live on the same screen.                                     |
| **Service Charge Rate & Tax Mode (`Inherit` / `Global` / `None`)**[cite: 9] | Step 1 (`SessionRules.tsx`)[cite: 9]                   | **Live Receipt Footer (`Service Charge` pill/row)** — switch between Cascading (`inherit`), Independent (`global`), or Untaxed (`none`) with live tax breakdown feedback.                   |
| **Per-Item Service Charge Toggle (`applySC`)**[cite: 9]                     | Hidden inside Step 2 Edit mode[cite: 9]                | **Inline `[+S.C.]` pill directly on every Dish Card** — toggle on/off in 1 tap.                                                                                                             |
| **Custom Tax Presets & CGST/SGST Split Toggle**[cite: 9]                    | Step 1 bottom form[cite: 9]                            | **Inline Tax Selector on each Dish Card** + **`Taxes` Drawer in the Receipt Footer** to add brackets or toggle 50/50 CGST/SGST splitting.                                                   |
| **Even & Fractional Item Splitting (`1/3`, `1 1/2`, decimals)**[cite: 9]    | Step 4 (`QuickSplit` + 72-row `ClaimManager`)[cite: 9] | **Inline `[All] [Member...]` Avatar Pills on each Dish Card** for 1-tap even splits + **Expandable Fractional Bar** (`1/4`, `1/3`, `1/2`, `1`, `-`/`+`) on the Dish Card for uneven splits. |
| **Multi-Payer Cashier Recording (`Payments.tsx`)**[cite: 9]                 | Mandatory Step 5[cite: 9]                              | **Smart Cashier Default** (auto-assigns 100% to Host when `totalPaid === 0`) + **`Change Payer` Drawer** on Tab 2 for multi-payer bills.                                                    |

---

### 4.2 Pillar 1: The 2-Tab Live Receipt Workbench (Milestone 5)

Instead of 6 linear steps, `ActiveSession.tsx` uses a **2-Segment Top Switcher**: **`[ 1. Receipt & Split ]`** and **`[ 2. Settle & Collect ]`**.

```text
+-------------------------------------------------------------------+
|  < Back    Chin Lung Resto Bar                    [QR] [Home] [🌙] |
+-------------------------------------------------------------------+
|  [  🧾 1. Receipt & Split (Active)  ]   [  💳 2. Settle & Collect ] |
+-------------------------------------------------------------------+
|  📍 Venue: [ Chin Lung Resto Bar        ]  [ ✨ Magic Scan Bill ] |
+-------------------------------------------------------------------+
|  👥 AT THE TABLE (4)                        [+ Add / Friends ▾]   |
|  ( You: ₹845 )  ( Rahul: ₹1,120 )  ( Priya: ₹694 )  ( Manish: ₹760 )|
+-------------------------------------------------------------------+
|  ➕ ADD DISH: [ Name...          ] [Qty: 1] [₹ Price] [Tax ▾] [+] |
+-------------------------------------------------------------------+
|  🍲 Crispy Corn  [x1] [✓ Split]                         ₹192.50   |
|     ₹175/ea • [Food GST 5% ▾] • [+S.C. ✓]            [✏️] [🗑️]   |
|     ------------------------------------------------------------- |
|     Tap who ate: [ All ✓ ] [You 1/4] [Rahul 1/4] [Priya] [Manish] |
+-------------------------------------------------------------------+
|  🍹 LIIT Pitcher [x1] [✓ Split]                       ₹1,522.50   |
|     ₹1450/ea • [Exempt 0% ▾] • [+S.C. ✓]             [✏️] [🗑️]   |
|     ------------------------------------------------------------- |
|     Tap who drank: [ All ] [You] [Rahul 1/2] [Priya 1/2] [⚙ 1/N]  |
+-------------------------------------------------------------------+
|  🧾 LIVE RECEIPT BREAKDOWN        [% Discount] [S.C. 5%] [Taxes]  |
|     Base Subtotal .................................... ₹3,132.00  |
|     Food CGST (2.5%) .................................   ₹13.29   |
|     Food SGST (2.5%) .................................   ₹13.29   |
|     Tobacco CGST (20%) ...............................   ₹52.00   |
|     Tobacco SGST (20%) ...............................   ₹52.00   |
|     Service Charge (5% • Global Tax) .................  ₹156.60   |
|     POS Round Off ....................................   -₹0.18   |
|     ============================================================= |
|     GRAND TOTAL                                        ₹3,419.00  |
+-------------------------------------------------------------------+
|  Grand Total: ₹3,419.00                [ ✓ Review & Settle -> ]   |
+-------------------------------------------------------------------+
```

**Why This Layout Solves Every Pain Point:**

1. **1-Tap Friend Chips:** Opening `[+ Add / Friends]` lets a Solo Host tap `+ Rahul`, `+ Priya`, `+ Manish` straight from their Ekwly Friends list without typing a single letter.
2. **Read-Down-the-Receipt Speed:** As the Solo Host reads down the paper receipt, they tap `[All]` on shared starters or `[Rahul] [Priya]` on a pitcher. Each tap updates everyone's live rupee badge in the top bar at 240fps.
3. **Side-by-Side Receipt Verification:** Because the **Live Receipt Breakdown** sits directly at the bottom of the dishes, the Host can compare the physical receipt's tax/SC/discount lines against Ekwly’s math on the exact same screen and tap any line (`Discount`, `S.C.`, `Taxes`) to adjust it in real time.

---

### 4.3 Pillar 2: Zero-Friction Settlement, Host UPI QR & Bilateral Netting (Milestone 6)

1. **Smart Cashier Default (`ActiveSession.tsx`):**
   - When tapping **`Review & Settle`**, if no cashier payments have been entered yet (`totalPaid === 0`), Ekwly automatically assigns 100% of the restaurant payment to the Host. If multiple friends split the cashier payment, tapping **`Change Payer`** opens the multi-payer drawer (`Payments.tsx`)[cite: 9].
2. **Host-Screen Dynamic UPI QR Modal (`DebtMatrix.tsx`):**
   - In addition to the debtor-side `upi://pay` button and creditor-side `Remind on WhatsApp` button[cite: 9], each unsettled row gets a **`[Show UPI QR]`** button.
   - Tapping it renders a large QR code encoded with `upi://pay?pa=<creditor_vpa>&pn=<name>&am=<exact_amount>&cu=INR` right on the Host's screen. Friends sitting across the table can scan the Host's phone with Google Pay, PhonePe, or Paytm and pay the exact rupee & paisa amount without ever opening Ekwly on their own phone.
3. **Bilateral Balance Netting (`Ledger.tsx`):**
   - If Rahul owes you ₹1,000 from Friday’s dinner and you owe Rahul ₹400 from Saturday’s cab, `Ledger.tsx` automatically nets the opposing entries into a single consolidated card: **`Rahul owes you ₹600.00 (Net of 2 balances)`**.

---

### 4.4 Pillar 3: The ₹0-Cost Social Dining Network (`Friends.tsx` 2.0 — Milestone 7)

To transform Ekwly from an occasional utility into a high-retention social app **without incurring cloud storage costs (0 media uploads)**:

1. **Live User Search & _"People You've Dined With"_ Suggestions:**
   - Search registered Ekwly users by name (`idx_profiles_name_trgm` GIN index) and automatically suggest connections from past shared sessions (`members` table).
2. **Saved Squads (1-Tap Group Presets):**
   - Save recurring dining groups (e.g., _"BLR Flatmates"_, _"Guwahati Crew"_) so a single tap adds the entire group to any new bill.
3. **Friendship Dining Dossier:**
   - Tapping any friend in `Friends.tsx` opens a rich social card powered purely by existing relational metadata:
     - **Shared Outings Count** (total sessions together).
     - **Your Go-To Spot** (most frequented `venue_name` together).
     - **Net Balance** + 1-tap UPI / WhatsApp settlement.
