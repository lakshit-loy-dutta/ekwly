# Ekwly — Complete Project Handoff & State Ledger (`PROJECT-STATE.md`)

> **Last Updated:** October 21, 2026  
> **Current Version:** `v0.9.92` (Milestones 1–10 & Milestone 11 Part 1 Verified: Locked v3 Brand Logo & Unified SVG Wordmark, `generate-brand-assets.mjs`, Hardened RLS, Locked-Bill Immutability Trigger, Verified UPI Shields & Legal Compliance)  
> **Repository Visibility:** Private Proprietary Repository  
> **Core Constraint:** ₹0 Hosting & Operational Cost Architecture + 60Hz–240Hz Frame-Rate Budget (`<4.1ms/frame`)

---

## 1. Executive Summary & Confirmed Technology Stack

- **Product Domain:** High-frame-rate (60Hz–240Hz), Solo-Host-First ("Designated Treasurer") and live multiplayer restaurant bill-splitting, Indian POS multi-bracket tax routing (Food GST 5%, Alcohol VAT 0%–25%, Tobacco GST 28%–40%), 3-layer discount allocation (Item/Section, Selective Pre-Tax, Simultaneous Post-Tax), social dining network, and instant UPI settlement engine.
- **Frontend Framework:** Astro 7 (`^7.3.8`, strictly static output) + React 19 (`^19.3.0`, `React.lazy` route splitting + `swrCache.ts` 0ms tab state cache + `createPortal` modals) + TypeScript (`^7.0.2`).
- **Styling & Motion:** Tailwind CSS v4 (`^4.3.3` via `@tailwindcss/vite`, `@layer base` form reset) + Framer Motion (`^13.5.1`, analytical spring physics) + Lucide React (`^1.56.0`).
- **Backend & Database:** Supabase (`@supabase/supabase-js` `^2.117.3`) — PostgreSQL, Granular Row Level Security (RLS), Lazy Realtime WebSockets (`postgres_changes`), Auth (Google OAuth, Magic Link OTP, Anonymous Guest), and Deno Edge Functions.
- **AI Vision OCR:** `gemini-3.5-flash-lite` invoked via `supabase/functions/scan-receipt/index.ts` using strict JSON schema enforcement with a top-level `reasoning` Chain-of-Thought (CoT) math verification field and 3-layer discount extraction.
- **Native Mobile Wrapper:** Capacitor 8 (`@capacitor/core`, `@capacitor/android`, `@capacitor/ios` `^8.5.3`, `@capacitor/app` `^8.1.2`, `@capacitor/camera` `^8.2.5`, `@capacitor-mlkit/barcode-scanning` `^8.2.1`) with `cleartext: false` TLS enforcement.
- **Web Fallbacks & Utilities:** `@vite-pwa/astro` (`^1.2.0` Workbox Service Worker), `html5-qrcode` (`^2.3.8`, dynamically imported on web only), `react-qr-code` (`^2.2.0`), `jspdf` (`^4.2.1`) + `jspdf-autotable` (`^5.0.8`, dynamically imported on export).
- **Runtime, Testing & Tooling:** Node.js 24 (`.nvmrc`), `pnpm` v12+ (strictly enforced; never use `npm`/`yarn`), Vitest (`^5.0.4`, 14 unit tests across 3 suites), Repomix (`repomix.config.ts`).

---

## 2. Core Engineering & Financial Guardrails (`ARCHITECTURE.md`, `BRAND_IDENTITY.md`, `DESIGN_SYSTEM.md`, `UI_UX_REDESIGN.md`, `AGENTS.md`)

1. **₹0 Hosting & Operational Cost Guardrails:**
   - **Static Web Output:** Astro build output remains strictly static (`output: 'static'`) for free static hosting (GitHub Pages / Cloudflare Pages / Vercel) and local Capacitor packaging.
   - **Zero Cloud Image Storage:** Receipt images are compressed client-side on an HTML5 `<canvas>` (`max 1400px`, `0.82` JPEG quality) in `MagicScanner.tsx`, sent as Base64 to the `scan-receipt` Edge Function, and discarded immediately after extraction (0 bytes stored in Supabase Storage).
   - **Zero Cloud Media Storage for Social Features:** Saved Squads (`ekwly_squads_<uid>`) and Friendship Dining Dossiers operate purely on relational metadata and `localStorage` without media storage buckets.
   - **Batch Database Operations:** Never execute Supabase `.insert()`, `.upsert()`, or `.delete()` inside a `for...of` loop. Always use batch mutations (`addItemsBatchToDB`, `batchUpdateItemsInDB`, `addMembersBatchToDB`, `batchUpdateClaimsInDB`, `replaceTaxPresetsInDB`).
   - **Lazy Multiplayer WebSockets:** Realtime `postgres_changes` subscriptions remain dormant in Solo Mode and activate only when `Invite QR` is opened, `Solo Mode` is toggled to `Live Sync`, or >1 linked user joins the room.
   - **CI/CD Quota Protection:** `.github/workflows/build-native.yml` is strictly `on: workflow_dispatch` (manual trigger) so macOS/Linux cloud builds never drain private repo GitHub Actions minutes automatically.
