# Ekwly — Design System, Motion Language & High-FPS Engineering Spec (`DESIGN_SYSTEM.md`)

> **Version:** 1.0.1 (Synchronized with v3 Brand Identity, Skeuomorphic Thermal Receipt, `<AnimatedNumber/>` & `<SpotlightTour/>`)  
> **Design Philosophy:** "Tactile Financial Equilibrium" — Precision dark-slate fintech aesthetics (inspired by Linear, Wise, and CRED) paired with skeuomorphic thermal receipt tactility and 240Hz-ready spring physics.  
> **Target Platforms:** Web PWA, iOS Native (Capacitor 8), Android Native (Capacitor 8) — 100% Feature & Visual Parity.

---

## 1. High-Refresh-Rate Rendering Rules (60Hz / 90Hz / 120Hz / 144Hz / 240Hz)

To guarantee zero dropped frames on ProMotion (120Hz), LTPO Android (120Hz–144Hz), and high-refresh desktop monitors (240Hz), all UI code must obey a **`< 4.1ms` per-frame budget**:

### 1.1 Strictly Composited Animations Only

- **ALLOWED (GPU Compositor Thread):** `transform` (`translate3d`, `translateX`, `translateY`, `scale`, `scaleX`, `rotate`) and `opacity`.
- **FORBIDDEN (CPU Main-Thread Layout Thrashing):** Never animate `height`, `width`, `top`, `left`, `margin`, or `padding` on list rows or cards.
- **List Additions/Removals:** Use Framer Motion `layout="position"` with `opacity` and `y` transforms (`initial={{ opacity: 0, y: 8 }}`, `animate={{ opacity: 1, y: 0 }}`, `exit={{ opacity: 0, scale: 0.96 }}`).

### 1.2 Backdrop Blur (`backdrop-filter`) & `.gpu-layer` Budget

- **ALLOWED:** Fixed, non-scrolling viewport chrome (maximum 3 active blur layers at any time):
  1. Sticky Top Header (`bg-surface/85 backdrop-blur-xl`) & Sticky 2-Tab Switcher (`bg-surface/75 backdrop-blur-xl`)
  2. Floating Bottom Dock / Action Bar (`bg-surface/90 backdrop-blur-xl`)
  3. Active Portal Modal / BottomSheet / SpotlightTour Overlay (`bg-black/50 backdrop-blur-sm`)
- **FORBIDDEN:** Never place `backdrop-blur-*` or `.gpu-layer` (`will-change: transform, opacity`) on repeating cards inside a scrolling list (`.map()`), as allocating dedicated GPU texture tiles per card throttles touch-scroll frame pacing on mobile Chrome/WebView.

### 1.3 Zero-Re-Render Rolling Currency Counters (`<AnimatedNumber/>`)

- All high-frequency currency totals (Hero Ledger balances, "At the Table" member chips, and Live Receipt Grand Totals) use `src/components/ui/AnimatedNumber.tsx`.
- `<AnimatedNumber/>` interpolates numeric changes over `360ms` (cubic ease-out) using `requestAnimationFrame` and writes directly to `spanRef.current.textContent` with `tabular-nums`, achieving 240fps number rolling with **zero React component re-renders**.

---

## 2. Color System & Surface Hierarchy (`src/styles/theme.css` & `components.css`)

| Semantic Token     | Light Mode (Crisp Daylight) | Dark Mode (OLED Deep Slate) | Usage                                                 |
| :----------------- | :-------------------------- | :-------------------------- | :---------------------------------------------------- |
| `--bg-page`        | `#f2f8ff`                   | `#050914`                   | Root viewport canvas                                  |
| `--bg-surface`     | `#ffffff`                   | `#0f1724`                   | Primary Bento cards, sheets & inputs                  |
| `--bg-subtle`      | `#d8ebff`                   | `#001e3b`                   | Secondary pills, hover states & badges                |
| `--text-main`      | `#001e3b`                   | `#ffffff`                   | Primary headings, item names & rupee amounts          |
| `--text-muted`     | `#475569`                   | `#94a3b8`                   | Subheaders, timestamps, metadata & labels             |
| `--border`         | `#d8ebff`                   | `#1c2738`                   | Card hairlines & dividers                             |
| `--border-hover`   | `#89c4ff`                   | `#0080ff`                   | Interactive card hover/focus borders                  |
| `--brand-kwly`     | `#0284c7`                   | `#93c5fd`                   | Dynamic stroke color for `kwly` in `<BrandWordmark/>` |
| `--receipt-bg`     | `#fffdf8`                   | `#152238`                   | Skeuomorphic `.pos-receipt` thermal paper surface     |
| `--receipt-border` | `#cbd5e1`                   | `#2c4263`                   | Thermal receipt border & sawtooth blade stroke        |
| `--color-primary`  | `#0080ff`                   | `#0080ff`                   | Primary CTAs, active selections, host accents         |
| `--color-success`  | `#10b981`                   | `#10b981`                   | Settled badges, incoming money, active discounts      |
| `--color-warning`  | `#f59e0b`                   | `#f59e0b`                   | Partial claims, offline mode pill, pending states     |
| `--color-danger`   | `#df1b41`                   | `#df1b41`                   | Outgoing debts, over-claimed warnings, delete actions |

