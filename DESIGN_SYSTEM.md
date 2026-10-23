# Ekwly — Design System, Motion Language & High-FPS Engineering Spec (`DESIGN_SYSTEM.md`)

> **Version:** 1.0.3 (Complete Specification: 3-Tier Glassmorphism `.glass-chrome` / `.glass-dock` / `.glass-card`, Dynamic OS Status/Gesture Bar Theme Sync, Seamless 32-Tooth Sawtooth Thermal Receipt & Skeuomorphic Shareable Receipt Tickets)  
> **Design Philosophy:** "Tactile Financial Equilibrium" — Precision dark-slate fintech aesthetics (inspired by Linear, Wise, and CRED) paired with skeuomorphic thermal receipt tactility and 240Hz-ready spring physics.  
> **Target Platforms:** Web PWA, iOS Native (Capacitor 8), Android Native (Capacitor 8) — 100% Feature & Visual Parity.

---

## 1. High-Refresh-Rate Rendering Rules (60Hz / 90Hz / 120Hz / 144Hz / 240Hz)

To guarantee zero dropped frames on ProMotion (120Hz), LTPO Android (120Hz–144Hz), and high-refresh desktop monitors (240Hz), all UI code must obey a **`< 4.1ms` per-frame budget**:

### 1.1 Strictly Composited Animations Only

- **ALLOWED (GPU Compositor Thread):** `transform` (`translate3d`, `translateX`, `translateY`, `scale`, `scaleX`, `rotate`) and `opacity`.
- **FORBIDDEN (CPU Main-Thread Layout Thrashing):** Never animate `height`, `width`, `top`, `left`, `margin`, or `padding` on list rows or cards.
- **List Additions/Removals:** Use Framer Motion `layout="position"` with `opacity` and `y` transforms (`initial={{ opacity: 0, y: 8 }}`, `animate={{ opacity: 1, y: 0 }}`, `exit={{ opacity: 0, scale: 0.96 }}`).

### 1.2 3-Tier Glassmorphic System (`src/styles/components.css`)

To deliver rich frosted-glass depth across the entire app without exceeding mobile GPU blur bandwidth:

1. **Tier 1 — `.glass-chrome` (Sticky Top Header & Sticky 2-Tab Switcher):**
   - Uses true `backdrop-filter: blur(20px) saturate(180%)` with translucent surface fills and a top specular highlight.
2. **Tier 2 — `.glass-dock` (Floating `<BottomDock/>` & Floating Session Grand Total Bar):**
   - Uses elevated capsule glass (`backdrop-filter: blur(22px) saturate(190%)`), a crisp `1px` specular border, and a deep floating shadow (`0 18px 42px -6px rgba(0,0,0,0.72)`).
3. **Tier 3 — `.glass-card` (All Scrolling Bento Content Cards):**
   - Uses a 145-degree translucent linear gradient and a top specular inner highlight (`inset 0 1px 0 0 rgba(255,255,255,0.07)`) with **`0ms` GPU blur overhead** so scrolling lists of sessions, friends, or ledger rows never drop frames at 120Hz–240Hz.

### 1.3 Zero-Re-Render Rolling Currency Counters (`<AnimatedNumber/>`)

- All high-frequency currency totals (Hero Ledger balances, "At the Table" member chips, Floating Session Grand Total, and Live Receipt Grand Total) use `src/components/ui/AnimatedNumber.tsx`.
- `<AnimatedNumber/>` interpolates numeric changes over `360ms` (cubic ease-out) using `requestAnimationFrame` and writes directly to `spanRef.current.textContent` with `tabular-nums`, achieving 240fps number rolling with **zero React component re-renders**.

---

## 2. Dynamic OS Status Bar & Gesture Home Bar Sync (`src/pages/index.astro`)

- `applyThemeMeta(theme)` in `src/pages/index.astro` synchronizes:
  1. `document.documentElement.setAttribute('data-theme', theme)`
  2. `document.documentElement.style.colorScheme = theme` (`'light'` or `'dark'`)
  3. `document.documentElement.style.backgroundColor` (`#f2f8ff` in Light Mode, `#050914` in Dark Mode)
  4. `<meta id="theme-color-meta" name="theme-color" content="...">`
