# Ekwly — Complete Project Handoff & State Ledger (`PROJECT-STATE.md`)

> **Last Updated:** October 20, 2026  
> **Current Version:** `v0.8.0` (Milestones 1–7 Code Complete & DB Migrations #1 & #2 Live — Pending Local Build Verification)  
> **Repository Visibility:** Private Proprietary Repository  
> **Core Constraint:** ₹0 Hosting & Operational Cost Architecture + 60Hz–240Hz Frame-Rate Budget (`<4.1ms/frame`)

---

## 1. Original Architecture & Confirmed Technology Stack

- **Product Domain:** Real-time collaborative and Solo-Host ("Designated Treasurer") restaurant bill-splitting, Indian POS multi-bracket tax routing (Food GST 5%, Alcohol VAT 0%–25%, Tobacco GST 28%–40%), social dining network, and instant UPI settlement engine.
- **Frontend Framework:** Astro 7 (`^7.3.8`, strictly static output) + React 19 (`^19.3.0`) + TypeScript (`^7.0.2`).
- **Styling & Motion:** Tailwind CSS v4 (`^4.3.3` via `@tailwindcss/vite`) + Framer Motion (`^13.5.1`, analytical spring physics) + Lucide React (`^1.56.0`).
- **Backend & Database:** Supabase (`@supabase/supabase-js` `^2.117.3`) — PostgreSQL, Row Level Security (RLS), Lazy Realtime WebSockets (`postgres_changes`), Auth (Google OAuth, Magic Link OTP, Anonymous Guest), and Deno Edge Functions.
- **AI Vision OCR:** `gemini-3.5-flash-lite` invoked via `supabase/functions/scan-receipt/index.ts` using strict JSON schema enforcement with a top-level `reasoning` Chain-of-Thought (CoT) math verification field.
- **Native Mobile Wrapper:** Capacitor 8 (`@capacitor/core`, `@capacitor/android`, `@capacitor/ios` `^8.5.3`, `@capacitor/app` `^8.1.2`, `@capacitor/camera` `^8.2.5`, `@capacitor-mlkit/barcode-scanning` `^8.2.1`).
- **Web Fallbacks & Utilities:** `@vite-pwa/astro` (`^1.2.0` Workbox Service Worker), `html5-qrcode` (`^2.3.8`), `react-qr-code` (`^2.2.0`), `jspdf` (`^4.2.1`) + `jspdf-autotable` (`^5.0.8`).
- **Runtime, Testing & Tooling:** Node.js 24 (`.nvmrc`), `pnpm` v12+ (strictly enforced; never use `npm`/`yarn`), Vitest (`^5.0.4`), Repomix (`repomix.config.ts`).

---

## 2. Verification Ledger: Completed Milestones (Milestones 1–7)

### A. Database & Workspace Infrastructure (Verified Live in `schema_dump_2.sql` & `.vscode/*`)

1. **Database Triggers & Functions:** `harvest_venue_data()`, `protect_profile_billing_columns()`, `prune_stale_data()`, `search_venues()`, `search_venue_items()`, `verify_session_pin()`, and `delete_user_account()`.
2. **Views:** `global_ledger` and `personal_analytics`.
3. **14 B-Tree & GIN Indexes:** All foreign key B-Tree indexes, partial unsettled ledger indexes (`idx_ledger_creditor_unsettled`, `idx_ledger_debtor_unsettled`), unique friendship pair index (`idx_connections_unique_pair`), and `pg_trgm` GIN indexes (`idx_venues_name_trgm`, `idx_profiles_name_trgm`) are active.
4. **VS Code & Native Tooling:** `.vscode/settings.json` and `scripts/configure-native.mjs` pin Gradle `8.14.3`, AGP `8.13.0`, Android SDK `36`, and JDK 21 while excluding `node_modules` from `redhat.java`.

### B. Application Milestones (Milestones 1–7 Code Complete)

- **Milestones 1–4:** Universal Tax Engine (`mathEngine.ts`), Gemini CoT OCR (`scan-receipt`), `<BottomDock/>`, `<BrandLoader/>`, `<ConfirmSheet/>`, `<QrScannerModal/>`, `Analytics.tsx`, and `splitwiseCsv.ts`.
- **Milestone 5 (2-Tab Live Receipt Workbench):** `ReceiptWorkbench.tsx` with 1-tap Friend & Saved Squad population, item-centric Dish Cards with inline `[All] [Member]` avatar pills, expandable fractional adjusters, inline tax/`+S.C.` selectors, and interactive receipt footer drawers.
- **Milestone 6 (Instant Settlement, Host UPI QR & Bilateral Netting):**
  - Zero-Friction Room Entry (`AppRouter.tsx`) & Smart Cashier Default (`ActiveSession.tsx`).
  - Host-Side Dynamic UPI QR Modal (`DebtMatrix.tsx`) with inline UPI VPA entry and 1-tap `"Payment Received — Mark Paid"`.
  - Bilateral Balance Netting (`Ledger.tsx`, `Home.tsx`, `utils.ts`) consolidating opposing balances per counterparty.
- **Milestone 7 (Social Dining Network & Lazy WebSockets):**
  - `Friends.tsx` 2.0 with live profile search, _"People You've Dined With"_ suggestions, Saved Squad creation/management, and interactive Friendship Dining Dossiers (shared outings count, go-to venue, net balance).
  - Lazy Realtime WebSockets (`useSessionSync.ts`) remaining dormant during solo-host entry until `"Invite QR"` is opened or >1 linked user joins the room.

---

## 3. Next Steps & Verification Checklist

1. Save all Milestone 6 & 7 source files locally.
2. Run `pnpm test` to verify all unit suites (`mathEngine.test.ts`, `splitwiseCsv.test.ts`, `utils.test.ts`).
3. Run `pnpm build` to verify TypeScript and Astro static compilation.
4. Optional: Remove unreferenced legacy step components (`src/components/session/SessionRules.tsx`, `ReceiptEditor.tsx`, `MembersList.tsx`, `ClaimManager.tsx`, `QuickSplit.tsx`) once you have verified the 2-Tab Workbench in `pnpm dev`.
