# Ekwly — Google Play Store Launch, ASO & Compliance Kit (`PLAY_STORE_LAUNCH_KIT.md`)

> **Release Version:** `1.0.0` (`versionCode: 1`)  
> **Application ID:** `com.ekwly.app`  
> **Category:** Finance / Tools  
> **Pricing:** Free (with optional in-app/web Pro upgrades)

---

## 1. Store Listing Copy (ASO Optimized & 100% Brand-Safe)

### 1.1 App Name (30 Characters Max)

```text
Ekwly: Bill Split, Tax & UPI
```

_(28 characters — hits the top 3 high-intent search keywords in India: "Bill Split", "Tax", and "UPI".)_

### 1.2 Short Description (80 Characters Max)

```text
Split group bills in seconds with AI receipt scan, exact GST/VAT & 1-tap UPI QR.
```

_(80 characters exact.)_

### 1.3 Full Description (4,000 Characters Max)

```text
Split restaurant, pub, and group trip bills in under 20 seconds — fair to the very last rupee.

Most bill-splitting apps divide the final total evenly or dump taxes into a single pot. When your group orders a mix of food, mocktails, and drinks, non-drinkers end up subsidizing high liquor taxes and service charges.

Ekwly is engineered specifically for Indian dining and group trips. Powered by AI Receipt Scanning, a Universal Multi-Rate Tax & Discount Engine, and instant UPI QR settlement, Ekwly routes every rupee of Food GST, Bar VAT, Service Charge, and restaurant discounts strictly to the people who ordered those items.

✦ WHY EKWLY IS DIFFERENT

1. AI MAGIC BILL SCANNER (OCR)
• Snap a photo of any paper restaurant bill.
• Ekwly’s AI Vision extracts every dish, quantity, unit price, tax bracket, service charge, and discount in 5 seconds.
• Zero cloud photo storage: your receipt photo is processed in-memory and discarded immediately for complete privacy.

2. EXACT INDIAN GST, BAR VAT & SERVICE CHARGE ROUTING
• Route Food GST (5%), Bar/Liquor VAT, Aerated/Sin GST (28%), and Exempt MRP items independently on the same bill.
• Supports cascading Service Charges, independent Service Charges taxed under Food GST, or untaxed Service Charges.
• Not sure how the restaurant taxed the Service Charge? Type the printed Grand Total and Ekwly’s Auto-Detect Solver matches the restaurant’s exact POS formula automatically.

3. 3-LAYER SIMULTANEOUS DISCOUNTS & OFFERS
• Layer 1 (Item & Category Offers): Apply Happy Hour or 50% off Dessert strictly to specific dishes.
• Layer 2 (Selective Pre-Tax Restaurant Discounts): Apply 10%–25% off Food while excluding Alcohol/MRP items with 1 tap.
• Layer 3 (Post-Tax App & Bank Coupons): Subtract dining app or credit card discounts after taxes while conserving every paisa.

4. SOLO-HOST FIRST OR LIVE MULTIPLAYER VIA QR
• Designated Treasurer Mode: One person can log and split the entire table’s bill on a single phone in seconds.
• Live Table QR: Friends at the table can scan your Room QR to join live and tap the dishes they shared.
• Saved Squads: Save your regular groups ("Flatmates", "Friday Crew", "Office Lunch") and populate your entire table in 1 tap.

5. INSTANT UPI LINKS, HOST SCREEN QR & RECEIPT TICKETS
• Show a dynamic, amount-prefilled UPI QR code right on your phone screen so friends at the table can scan and pay via Google Pay, PhonePe, Paytm, or BHIM.
• Share skeuomorphic Receipt Summary Images and personalized 1-on-1 Payment Cards (with embedded UPI QR codes) directly to WhatsApp.
• Export itemized, executive-grade PDF Bill Statements.

6. BILATERALLY NETTED GLOBAL LEDGER & TRIP FOLDERS
• If you owe a friend ₹300 from Tuesday and they owe you ₹800 from Friday, Ekwly automatically nets the balance to ₹500.
• Group multiple bills from a weekend getaway into a Trip Folder and settle the entire trip in one consolidated transfer per person.
• Moving from another app? Import your historical Splitwise CSV in 1 tap.

✦ 100% FREE FOREVER CORE
• Unlimited bill-splitting rooms, items, and members
• Full Multi-Rate Tax & 3-Layer Discount Engine
• Saved Squads, Global Netted Ledger, UPI QR & PDF Exports
• 3 Free AI Magic Receipt Scans every calendar month

Optional Ekwly Pro plans (including a 7-Day Trip Pass) unlock unlimited AI Magic Scans and Personal Dining Analytics (Food vs. Drinks vs. Tax Spend Audits & Top Venue Leaderboards).

 Note: Ekwly is a collaborative bill calculation and expense ledger utility. Ekwly does not hold funds or process money transfers; all UPI payments occur directly between users via their installed UPI apps using standard NPCI upi://pay links.
```

---

## 2. Graphic Assets Checklist (`brand-kit/`)

