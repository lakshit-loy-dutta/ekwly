# Ekwly — Architecture, Engineering Standards & Product Roadmap (`ARCHITECTURE.md`)

> **Version:** 1.0.0-rc4 (Skeuomorphic Receipt Image & 1-on-1 Nudge Card Engine, Multi-Creditor UPI QR Embedding, Executive PDF Statement Generator, Dynamic PWA Theme-Color Sync & Full Audit Hardening)  
> **Repository Visibility:** Private Proprietary Repository  
> **Stack:** Astro 7 + React 19 + Tailwind CSS v4 + Supabase (Postgres, Auth, Realtime, Edge Functions) + Capacitor 8 (Android & iOS) + Google Gemini Vision API  
> **Package Manager:** `pnpm` (v12+ strictly enforced)  
> **Core Constraint:** ₹0 Hosting & Operational Cost Architecture + 60Hz–240Hz Frame-Rate Budget (`<4.1ms/frame`)

---

## 1. System Overview & Core Value Proposition

**Ekwly** is a high-frame-rate (60Hz–240Hz), solo-and-multiplayer restaurant bill-splitting, Indian POS multi-bracket tax routing, and social dining ledger application.

1. **Solo-Host First, Multiplayer Ready:** Optimized for the "Designated Treasurer" who logs and splits a group bill from a paper receipt or memory in under 20 seconds using Zero-Friction Room Entry, a front-and-center AI Magic Bill Scanner, 1-tap Friend/Squad chips, and inline item avatar pills—while seamlessly scaling to live QR multiplayer when friends join.
2. **Multi-Bracket Itemized Taxation:** Routes Food GST (5%), Alcohol VAT (0%–25% state-dependent), Aerated/Sin GST (28%), and Tobacco GST (40%) strictly to the members who consumed those specific items.
3. **3-Layer Simultaneous Discount Pipeline:** Models real-world Indian restaurant bills where Item/Category offers, Selective Pre-Tax Restaurant Discounts (with per-item Alcohol/MRP exclusions), and Post-Tax App/Bank Coupons occur on the same receipt.
4. **Dual Service Charge (S.C.) Topologies with Auto-Detection Solver:**
   - **Model A (`inherit` / Standard Cascading):** Item tax is computed on `(Effective Base + Item S.C.)`.
   - **Model B (`<uuid>` / Global Bracket):** Line items are taxed strictly on `Effective Base`, while aggregated Service Charge is taxed independently under a global preset (such as 5% Food GST).
   - **Model C (`none` / Untaxed):** Service Charge is added flat without additional tax.
   - **Auto-Detect Solver (`WorkbenchRuleDrawers.tsx`):** Computes live rupee previews (`Total Tax` & `Bill Total`) for all 3 models simultaneously and lets the user enter the printed Grand Total from their paper bill to automatically select the exact model used by the restaurant's POS.
5. **Skeuomorphic Receipt Images, 1-on-1 Nudge Cards & Executive PDFs:**
   - **Full Receipt Image (`exportBentoReceiptImage` in `bentoReceipt.ts`):** Client-side `<canvas>` generator that renders a 28-tooth skeuomorphic receipt ticket with individual shares, settlement transfers, and embedded Scan-to-Pay UPI QRs for **all creditors owed money**.
   - **1-on-1 WhatsApp Payment Card (`exportPersonalNudgeImage` in `bentoReceipt.ts`):** Generates a personalized receipt ticket for a single friend (in `DebtMatrix.tsx` and `Ledger.tsx`) showing their itemized dishes, exact amount due, and a pre-filled UPI QR code.
   - **Executive PDF Statement (`generatePDF` in `pdf.ts`):** Vector-branded A4 statement with a 4-column KPI strip, itemized tax routing table, 3-layer accounting summary, and settlement plan with UPI VPAs.

---

## 2. Complete Directory & Module Architecture

