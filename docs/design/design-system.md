# Ekwly — Design System, Surface Hierarchy & Accessibility Spec

> **Design Philosophy:** "Tactile Financial Equilibrium" — Precision OLED dark-slate fintech aesthetics paired with skeuomorphic thermal receipt tactility.
> **Target Platforms:** Web PWA, Android Native (Capacitor 8), iOS Native (Capacitor 8).

---

## 1. Color & Semantic Tokens (`src/styles/theme.css` & `components.css`)

| Semantic Token                      | Light Mode            | Dark Mode             | Usage                                        |
| :---------------------------------- | :-------------------- | :-------------------- | :------------------------------------------- |
| `--bg-page`                         | `#f2f8ff`             | `#050914`             | Root canvas & OS status/gesture bar sync     |
| `--bg-surface`                      | `#ffffff`             | `#0f1724`             | Primary cards, bottom sheets, inputs         |
| `--bg-subtle`                       | `#d8ebff`             | `#001e3b`             | Secondary pills, hover surfaces              |
| `--text-main`                       | `#001e3b`             | `#ffffff`             | Headings, dish names, currency figures       |
| `--text-muted`                      | `#475569`             | `#94a3b8`             | Labels, metadata, timestamps                 |
| `--border` / `--border-hover`       | `#d8ebff` / `#89c4ff` | `#1c2738` / `#0080ff` | Hairlines & focus/hover accents              |
| `--receipt-bg` / `--receipt-border` | `#fffdf8` / `#cbd5e1` | `#152238` / `#2c4263` | `.pos-receipt` thermal paper surface         |
| `--color-primary`                   | `#0080ff`             | `#0080ff`             | Primary CTAs, active selections              |
| `--color-success`                   | `#10b981`             | `#10b981`             | Settled status, incoming funds, discounts    |
| `--color-warning`                   | `#f59e0b`             | `#f59e0b`             | Partial claims, offline pill, drafts         |
| `--color-danger`                    | `#df1b41`             | `#df1b41`             | Outgoing debts, over-claimed alerts, deletes |

---

## 2. 3-Tier Glassmorphic System (`src/styles/components.css`)

1. **Tier 1 — `.glass-chrome`:** True `backdrop-filter: blur(20px) saturate(180%)` reserved for the sticky top header (`AppRouter.tsx`).
2. **Tier 2 — `.glass-dock`:** Elevated floating capsule (`backdrop-filter: blur(22px) saturate(190%)`) for `<BottomDock/>` and the floating session CTA bar.
3. **Tier 3 — `.glass-card`:** Optical frosted linear gradient + `1px` specular inset highlight with `0ms` blur cost for scrolling Bento cards.

---

## 3. High-Refresh-Rate (60Hz–240Hz) Rules

- **GPU-Composited Only:** Animate only `transform` and `opacity` (plus Framer Motion `layout="position"`).
- **Zero-Re-Render Rolling Counters:** `<AnimatedNumber/>` interpolates via `requestAnimationFrame` writing directly to `spanRef.current.textContent` with `tabular-nums`.
- **Tabular Numerals:** All currency amounts, quantities, fractions, percentages, and PINs must use `tabular-nums`.
- **No Native Browser Dialogs:** Always use `<ConfirmSheet/>`, `<BottomSheet/>`, and `showToast` instead of `window.alert`/`confirm`/`prompt`.
- **Proper Icons Over Emojis:** Prefer `lucide-react` icons over inline emojis in app UI.

---

## 4. Thermal Receipt & Shareable Ticket Specifications

- **In-App Live Receipt (`ReceiptWorkbench.tsx`):** `<ThermalReceiptSawtooth/>` (32 teeth with `-1px` overlap into `.pos-receipt`), compact `select.receipt-select` (`height: 26px`), 1-tap `[All]` + member avatar pills, and expandable fractional stepper.
- **Shareable Receipt & 1-on-1 Nudge PNGs (`src/lib/bentoReceipt.ts`):** Theme-independent dark slate ticket (`#152238 -> #111C2E` over `#070D19`, 28 sawtooth teeth, perforated side notches) embedding scannable UPI QRs for every unsettled creditor (full card) or exact debtor amount (personal nudge).
- **PDF Statements (`src/lib/pdf.ts`):** Vector-rendered `[E=]kwly` header, Master Bill Breakdown, right-aligned Accounting Summary, Payments to Restaurant, Settlement Transactions with embedded UPI QR cards, and page-break-safe Individual Settlements.

---

## 5. Known Design & Accessibility Gaps (Scheduled for Stage 5)

- **Font Loading (`AUD-33`):** `base.css` declares `'Inter', sans-serif`, but Inter is not yet bundled (`@fontsource-variable/inter` or `system-ui` fallback needed).
- **Viewport Zoom (`AUD-31`):** `index.astro` currently sets `maximum-scale=1, user-scalable=0` (must be removed for WCAG 1.4.4).
- **Layout-Thrashing Shine (`AUD-31`):** `.premium-gradient-card::before` currently animates `left` infinitely instead of `transform: translateX(...)` with `prefers-reduced-motion` suppression.
- **Dialog & Control Accessibility (`AUD-14`, `AUD-31`):** `BottomSheet`, `SpotlightTour`, and `QrScannerModal` need `role="dialog"`, `aria-modal`, `Escape` dismissal, and focus trapping; `showToast` needs `aria-live="polite"`; clickable `<div>` cards with nested `<button>`s in `Home.tsx`, `Friends.tsx`, and `ReceiptWorkbench.tsx` need semantic cleanup; `SpotlightTour.tsx` has an inline `💡` emoji to replace with Lucide `Lightbulb`.
- **Responsive Form Stacking:** `ReceiptWorkbench.tsx` currently uses `col-span-6` for Quantity/Price on mobile (consider `col-span-12 sm:col-span-5` for accessibility text scaling).
