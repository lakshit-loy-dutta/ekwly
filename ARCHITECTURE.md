# Ekwly — Architecture, Engineering Standards & Product Roadmap (`ARCHITECTURE.md`)

> **Version:** 1.0.0-rc1 (Milestones 1–12 Complete + Full Senior Engineering, UI/UX & Database Audit Spec)  
> **Repository Visibility:** Private Proprietary Repository  
> **Stack:** Astro 7 + React 19 + Tailwind CSS v4 + Supabase (Postgres, Auth, Realtime, Edge Functions) + Capacitor 8 (Android & iOS) + Google Gemini Vision API  
> **Package Manager:** `pnpm` (v12+ strictly enforced)  
> **Core Constraint:** ₹0 Hosting & Operational Cost Architecture + 60Hz–240Hz Frame-Rate Budget (`<4.1ms/frame`)

---

## 1. System Overview & Core Value Proposition

**Ekwly** is a high-frame-rate (60Hz–240Hz), solo-and-multiplayer restaurant bill-splitting, Indian POS multi-bracket tax routing, and social dining ledger application.

1. **Solo-Host First, Multiplayer Ready:** Optimized for the "Designated Treasurer" who logs and splits a group bill from a paper receipt or memory in under 20 seconds using Zero-Friction Room Entry, a front-and-center AI Magic Bill Scanner, 1-tap Friend/Squad chips, and inline item avatar pills—while seamlessly scaling to live QR multiplayer when friends join.
2. **Multi-Bracket Itemized Taxation:** Routes Food GST (5%), Alcohol VAT (0%–25% state-dependent), Aerated/Sin GST (28%), and Tobacco GST (40%) strictly to the members who consumed those specific items.
3. **3-Layer Simultaneous Discount Pipeline:** Models real-world Indian restaurant bills where Item/Category offers (e.g., Happy Hour Beer or 50% off Dessert), Selective Pre-Tax Restaurant Discounts (e.g., 15% off Food only, excluding Alcohol), and Post-Tax App/Bank Coupons (e.g., Swiggy Dineout / Zomato Gold) occur on the same receipt.
4. **Dual Service Charge (S.C.) Topologies with Auto-Detection Solver:**
   - **Model A (`inherit` / Standard Cascading):** Item tax is computed on `(Effective Base + Item S.C.)`.
   - **Model B (`<uuid>` / Global Bracket):** Line items are taxed strictly on `Effective Base`, while aggregated Service Charge is taxed independently under a global preset (such as 5% Food GST).
   - **Model C (`none` / Untaxed):** Service Charge is added flat without additional tax.
   - **Auto-Detect Solver (`WorkbenchRuleDrawers.tsx`):** Computes live rupee previews (`Total Tax` & `Bill Total`) for all 3 models simultaneously and lets the user enter the printed Grand Total from their paper bill to automatically select the exact model used by the restaurant's POS.