```text
├── .github/workflows/
│   ├── deploy.yml                        # CI unit test & static build pipeline
│   └── build-native.yml                  # On-demand manual workflow_dispatch APK & IPA builder
├── .vscode/
│   ├── extensions.json                   # Workspace extension recommendations
│   └── settings.json                     # Formatter, Tailwind, Deno, JDK 21 & Gradle 8.14.3 config
├── brand-kit/
│   ├── export-png-and-gif.html           # 1-click browser exporter for ICO, Maskable PNGs & 60fps WebM
│   └── svg/                              # 14 production SVG brand marks, wordmarks & 3 loader animations
├── scripts/
│   ├── configure-native.mjs              # Auto-links JBR 21/SDK 36, pins Gradle 8.14.3/AGP 8.13.0, patches Manifest/Info.plist & builds APKs
│   └── generate-brand-assets.mjs         # Generates all vector SVGs, multi-size .ICO packer & Safe-Zone PNG exporter
├── supabase/
│   ├── functions/
│   │   ├── scan-receipt/index.ts         # Deno Edge Function: Auth, Quota Reset, Gemini 3.5 Flash-Lite 3-Layer OCR
│   │   └── razorpay-webhook/index.ts     # Deno Edge Function: HMAC-SHA256 verification & Pro activation
│   └── migrations/
│       ├── 20261019_indexes_and_pruning.sql
│       ├── 20261020_multi_layer_discounts.sql
│       ├── 20261021_security_rls_lockdown.sql
│       └── 20261022_db_audit_fixes.sql   # security_invoker views, REPLICA IDENTITY FULL, search_path, GIN indexes
├── src/
│   ├── env.d.ts                          # Global TypeScript declarations & env contracts (Supabase + Razorpay)
│   ├── pages/                            # Astro static routes (index, privacy, terms, refunds, delete-account)
│   ├── layouts/LegalLayout.astro         # Shared layout for compliance & legal pages with [E=]kwly wordmark header
│   ├── styles/
│   │   ├── global.css                    # Tailwind v4 entry point
│   │   ├── theme.css                     # Design tokens (Light/Dark OLED palettes, --brand-kwly, status colors)
│   │   ├── base.css                      # Layered (@layer base) form reset, .receipt-select, tabular-nums, safe-area
│   │   └── components.css                # .glass-chrome, .glass-card, gradients, seamless .pos-receipt tokens
│   ├── lib/
│   │   ├── types.ts                      # Canonical TypeScript interfaces
│   │   ├── supabase.ts                   # Singleton Supabase client
│   │   ├── swrCache.ts                   # In-memory Stale-While-Revalidate cache for 0ms BottomDock tab switches
│   │   ├── razorpay.ts                   # 3-Tier Plan Specs (₹49 Trip Pass, ₹99/mo, ₹799/yr) & Checkout loader
│   │   ├── bentoReceipt.ts               # Skeuomorphic Receipt Image & 1-on-1 Personal Nudge Card <canvas> engine
│   │   ├── mathEngine.ts                 # 3-Layer Discount, Indian POS Tax, Paisa Conservation & Settlement engine
│   │   ├── mathEngine.test.ts            # Vitest unit suite (Model A, Model B, Pre-Tax & 3-Layer Discounts)
│   │   ├── splitwiseCsv.ts               # Splitwise CSV parser & greedy pairwise balance extractor
│   │   ├── splitwiseCsv.test.ts          # Vitest unit suite for Splitwise CSV migration
│   │   ├── useSession.ts                 # Thin composer hook re-exporting sync + mutation sub-hooks
│   │   ├── session/                      # Modularized Session Architecture:
│   │   │   ├── offlineQueue.ts           # Promise-locked localStorage mutation queue
│   │   │   ├── useSessionSync.ts         # Parallel fetch & lazy-activated Realtime WebSocket listeners
│   │   │   └── useSessionMutations.ts    # Memoized optimistic UI + batch & offline-aware CRUD mutations
│   │   ├── SessionContext.tsx            # React Context provider with verified DB host ownership
│   │   ├── pdf.ts                        # Executive PDF Statement generator (strictly typed PdfSessionDetails)
│   │   ├── utils.ts                      # Fractions, GCD, haptics, UPI URI, WhatsApp, bilateral netting & squads
│   │   └── utils.test.ts                 # Vitest unit suite for fractions, GST, UPI, netting & dossier stats
│   └── components/
│       ├── AppRouter.tsx                 # Zero-flash Auth Boot Guard, <BrandWordmark/> header, Offline Pill & BottomDock
│       ├── Auth.tsx                      # <BrandWordmark/> hero, Google OAuth, Magic Link OTP & Guest CTA
│       ├── Home.tsx                      # Command Center: Netted Ledger Hero, 1-Tap Squads & Unified Bills/Trips Tabs
│       ├── Analytics.tsx                 # Pro Category Spend Audit, Top Venues, Debtor Concentration & CSV Export
│       ├── Lobby.tsx                     # Focused Room Join Gateway (QR Scanner + Room ID & 4-Digit PIN)
│       ├── ActiveSession.tsx             # Translucent 2-Tab Session orchestrator + 1-Tap Cashier Payer Chips
│       ├── Ledger.tsx                    # Bilaterally netted balances, 1-on-1 Payment Cards, UPI QR & CSV import
│       ├── Friends.tsx                   # Social Dining Network: Live Search, Co-Diners, Saved Squads & Dossier
│       ├── Profile.tsx                   # Identity, UPI VPA configuration, Personal UPI Receive QR & deletion
│       ├── PwaUpdater.tsx                # Service worker lifecycle & update banner
│       ├── session/                      # Active room modules:
│       │   ├── ReceiptWorkbench.tsx      # Quota-aware Magic Scan Hero, Collapsible Rules, Tidy 3-Row Sawtooth Receipt
│       │   ├── WorkbenchRuleDrawers.tsx  # Auto-Detect Service Charge, 3-Layer Discounts & Tax Templates
│       │   ├── DebtMatrix.tsx            # Collection Tray, Multi-Creditor Receipt Image, 1-on-1 Nudge Cards & PDF
│       │   ├── MagicScanner.tsx          # Native/Web camera capture, <canvas> compression & batch DB insert
│       │   └── Payments.tsx              # Bento Multi-Payer drawer with 1-Tap [+ Fill Remaining] pills
│       └── ui/                           # Primitives (AnimatedNumber, SpotlightTour, ProUpgradeSheet, BottomDock, BottomSheet, BrandLoader, ConfirmSheet, QrScannerModal)
├── ARCHITECTURE.md                       # Authoritative system specification & roadmap
├── BRAND_IDENTITY.md                     # Locked v3 logo geometry, safe-zone icon rules & motion choreography
├── DESIGN_SYSTEM.md                      # 240Hz rendering rules, tokens & UX specification
├── PROJECT-STATE.md                      # Development handoff & issue tracker ledger
├── astro.config.mjs                      # Conditional base path & PWA manifest (explicit 'any' + 'maskable' icons)
├── capacitor.config.json                 # Native Android/iOS WebView container (cleartext: false TLS enforced)
├── package.json                          # Dependencies & build scripts (v1.0.0)
└── repomix.config.ts                     # Context packing config
```

---

## 3. Master Engineering Roadmap

- [x] **Milestones 1–12.7 (`v0.1.0` – `v1.0.0-rc4`):** Complete.
- [ ] **Milestone 13 (`v1.0.0` — Next Up):** Signed `.aab`/`.apk` Release Builder in `scripts/configure-native.mjs` & Google Play Store Launch Kit.
- [ ] **Milestone 14 (`v1.1.0` — Post-1.0):** Desktop Pro Split-Screen Workbench (`lg:grid-cols-12`).