| Asset Type            | Dimensions                                | Source File in Repository                                                   |
| :-------------------- | :---------------------------------------- | :-------------------------------------------------------------------------- |
| **Hi-Res App Icon**   | `512 × 512` (32-bit PNG)                  | `public/icon-512.png` (from `brand-kit/export-png-and-gif.html`)            |
| **Feature Graphic**   | `1024 × 500` (PNG/JPEG)                   | `play-store-feature-graphic.png` (from `brand-kit/export-png-and-gif.html`) |
| **Phone Screenshots** | `1080 × 1920` or `1080 × 2400` (4–6 PNGs) | Capture from `pnpm dev` / device using the 6-Frame Storyboard below         |

### 6-Frame Phone Screenshot Storyboard

1. **Frame 1 — Live Skeuomorphic Bill Split (`ReceiptWorkbench.tsx`):**
   - _Headline:_ **Split Group Bills in 15 Seconds**
   - _Subheadline:_ Tap names right on the live receipt — exact to the last rupee.
2. **Frame 2 — AI Magic Bill Scanner (`MagicScanner.tsx`):**
   - _Headline:_ **Snap Any Receipt with AI Magic**
   - _Subheadline:_ Auto-extracts dishes, quantities, GST/VAT & discounts in 5 seconds.
3. **Frame 3 — Zero-Jargon Tax & Service Charge Solver (`WorkbenchRuleDrawers.tsx`):**
   - _Headline:_ **Route Food GST & Bar Taxes Fairly**
   - _Subheadline:_ Auto-detects the restaurant’s exact Service Charge & discount math.
4. **Frame 4 — Instant UPI QR & Shareable Receipt Ticket (`DebtMatrix.tsx`):**
   - _Headline:_ **Collect Instantly via UPI QR**
   - _Subheadline:_ Show a live UPI QR at the table or share receipt tickets on WhatsApp.
5. **Frame 5 — Command Center, Saved Squads & Trip Folders (`Home.tsx`):**
   - _Headline:_ **1-Tap Squads & Multi-Bill Trips**
   - _Subheadline:_ Add your regular crew in 1 tap or consolidate an entire weekend trip.
6. **Frame 6 — Bilaterally Netted Global Ledger (`Ledger.tsx`):**
   - _Headline:_ **Auto-Netted Balances & CSV Import**
   - _Subheadline:_ Opposing debts cancel out automatically. Import Splitwise CSVs in 1 tap.

---

## 3. Google Play Console Compliance Questionnaire Answers

### 3.1 Privacy Policy & Account Deletion URLs

- **Privacy Policy URL:** `[https://lakshit-loy-dutta.github.io/ekwly/privacy](https://lakshit-loy-dutta.github.io/ekwly/privacy)`
- **Account & Data Deletion URL:** `[https://lakshit-loy-dutta.github.io/ekwly/delete-account](https://lakshit-loy-dutta.github.io/ekwly/delete-account)`
- **In-App Deletion Path:** _Top-Right Avatar $\rightarrow$ Edit Profile (Pencil) $\rightarrow$ Delete Account Permanently (Type `DELETE`)_.

### 3.2 Data Safety Section Answers

- **Does your app collect or share any of the required user data types?** `Yes`
- **Is all of the user data collected by your app encrypted in transit?** `Yes` (HTTPS/TLS 1.3 enforced with `cleartext: false` in `capacitor.config.json`).
- **Do you provide a way for users to request that their data be deleted?** `Yes` (Both instant in-app cascading deletion and web deletion portal at `/delete-account`).
- **Data Types Collected (Not Shared with 3rd Parties for Advertising):**
  1. **Personal Info $\rightarrow$ Name & Email Address:** Collected for Account Management & App Functionality (Optional if using Guest Mode).
  2. **Financial Info $\rightarrow$ User Payment Info (Optional UPI ID / VPA):** Collected strictly so friends in a shared session can generate a `upi://pay` link or QR code to pay the user.
  3. **Photos and Videos $\rightarrow$ Photos (Receipt Images):** **Ephemeral Processing Only.** Mark _"Yes, this data is processed ephemerally"_ — images are compressed in-memory to extract receipt text via Gemini Vision API and immediately discarded without ever being saved to disk or cloud storage.

### 3.3 Financial Features Declaration (Play Console Policy)

- **Classification:** Select **"My app does not provide any financial products or services"** (or Expense Tracker / Calculator utility).
- **Explanation for Reviewer (if prompted):** _"Ekwly is a collaborative restaurant bill calculator and shared expense ledger. It does not provide loans, banking, wallets, or payment processing. Users settle balances peer-to-peer outside the app using standard NPCI `upi://pay` deep links."_

### 3.4 App Access (Instructions for Google Play Reviewers)

- Choose **"All or some functionality in my app is restricted"** and provide:
  - **Instruction 1 (Zero-Login Guest Access):** _"Reviewers can tap 'Split a Bill Now as Guest' on the initial screen to test 100% of the bill-splitting, tax routing, QR generation, and PDF export features immediately without creating an account."_
  - **Instruction 2 (Google / Email Sign-In):** _"Reviewers may also sign in with any Google account or Email Magic Link."_