2. **High-Refresh-Rate (60Hz / 90Hz / 120Hz / 144Hz / 240Hz) Rendering Rules:**
   - Animate **only** GPU-composited properties (`transform`, `opacity`, Framer Motion `layout="position"`). Never animate `height: 0 -> 'auto'` on list items.
   - Restrict `backdrop-filter: blur()` (`backdrop-blur-*`) and `.gpu-layer` strictly to fixed viewport chrome (Sticky Header, 2-Tab Switcher, `<BottomDock/>`, `<BottomSheet/>` overlay). Never apply `backdrop-blur` to repeating cards in scrolling lists.
   - Apply `tabular-nums` (`font-variant-numeric: tabular-nums`) to all currency amounts, quantities, fractions, percentages, and PINs.
   - Never use `window.alert`, `window.confirm`, or `window.prompt`. Always use `<ConfirmSheet/>` and `showToast`.
   - Never hardcode `/ekwly/` in components. Use `utils.resolvePath('...')` in `.tsx` and `import.meta.env.BASE_URL` in `.astro`.
3. **Free vs. Pro Tier Boundary:**
   - **Free Forever (₹0):** Unlimited rooms/items/splits, full Universal Tax & 3-Layer Discount Engine, crowd-sourced venue & menu autocomplete, 3 free AI Magic Scans/month (auto-resetting on UTC month rollover), Saved Squads, Friendship Dossiers, UPI deep links, Host UPI QR, WhatsApp nudges, Splitwise CSV import, bilateral balance netting, and PDF export.
   - **Ekwly Pro (₹99/mo, ₹799/yr, or ₹49 7-Day Trip Pass):** Unlimited AI Magic Scans and full Personal Analytics Dashboard (`Top Dining Venues` & `Top Outstanding Debtors`).

---

## 3. Database Schema, RLS & Indexing Verification Ledger (`schema_dump_3.sql` + Migration #4)

1. **Tables & Columns:**
   - `public.sessions`: `id`, `status`, `pin`, `host_id`, `is_sc_applicable`, `service_charge_rate`, `sc_tax_preset_id`, `discount_type`, `discount_value`, `discount_mode`, `post_tax_discount_type`, `post_tax_discount_value`, `venue_name`, `created_at`, `name`.
   - `public.items`: `id`, `session_id`, `name`, `qty`, `price`, `tax_preset_id`, `apply_sc`, `apply_discount`, `discount_type`, `discount_value`.
   - `public.members`: `id`, `session_id`, `name`, `user_id`, `paid_amount`.
   - `public.claims`: `session_id`, `item_id`, `member_id`, `value` (PK: `item_id, member_id`).
   - `public.tax_presets`: `id`, `session_id`, `name`, `rate`, `split`.
   - `public.ledger`: `id`, `session_id`, `creditor_id`, `debtor_id`, `creditor_fallback_name`, `debtor_fallback_name`, `amount`, `settled`, `created_at`.
   - `public.profiles`: `id`, `name`, `avatar_url`, `upi_id`, `phone`, `email`, `ai_scans_used`, `pro_expires_at`, `last_scan_reset`, `created_at`, `updated_at`.
   - `public.connections`: `user_id`, `friend_id`, `created_at`.
   - `public.venues`: `id`, `name`, `normalized_name`, `service_charge_rate`, `tax_presets`, `times_used`, `last_updated_at`.
2. **Views:**
   - `public.global_ledger`: Aggregates unsettled `public.ledger` rows grouped by debtor and creditor with profile name joins.
   - `public.personal_analytics`: Unions settled debtor shares and host/payer net spend grouped by `user_id` and `venue_name`.