5. **AI Receipt OCR ("Magic Scan"):** Client-side `<canvas>` compression (`max 1400px`, `0.82` JPEG) paired with `gemini-3.5-flash-lite` via Supabase Edge Functions using Chain-of-Thought (CoT) math verification and single-shot batch DB insertion.
6. **Viral WhatsApp Bento Receipt Cards & Instant UPI Settlement:** Generates shareable `1080px` dark-mode receipt infographic cards (`bentoReceipt.ts`) with embedded scannable UPI QR codes, native `upi://pay` deep links, Host-screen dynamic UPI QR codes (with anti-spoofing `Verified UPI` badges), and context-aware WhatsApp nudges.

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
│   └── svg/                              # 13 production SVG brand marks, wordmarks & 3 loader animations
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
│       └── 20261022_db_audit_fixes.sql   # Milestone 12.5: security_invoker views, REPLICA IDENTITY FULL, search_path
├── src/
│   ├── env.d.ts                          # Global TypeScript declarations & env contracts (Supabase + Razorpay)
│   ├── pages/                            # Astro static routes (index, privacy, terms, refunds, delete-account)
│   ├── layouts/LegalLayout.astro         # Shared layout for compliance & legal pages with [E=]kwly wordmark header
│   ├── styles/
│   │   ├── global.css                    # Tailwind v4 entry point
│   │   ├── theme.css                     # Design tokens (Light/Dark OLED palettes, --brand-kwly, status colors)
│   │   ├── base.css                      # Layered (@layer base) form reset, tabular-nums, .gpu-layer, safe-area
│   │   └── components.css                # Custom switches, grid textures, gradients, .pos-receipt tokens
│   ├── lib/
│   │   ├── types.ts                      # Canonical TypeScript interfaces
│   │   ├── supabase.ts                   # Singleton Supabase client
│   │   ├── swrCache.ts                   # In-memory Stale-While-Revalidate cache for 0ms BottomDock tab switches
│   │   ├── razorpay.ts                   # 3-Tier Plan Specs (₹49 Trip Pass, ₹99/mo, ₹799/yr) & Checkout loader
│   │   ├── bentoReceipt.ts               # Client-side <canvas> WhatsApp Bento Receipt Infographic generator
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
│   │   ├── pdf.ts                        # Dynamic ESM PDF generator (explicit 'download' & 'share' modes)
│   │   ├── utils.ts                      # Fractions, GCD, haptics, UPI URI, WhatsApp, bilateral netting & squads
│   │   └── utils.test.ts                 # Vitest unit suite for fractions, GST, UPI, netting & dossier stats
│   └── components/
│       ├── AppRouter.tsx                 # Zero-flash Auth Boot Guard, <BrandWordmark/> header, Offline Pill & BottomDock
│       ├── Auth.tsx                      # <BrandWordmark/> hero, Google OAuth, Magic Link OTP & Guest CTA
│       ├── Home.tsx                      # Dashboard, Netted Ledger hero card, Quick Action Bar & recent rooms
│       ├── Analytics.tsx                 # Pro Category Spend Audit, Top Venues, Debtor Concentration & CSV Export
│       ├── Lobby.tsx                     # Focused Room Join Gateway (QR Scanner + Room ID & 4-Digit PIN)
│       ├── ActiveSession.tsx             # Translucent 2-Tab Session orchestrator + 1-Tap Cashier Payer Chips
│       ├── Ledger.tsx                    # Bilaterally netted receivables/payables, UPI QR, WhatsApp & CSV import
│       ├── Friends.tsx                   # Social Dining Network: Live Search, Co-Diners, Saved Squads & Dossier
│       ├── Profile.tsx                   # Identity, UPI VPA configuration, Personal UPI Receive QR & deletion
│       ├── PwaUpdater.tsx                # Service worker lifecycle & update banner
│       ├── session/                      # Active room modules:
│       │   ├── ReceiptWorkbench.tsx      # Quota-aware Magic Scan Hero, Collapsible Rules, Sawtooth Live Bill Split
│       │   ├── WorkbenchRuleDrawers.tsx  # Auto-Detect Service Charge, 3-Layer Discounts & Tax Templates
│       │   ├── DebtMatrix.tsx            # Collection Tray, WhatsApp Bento Card, Verified UPI Shields & PDF actions
│       │   ├── MagicScanner.tsx          # Native/Web camera capture, <canvas> compression & batch DB insert
│       │   └── Payments.tsx              # Multi-payer restaurant cashier input drawer
│       └── ui/                           # Primitives (AnimatedNumber, SpotlightTour, ProUpgradeSheet, BottomDock, BottomSheet, BrandLoader, ConfirmSheet, QrScannerModal)
├── ARCHITECTURE.md                       # Authoritative system specification & roadmap
├── BRAND_IDENTITY.md                     # Locked v3 logo geometry, safe-zone icon rules & motion choreography
├── DESIGN_SYSTEM.md                      # 240Hz rendering rules, tokens & UX specification
├── PROJECT-STATE.md                      # Development handoff & issue tracker ledger
├── astro.config.mjs                      # Conditional base path & PWA manifest (explicit 'any' + 'maskable' icons)
├── capacitor.config.json                 # Native Android/iOS WebView container (cleartext: false TLS enforced)
├── package.json                          # Dependencies & build scripts
└── repomix.config.ts                     # Context packing config
```

---

## 3. Core Mathematical Specification (`src/lib/mathEngine.ts`)

Every UI component, PDF export, Bento Receipt card, and settlement calculation uses `mathEngine.calculateItemBreakdown` and `mathEngine.generateSplit` as the single source of truth:

1. **Layer 1 — Per-Item & Category/Section Discounts (`item.discountType`, `item.discountValue`):**
   - For each item $i$ with raw base $B_i = \text{qty}_i \times \text{unitPrice}_i$:
     - If `item.discountType === 'percentage'`, $D_{\text{item}, i} = \min(B_i, B_i \times \frac{v_i}{100})$.
     - If `item.discountType === 'flat'`, $D_{\text{item}, i} = \min(B_i, v_i)$.
   - When a flat ₹ discount is applied to a multi-item category in `WorkbenchRuleDrawers.tsx`, it distributes proportionally across the selected items by their share of the category base.
   - Base after item discount: $B'_{i} = \max(0, B_i - D_{\text{item}, i})$.
2. **Layer 2 — Selective Pre-Tax Restaurant Discount (`discountType`, `discountValue`, `item.applyDiscount`):**
   - Eligible pre-tax subtotal: $S_{\text{elig}} = \sum_{i: \text{applyDiscount}_i \neq \text{false}} B'_i$.
   - Pre-tax multiplier: $M_{\text{pre}} = \frac{S_{\text{elig}} - D_{\text{pre}}}{S_{\text{elig}}}$ for eligible items, and $1$ for excluded items (`applyDiscount === false`).
   - Taxable effective base: $E_i = B'_i \times M_{\text{pre}}$.
3. **Service Charge Topologies, Per-Item Applicability (`applySC`) & Auto-Detection:**
   - Item Service Charge: $\text{SC}_i = (\text{isScApplicable} \land \text{applySC}_i) ? E_i \times r_{\text{sc}} : 0$.
   - `scTaxPresetId === 'inherit'` (Model A — Cascading): Taxes $(E_i + \text{SC}_i)$ at the item's tax rate $r_{\text{tax}, i}$.
   - `scTaxPresetId === '<uuid>'` (Model B — Independent Global Bracket): Taxes $E_i$ at $r_{\text{tax}, i}$ and taxes $\text{SC}_i$ at the selected global preset rate $r_{\text{scTax}}$.
   - `scTaxPresetId === 'none'` (Model C — Untaxed): Taxes $E_i$ at $r_{\text{tax}, i}$ and leaves $\text{SC}_i$ untaxed.
   - **Auto-Detection Solver:** Evaluates `generateSplit` across all three topologies (`inherit`, `foodPresetId`, `none`) and selects $\arg\min_{m} \vert{}\text{GrandTotal}_m - \text{PrintedTotal}\vert{}$ when within `₹2.00`.
4. **Custom Tax Presets & CGST/SGST Split (`preset.split`):**
   - Any tax bracket with `split: true` automatically divides its accumulated amount 50/50 into `CGST` and `SGST` lines.
5. **Layer 3 — Simultaneous Post-Tax Coupon/App Discount (`postTaxDiscountType`, `postTaxDiscountValue`):**
   - Gross total before post-tax discount: $G = \sum E_i + \sum \text{SC}_i + \sum \text{Taxes}$.
   - Post-tax discount $D_{\text{post}}$ (`percentage` or `flat`) is subtracted from $G$: $T_{\text{raw}} = G - D_{\text{post}}$.
6. **POS Round-Off & Paisa Conservation Invariant:**
   - $\text{GrandTotal} = \text{Math.round}(T_{\text{raw}})$ and $\text{RoundOff} = \text{GrandTotal} - T_{\text{raw}}$.
   - Individual member shares scale by $\frac{\text{GrandTotal}}{G}$.
   - When all items are 100% claimed, $\sum_m \text{totalOwed}_m \equiv \text{GrandTotal}$ to the exact paisa (`₹0.01`). Any `±0.01–0.05` floating-point drift is absorbed by the member with the largest share via the Paisa Conservation Pass.

---

## 4. Database Security, RLS & Free-Tier Efficiency Architecture (`schema_dump_2.sql`)

### 4.1 Row Level Security & View Security

1. **Host Ownership Enforcement (`public.sessions`, `public.items`, `public.tax_presets`):**
   - Only `sessions.host_id = auth.uid()` can update session rules/status, mutate `items` or `tax_presets`, or delete a session.
2. **Locked-Bill Immutability (`public.enforce_session_lock_integrity`):**
   - `BEFORE INSERT OR UPDATE OR DELETE` trigger on `items`, `claims`, and `tax_presets` rejects any modification when `sessions.status = 'locked'`.
3. **Ledger Settlement Guard (`public.ledger`):**
   - Only the Host, `creditor_id`, or `debtor_id` can update `ledger.settled`.
4. **Billing Quota & Pro Status Guard (`public.protect_profile_billing_columns`):**
   - Prevents any non-`service_role` request from modifying `pro_expires_at` or decrementing `ai_scans_used`.
5. **Security Invoker Views & Profile Privacy (Milestone 12.5 Hardening):**
   - `public.global_ledger` and `public.personal_analytics` enforce `security_invoker = true` (with `anon` access revoked) so underlying table RLS policies are always respected.
   - `public.profiles` requires `auth.uid() IS NOT NULL` for `SELECT` so unauthenticated bots cannot scrape user emails or VPAs.

### 4.2 Realtime WebSockets & Replica Identity Architecture

- **Lazy WebSockets (`useSessionSync.ts`):** Realtime `postgres_changes` listeners stay dormant in Solo Mode and activate only when `Invite QR` is opened, `Solo Mode` is toggled to `Live Sync`, or >1 user links to the room.
- **`REPLICA IDENTITY FULL` on Session Child Tables (`items`, `members`, `claims`, `tax_presets`):** Ensures PostgreSQL WAL `DELETE` records include `session_id` so Supabase Realtime's `filter: session_id=eq.${sessionId}` broadcasts item, claim, member, and tax deletions reliably to all connected peers.

### 4.3 Indexing & Automated Storage Hygiene

- **16 B-Tree & GIN Indexes:**
  - Foreign Key & Partial Indexes: `idx_claims_session_id`, `idx_connections_friend_id`, `idx_connections_unique_pair`, `idx_items_session_id`, `idx_items_tax_preset_id`, `idx_ledger_creditor_unsettled`, `idx_ledger_debtor_unsettled`, `idx_ledger_session_id`, `idx_members_session_id`, `idx_members_user_id`, `idx_sessions_host_id`, `idx_sessions_venue_name`, `idx_tax_presets_session_id`.
  - Trigram GIN Indexes (`gin_trgm_ops`): `idx_venues_name_trgm`, `idx_profiles_name_trgm`, and `idx_items_name_trgm` power `<5ms` fuzzy autocomplete.
- **Automated 7-Day Storage Hygiene (`prune_stale_data`):**
  - Invoked once every 7 days (`ekwly_last_prune_ts` in `AppRouter.tsx`) to purge empty claims, abandoned draft sessions (>30 days old with no ledger rows), and stale anonymous guest accounts (>30 days old).

---

## 5. Master Engineering Roadmap

- [x] **Milestones 1–12 (`v0.1.0` – `v1.0.0-rc1`):** Universal Tax & 3-Layer Discount Engine, Gemini 3.5 Flash-Lite CoT OCR, 2-Tab Workbench, 32-Tooth SVG Sawtooth Live Bill Split, Auto-Detect Service Charge Solver, Host UPI QR, Bilateral Netting, Social Dining Network (`Friends.tsx` 2.0), Lazy WebSockets, Portal Modals, 0ms `swrCache.ts`, Hardened RLS, Locked-Bill Immutability, Brand Identity v3, Zero-Flash Auth Boot Guard, `<SpotlightTour/>`, `<AnimatedNumber/>`, WhatsApp Bento Receipt Card Generator (`bentoReceipt.ts`), Category Spend Audit, and 3-Tier `<ProUpgradeSheet/>`.
- [ ] **Milestone 12.5 (`v1.0.0-rc2` — Next Up: Code Audit & Database Hardening Sweep):**
  - Apply `supabase/migrations/20261022_db_audit_fixes.sql` (`DB-01` to `DB-06`).
  - Resolve `ENG-01` to `ENG-08` and `UX-05` to `UX-09`.
- [ ] **Milestone 13 (`v1.0.0` — Production Release Packaging & Google Play Store Launch Kit):**
  - Signed `.aab`/`.apk` Release Builder in `scripts/configure-native.mjs` and Google Play Store Launch Kit.
- [ ] **Milestone 14 (`v1.1.0` — Post-1.0 Desktop Pro Split-Screen Workbench):**
  - Responsive 2-column desktop layout (`lg:grid-cols-12`) with keyboard shortcuts.