- This ensures Android Chrome WebAPKs and iOS Safari paint both the top notification bar and the bottom gesture home bar to match the active Ekwly theme instantaneously.

---

## 3. Color System & Surface Hierarchy (`src/styles/theme.css` & `components.css`)

| Semantic Token     | Light Mode (Crisp Daylight) | Dark Mode (OLED Deep Slate) | Usage                                                 |
| :----------------- | :-------------------------- | :-------------------------- | :---------------------------------------------------- |
| `--bg-page`        | `#f2f8ff`                   | `#050914`                   | Root viewport canvas & OS status/gesture bar          |
| `--bg-surface`     | `#ffffff`                   | `#0f1724`                   | Primary cards, sheets & inputs                        |
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

## 4. Typography, Form Scoping & Font-Scale Resilience

- **Font Family:** `Inter` (`400`, `500`, `600`, `700`, `800`, `900`) + system monospace for receipt accounting lines, UPI VPAs, and room PINs.
- **Tabular Numerals Invariant:** Every rupee amount (`₹3,419.00`), quantity badge (`x2`), fraction (`1/3`), percentage (`5%`), and room PIN (`4829`) **must** apply `tabular-nums` (`font-variant-numeric: tabular-nums`).
- **CSS Cascade Layer & Inline Receipt Select (`src/styles/base.css`):**
  - Global form rules are wrapped inside `@layer base { ... }`.
  - Inline tax dropdowns on the live thermal receipt use `select.receipt-select` (`height: 26px; width: auto; padding: 0 8px; border-radius: 8px; font-size: 0.72rem;`) so they remain compact pills instead of expanding into `44px` blocks.
- **Accessibility & Display-Scaling Resilience:**
  - Interactive pills and buttons use `min-h-9` / `min-h-11` / `min-h-12` with vertical padding (`py-1.5` to `py-2.5`) and `flex-wrap` so users with large OS font scaling (`135%+`) or compact display scaling never experience text clipping.
  - In `ReceiptWorkbench.tsx`, the Quantity Stepper (`col-span-12 sm:col-span-5`) and Unit Price input (`col-span-12 sm:col-span-7`) stack full-width on narrow mobile viewports.

---

## 5. Skeuomorphic Thermal Receipt & Shareable Ticket Specification

### 5.1 In-App Live Bill Split Receipt (`ReceiptWorkbench.tsx`)

- **Seamless 32-Tooth Sawtooth Edges (`<ThermalReceiptSawtooth/>`):** Overlaps `.pos-receipt` by `-1px` (`-mb-px` on top, `-mt-px` on bottom) with matching `fill="var(--receipt-bg)"` and no conflicting top inset shadow so the serrated teeth and receipt body fuse into one continuous sheet of paper in both Light and Dark modes.
- **Tidy 3-Row Dish Hierarchy:**
  - **Row 1:** `01. Dish Name` (left) + `₹LineTotal` & `Edit`/`Delete` icons (right).
  - **Row 2 (Single-Line Metadata Strip):** `xQty • ₹Unit/ea • select.receipt-select [Tax %] • [+S.C.] • [✓ Split]`.
  - **Row 3 (Member Split Bar):** `[All]` + `[Member Fraction]` pills + `[Sliders]` custom fraction toggle.

### 5.2 Shareable Skeuomorphic Receipt Images & 1-on-1 Nudge Cards (`src/lib/bentoReceipt.ts`)

- Rendered on a theme-independent Midnight-Paper slate ticket (`#152238` $\rightarrow$ `#111C2E` over `#070D19` with 28 serrated teeth and perforated side notches) so shared images look crisp inside both Light and Dark WhatsApp chat threads.
- **Full Receipt Image (`exportBentoReceiptImage`):** Displays Grand Total, Individual Shares, `SETTLEMENT SUMMARY (WHO PAYS WHOM)`, and embeds a Scan-to-Pay UPI QR block for **every unsettled creditor**.
- **Personal Nudge Card (`exportPersonalNudgeImage`):** Displays a single friend's itemized dishes, exact amount owed, and a pre-filled UPI QR code for 1-on-1 WhatsApp nudges in both `DebtMatrix.tsx` and `Ledger.tsx`.