3. **Database Functions & Security Triggers:**
   - `public.enforce_session_lock_integrity()` (`SECURITY DEFINER`, `BEFORE INSERT OR UPDATE OR DELETE` on `items`, `claims`, `tax_presets`): Rejects mutations when `sessions.status = 'locked'`.
   - `public.harvest_venue_data()` (`SECURITY DEFINER`, `AFTER UPDATE ON public.sessions`): Harvests verified restaurant tax brackets and service charge rates when a session locks.
   - `public.protect_profile_billing_columns()` (`SECURITY DEFINER`, `BEFORE UPDATE ON public.profiles`): Blocks client-side tampering with `pro_expires_at` or `ai_scans_used`.
   - `public.prune_stale_data()` (`SECURITY DEFINER`): Cleans zero/empty claims and abandoned draft sessions older than 30 days.
   - `public.search_venues(search_term)` & `public.search_venue_items(p_venue_name, p_search_term)`: Trigram similarity + `ILIKE` autocomplete RPCs.
   - `public.verify_session_pin(p_session_id, p_pin)` & `public.delete_user_account()`.
4. **14 Active B-Tree & GIN Indexes:**
   - `idx_claims_session_id`, `idx_connections_friend_id`, `idx_connections_unique_pair`, `idx_items_session_id`, `idx_ledger_creditor_unsettled`, `idx_ledger_debtor_unsettled`, `idx_ledger_session_id`, `idx_members_session_id`, `idx_members_user_id`, `idx_profiles_name_trgm` (GIN), `idx_sessions_host_id`, `idx_sessions_venue_name`, `idx_tax_presets_session_id`, `idx_venues_name_trgm` (GIN).

---

## 4. Active Issue Tracker & Resolution Ledger

| Issue ID     | Screen / Component                                                                           | Reported Symptom                                                                                                                                                                                               | Root Cause                                                                                                                   | Status & Resolution (`v0.9.92`)                                                                                                                                                                                                          |
| :----------- | :------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **BUG-01**   | `Home.tsx`, `ReceiptWorkbench.tsx`                                                           | Session names defaulted to the venue name.                                                                                                                                                                     | `getSessionTitle` fell back to `session.venue_name` before date.                                                             | **FIXED (`v0.9.7`)** — `getSessionTitle` uses `session.name                                                                                                                                                                              |     | "{Date} Session"`and displays`venue_name` as a restaurant subtitle. |
| **BUG-02**   | `ReceiptWorkbench.tsx`                                                                       | Header read `"LIVE POS SPLIT RECEIPT"` and buttons read `"Add Dish"`.                                                                                                                                          | Legacy wording.                                                                                                              | **FIXED (`v0.9.7`)** — Updated to **`★ LIVE BILL SPLIT ★`** and **`Add Item`**.                                                                                                                                                          |
| **BUG-03**   | `WorkbenchRuleDrawers.tsx`                                                                   | Users had no way of knowing which Service Charge tax topology (`inherit`, `global`, `none`) the restaurant used; `5%` duplicated `5` in the custom box.                                                        | No live rupee preview or auto-detection solver; custom input displayed preset values.                                        | **FIXED (`v0.9.8`)** — Added **Live Rupee Previews (`Total Tax` & `Bill Total`)** on each option card + **Auto-Detect from Paper Bill Total** solver + fixed custom rate input.                                                          |
| **BUG-04**   | `ReceiptWorkbench.tsx`                                                                       | Item quantity stepper buttons had an awkward inner-box shape compared to the `Unit Price` input.                                                                                                               | Inner `w-9 h-9` buttons inside a padded container.                                                                           | **FIXED (`v0.9.8`)** — Replaced with a flush segmented input group (`grid-cols-[42px_1fr_42px] divide-x divide-border`) matching the exact silhouette of `Unit Price`.                                                                   |
| **BUG-05**   | `ActiveSession.tsx`                                                                          | 2-Tab Switcher bar was opaque rather than matching the translucent top navbar.                                                                                                                                 | Used `bg-surface/95` and solid `bg-page` track.                                                                              | **FIXED (`v0.9.8`)** — Updated to `bg-surface/75 backdrop-blur-xl` with a translucent `bg-page/55` inner track.                                                                                                                          |
| **BUG-06**   | `ReceiptWorkbench.tsx`, `components.css`                                                     | Thermal receipt sawtooth edge was invisible against the dark background.                                                                                                                                       | `--receipt-bg` was scoped inside `.pos-receipt`, so the sibling `<ThermalReceiptSawtooth/>` SVG defaulted to `#000000` fill. | **FIXED (`v0.9.8`)** — Moved `--receipt-bg` & `--receipt-border` to `:root` / `[data-theme='dark']` and built a 32-tooth SVG blade edge with a `1.5px` border stroke.                                                                    |
| **BUG-07**   | `ReceiptWorkbench.tsx`                                                                       | Community Venue autocomplete popup floated over the bottom of the card and sliced across `"At the Table"` below it.                                                                                            | Used `absolute top-12` overlay.                                                                                              | **FIXED (`v0.9.8`)** — Converted both Venue and Menu Item autocomplete suggestions into clean, in-flow expandable trays inside their parent cards.                                                                                       |
| **BUG-08**   | `pdf.ts`, `DebtMatrix.tsx`                                                                   | Dismissing native share threw `"Error generating PDF"`, and direct download was missing when `canShare` was true.                                                                                              | Unhandled `AbortError` and single combined button.                                                                           | **FIXED (`v0.9.7`)** — Added separate **`Download PDF`** and **`Share PDF`** buttons and silenced `AbortError`.                                                                                                                          |
| **BUG-09**   | `BottomSheet.tsx`                                                                            | Clicking top-right avatar trapped the Account Settings sheet inside the 64px blurred navbar.                                                                                                                   | `<BottomSheet>` rendered inline inside a `backdrop-blur` parent.                                                             | **FIXED (`v0.9.7`)** — Wrapped `<BottomSheet/>` in `createPortal(..., document.body)`.                                                                                                                                                   |
| **SEC-01**   | `20261021_security_rls_lockdown.sql`, `capacitor.config.json`, `DebtMatrix.tsx`, Legal Pages | Permissive `USING (true)` RLS policies; `cleartext: true` in Capacitor config; missing Verified UPI badges; missing Razorpay Shipping/Pricing clauses and placeholder Formspree URL in `delete-account.astro`. | Initial rapid-prototyping RLS & legal templates.                                                                             | **FIXED (`v0.9.9`)** — Hardened RLS policies, added `enforce_session_lock_integrity` trigger, set `cleartext: false`, added `Verified UPI` shields, and updated all 4 legal pages.                                                       |
| **BRAND-01** | `BrandLoader.tsx`, `generate-brand-assets.mjs`, `BRAND_IDENTITY.md`                          | Placeholder geometric bar SVG needed replacement with the final Ekwly negative-space `E=` icon and `[E=]kwly` wordmark.                                                                                        | Needed custom parametric design & single-SVG wordmark lockup.                                                                | **FIXED (`v0.9.92`)** — Locked v3 Equilibrium Monolith (`T = 13.90`, `g = 4`, `s = 8.5`, `R_out = 12`, `R_in = 7`, `rTip = 6`) + unified `<BrandWordmark/>` + 1.0s Lock-In `<BrandLoader/>` + JSON-injected `generate-brand-assets.mjs`. |
| **UX-04**    | `SpotlightTour.tsx`, `HelpTip.tsx`                                                           | New users need an interactive guided tour, contextual tooltips, and rolling number animations.                                                                                                                 | Scheduled for pre-launch UX delight pass.                                                                                    | **OPEN (Next Up in Milestone 11 Part 2)** — 4-Step `<SpotlightTour/>`, contextual `(?)` popovers, and `<AnimatedNumber/>` counters.                                                                                                      |

