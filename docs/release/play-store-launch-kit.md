# Ekwly — Google Play Store Launch, ASO & Compliance Kit

> **Release Target:** `1.0.0` (`versionCode: 1`) | **Application ID:** `com.ekwly.app`
> **Category:** Finance / Tools | **Pricing:** Free (Optional Pro Upgrades)

---

## 1. Mandatory Pre-Submission Engineering Blockers (Must Clear Before Upload)

Do **not** submit to Google Play or Apple App Store until these verified audit items are closed:

- [ ] **`AUD-09` (Store Payments Policy):** Remove the `mailto:` upgrade detour in `src/lib/razorpay.ts` on Capacitor builds (integrate Google Play Billing / StoreKit 2, or hide native upgrade purchase buttons until IAP is live).
- [ ] **`AUD-25` (Native OAuth & Magic Links):** Configure `com.ekwly.app://auth-callback` in `AndroidManifest.xml`, `Info.plist`, and Supabase `additional_redirect_urls` so sign-in returns to the native app.
- [ ] **`AUD-06` (Account Deletion Disclosure Accuracy):** Change `sessions.host_id` FK from `ON DELETE CASCADE` to `ON DELETE SET NULL` so shared session math stays intact as promised in `delete-account.astro`.
- [ ] **`AUD-10` & `AUD-16` (Native Stability & Signing):** Remove hardcoded keystore password fallback `'ekwlyRelease2026!'`, fix Android `WindowInsetsCompat.CONSUMED` keyboard handling in `MainActivity.java`, fix OTA bundle base path, and gate Workbox SW off native builds (`AUD-26`).
- [ ] **`AUD-01`–`AUD-04` & `AUD-24` (Security & API Abuse):** Harden RLS, `razorpay-webhook`, `protect_profile_billing_columns`, `prune_stale_data`, and `scan-receipt`.

---

## 2. Store Listing Copy (ASO Optimized)

### App Name (28 / 30 chars)

```text
Ekwly: Bill Split, Tax & UPI
```

### Short Description (80 / 80 chars)

```text
Split group bills in seconds with AI receipt scan, exact GST/VAT & 1-tap UPI QR.
```

### Full Description (4,000 chars max)

```text
Split restaurant, pub, and group trip bills in under 20 seconds — fair to the very last rupee.

Most bill-splitting apps divide the final total evenly or dump taxes into a single pot. When your group orders a mix of food, mocktails, and drinks, non-drinkers end up subsidizing high liquor taxes and service charges.

Ekwly is engineered specifically for Indian dining and group trips. Powered by AI Receipt Scanning, a Universal Multi-Rate Tax & Discount Engine, and instant UPI QR settlement, Ekwly routes every rupee of Food GST, Bar VAT, Service Charge, and restaurant discounts strictly to the people who ordered those items.

✦ WHY EKWLY IS DIFFERENT

1. AI MAGIC BILL SCANNER (OCR)
• Snap a photo of any paper restaurant bill.
• Ekwly’s AI Vision extracts every dish, quantity, unit price, tax bracket, service charge, and discount in seconds.
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
• Export itemized PDF Bill Statements.

6. BILATERALLY NETTED GLOBAL LEDGER & TRIP FOLDERS
• If you owe a friend ₹300 from Tuesday and they owe you ₹800 from Friday, Ekwly automatically nets the balance to ₹500.
• Group multiple bills from a weekend getaway into a Trip Folder and settle the entire trip in one consolidated transfer per person.
• Moving from another app? Import your historical Splitwise CSV in 1 tap.

✦ 100% FREE FOREVER CORE
• Unlimited bill-splitting rooms, items, and members
• Full Multi-Rate Tax & 3-Layer Discount Engine
• Saved Squads, Global Netted Ledger, UPI QR & PDF Exports
• 3 Free AI Magic Receipt Scans every calendar month

Note: Ekwly is a collaborative bill calculation and expense ledger utility. Ekwly does not hold funds or process money transfers; all UPI payments occur directly between users via their installed UPI apps using standard NPCI upi://pay links.
```

---

## 3. Graphic Assets & 6-Frame Screenshot Storyboard

| Asset                 | Dimensions                                | Source                                                                                         |
| :-------------------- | :---------------------------------------- | :--------------------------------------------------------------------------------------------- |
| **Hi-Res App Icon**   | `512 × 512` PNG                           | `public/icon-512.png`                                                                          |
| **Feature Graphic**   | `1024 × 500` PNG                          | Regenerate via `node scripts/generate-brand-assets.mjs` -> `brand-kit/export-png-and-gif.html` |
| **Phone Screenshots** | `1080 × 1920` or `1080 × 2400` (4–6 PNGs) | Capture from device/emulator using the 6 frames below                                          |

1. **Live Skeuomorphic Bill Split (`ReceiptWorkbench.tsx`):** _Split Group Bills in 15 Seconds_
2. **AI Magic Bill Scanner (`MagicScanner.tsx`):** _Snap Any Receipt with AI Magic_
3. **Zero-Jargon Tax & Service Charge Solver (`WorkbenchRuleDrawers.tsx`):** _Route Food GST & Bar Taxes Fairly_
4. **Instant UPI QR & Receipt Ticket (`DebtMatrix.tsx`):** _Collect Instantly via UPI QR_
5. **Command Center, Saved Squads & Trip Folders (`Home.tsx`):** _1-Tap Squads & Multi-Bill Trips_
6. **Bilaterally Netted Global Ledger (`Ledger.tsx`):** _Auto-Netted Balances & CSV Import_

---

## 4. Play Console Compliance Questionnaire

- **Privacy Policy URL:** [https://lakshit-loy-dutta.github.io/ekwly/privacy](https://lakshit-loy-dutta.github.io/ekwly/privacy)
- **Account & Data Deletion URL:** [https://lakshit-loy-dutta.github.io/ekwly/delete-account](https://lakshit-loy-dutta.github.io/ekwly/delete-account)
- **In-App Deletion Path:** _Top-Right Avatar -> Edit Profile (Pencil) -> Delete Account Permanently (Type `DELETE`)_.
- **Data Safety:**
  - Encrypted in transit: `Yes` (HTTPS/TLS, `cleartext: false`).
  - Deletion mechanism provided: `Yes`.
  - Collected (not shared for ads): Name & Email (Account Management), Optional UPI VPA (App Functionality), Receipt Photos (**Ephemeral Processing Only — zero persistent storage**).
- **Financial Features Declaration:** _My app does not provide any financial products or services_ (peer-to-peer bill calculator; payments happen externally via NPCI `upi://pay`).
- **Reviewer Access:** Reviewers can tap **"Split a Bill Now as Guest"** for immediate access without login, or sign in with Google/Email Magic Link.