---

## 3. Typography & Financial Scannability

- **Font Family:** `Inter` (`400`, `500`, `600`, `700`, `800`, `900`) + system monospace for receipt accounting lines, UPI VPAs, and room PINs.
- **Tabular Numerals Invariant:** Every rupee amount (`₹3,419.00`), quantity badge (`x2`), fraction (`1/3`), percentage (`5%`), and room PIN (`4829`) **must** apply `tabular-nums` (`font-variant-numeric: tabular-nums`).
- **CSS Cascade Layer Discipline (`src/styles/base.css`):** Base element rules for `input` and `select` are wrapped inside `@layer base { ... }` so Tailwind v4 utility classes (`pl-10`, `h-7`, `w-auto`, `px-2`) always win without `!important` modifiers.

---

## 4. Spatial Geometry, Bento Cards & Skeuomorphic Live Receipt

### 4.1 Inset Bento Cards (No Full-Bleed Strips)

- Never use edge-to-edge `border-y` strips that touch the left/right screen bezels.
- All content groups sit inside inset containers (`mx-4` or parent `px-4` with `rounded-2xl bg-surface border border-border shadow-sm`).

### 4.2 Skeuomorphic Thermal POS Receipt (`★ LIVE BILL SPLIT ★`)

- In `ReceiptWorkbench.tsx`, the item list and live accounting breakdown are unified into a single tactile thermal receipt (`.pos-receipt`):
  - **Top & Bottom 32-Tooth SVG Sawtooth Edges (`<ThermalReceiptSawtooth/>`):** Mimics a paper bill torn against a serrated metal POS printer blade.
  - **Perforated Ticket Notches (`.pos-notch-left`, `.pos-notch-right`, `.pos-dashed-line`):** Separates the itemized dishes from the monospace tax/discount/SC summary footer.
  - **Inline Expandable Autocomplete Trays:** Venue and menu price suggestions expand in-flow inside their parent card rather than floating as absolute overlays.

### 4.3 Root Portal Modals (`<BottomSheet/>`, `<ConfirmSheet/>`, `<SpotlightTour/>`)

- All modal sheets and tours render via `createPortal(..., document.body)` so `position: fixed` is never trapped inside a parent header or container with `backdrop-filter` or `transform`.

---

## 5. Brand Identity & Motion Suite (`src/components/ui/BrandLoader.tsx`)

1. **Equilibrium Monolith Icon (`<BrandLogo/>` on `100 × 100` Grid):**
   - All 3 horizontal arms of the `E` and both bars of the negative-space `=` share identical thickness $T = 13.90$ units ($H = 85.50$, $W = 76.50$, $g = 4.00$, $s = 8.50$, $R_{\text{out}} = 12.00$, $R_{\text{in}} = 7.00$, $r_{\text{tip}} = 6.00$).
   - Boxed in-app badges (`boxed={true}`) apply `transform="translate(12, 12) scale(0.76)"`; maskable mobile app icons apply `transform="translate(19, 19) scale(0.62)"` on a full-bleed `rx="0"` canvas.
2. **Unified Single-SVG Wordmark (`<BrandWordmark/>` on `354 × 114` Grid):**
   - Renders the unboxed `E=` monolith + custom rounded-capsule vector strokes for `kwly` inside a single `<svg viewBox="0 0 354 114">` so Hero (`52px`), Navbar (`28px`), and Legal (`30px`) headers scale identically without clipping the `y` descender.
3. **3-Mode Animated Loader (`<BrandLoader/>`):**
   - Supports `state="lockin"` (`1.0s` Magnetic Lock-In), `state="equalizer"` (`1.0s` Counter-Phase Equalizer), `state="scan"` (`1.2s` AI Laser Scan), and `state="success"`.