---

## 5. Next Steps Roadmap (Milestones 11 Part 2 – 14)

- [x] **Milestones 1–10 (`v0.1.0` – `v0.9.9`):** Completed & verified.
- [x] **Milestone 11 — Part 1 (`v0.9.92` — Custom Ekwly Brand Identity, Unified SVG Wordmark & Asset Exporter):** Completed.
- [ ] **Milestone 11 — Part 2 (`v0.9.95` — Interactive `<SpotlightTour/>` & `<AnimatedNumber/>` Rolling Counters):**
  - Build the 4-step interactive onboarding `<SpotlightTour/>` for first-time users (with a `"Replay App Tour"` button in Account Settings).
  - Add `<AnimatedNumber/>` rolling rupee counters on the Member Bar and Grand Total footer.
- [ ] **Milestone 12 (`v1.0.0-rc1` — Ekwly Pro Expansion & Self-Serve Razorpay Checkout):**
  - Client-side `<canvas>` **WhatsApp Bento Receipt Card Generator** (shareable dark-mode receipt infographic with embedded Host UPI QR).
  - **Category Spend Audit (Food vs. Alcohol vs. Taxes)** in `Analytics.tsx`.
  - Self-serve `<ProUpgradeSheet/>` (`₹49` 7-Day Trip Pass, `₹99/mo`, `₹799/yr`) wired to Razorpay Checkout.
- [ ] **Milestone 13 (`v1.0.0` — Production Release Packaging & Google Play Store Launch Kit):**
  - Signed `.aab`/`.apk` release builder in `scripts/configure-native.mjs` and Play Store marketing copy.
- [ ] **Milestone 14 (`v1.1.0` — Post-1.0 Desktop Pro Split-Screen Workbench):**
  - Responsive 2-column desktop layout (`lg:grid-cols-12`) with keyboard shortcuts.
