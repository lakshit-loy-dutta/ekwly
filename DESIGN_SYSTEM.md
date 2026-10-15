# Ekwly — Design System, Motion Language & High-FPS Engineering Spec

> **Version:** 1.0.0
> **Design Philosophy:** "Tactile Financial Equilibrium" — Precision dark-slate fintech aesthetics (inspired by Linear, Wise, and Cred) paired with multiplayer social warmth and 240Hz-ready spring physics.
> **Target Platforms:** Web PWA, iOS Native (Capacitor), Android Native (Capacitor) — 100% Feature & Visual Parity.

---

## 1. High-Refresh-Rate Rendering Rules (60Hz / 90Hz / 120Hz / 144Hz / 240Hz)

To guarantee zero dropped frames on ProMotion (120Hz), LTPO Android (120Hz–144Hz), and high-refresh desktop monitors (240Hz), all UI code must obey a **< 4.1ms per-frame budget**:

### 1.1 Strictly Composited Animations Only

- **ALLOWED (GPU Compositor Thread):** `transform` (`translate3d`, `translateX`, `translateY`, `scale`, `rotate`) and `opacity`.
- **FORBIDDEN (CPU Main-Thread Layout Thrashing):** Never animate `height`, `width`, `top`, `left`, `margin`, or `padding` on list rows or cards.
- **List Additions/Removals:** Use Framer Motion `layout="position"` with `opacity` and `y` transforms (`initial={{ opacity: 0, y: 12 }}`, `animate={{ opacity: 1, y: 0 }}`, `exit={{ opacity: 0, scale: 0.96 }}`) instead of `height: 0 -> 'auto'`.

### 1.2 Backdrop Blur (`backdrop-filter`) Budget

- **ALLOWED:** Fixed, non-scrolling viewport chrome (maximum 3 active blur layers at any time):
  1. Sticky Top Header (`bg-surface/80 backdrop-blur-xl`)
  2. Floating Bottom Dock / Action Bar (`bg-surface/85 backdrop-blur-xl`)
  3. Active Modal / BottomSheet Overlay (`bg-black/50 backdrop-blur-sm`)
- **FORBIDDEN:** Never place `backdrop-blur-*` on repeating cards inside a scrolling list (`.map()`), as Nblur passes per frame saturate mobile GPU memory bandwidth at 120Hz+. Use solid or subtle gradient surfaces (`bg-surface`) with crisp `1px` borders instead.

### 1.3 CSS Transition Discipline

- Never apply global `transition: ... !important` rules to utility classes in `base.css`.
- Use explicit, narrow Tailwind transition classes (`transition-transform`, `transition-colors duration-150`) only on interactive controls.

---

## 2. Color System & Surface Hierarchy (`src/styles/theme.css`)

Ekwly uses a high-contrast, dual-theme palette where neutral slate typography ensures that **Azure (`#0080ff`)**, **Emerald (`#10b981`)**, **Amber (`#f59e0b`)**, and **Rose (`#df1b41`)** carry immediate financial meaning.

| Semantic Token    | Light Mode (Crisp Daylight) | Dark Mode (OLED Deep Slate) | Usage                                                      |
| :---------------- | :-------------------------- | :-------------------------- | :--------------------------------------------------------- |
| `--bg-page`       | `#f4f7fb`                   | `#050914`                   | Root viewport canvas                                       |
| `--bg-surface`    | `#ffffff`                   | `#0f1724`                   | Primary Bento cards, sheets & inputs                       |
| `--bg-subtle`     | `#e6f0fa`                   | `#162235`                   | Secondary pills, hover states & badges                     |
| `--text-main`     | `#001e3b`                   | `#f8fafc`                   | Primary headings, item names & rupee amounts               |
| `--text-muted`    | `#475569`                   | `#94a3b8`                   | Subheaders, timestamps, metadata & labels                  |
| `--border`        | `#dbe7f4`                   | `#1c2738`                   | Card hairlines & dividers                                  |
| `--border-hover`  | `#89c4ff`                   | `#2e4361`                   | Interactive card hover/focus borders                       |
| `--color-primary` | `#0080ff`                   | `#0080ff`                   | Primary CTAs, active selections, host accents              |
| `--color-success` | `#10b981`                   | `#10b981`                   | Settled badges, incoming money, balanced totals            |
| `--color-warning` | `#f59e0b`                   | `#f59e0b`                   | Partial claims, guest mode banners, pending states         |
| `--color-danger`  | `#df1b41`                   | `#df1b41`                   | Outgoing debts, over-claimed warnings, destructive actions |

---

## 3. Typography & Financial Scannability

- **Font Family:** `Inter` (`400`, `500`, `600`, `700`, `800`).
- **Tabular Numerals Invariant:** Every rupee amount (`₹3,419.00`), quantity badge (`x2`), fraction (`1/3`), percentage (`5%`), and room PIN (`4829`) **must** apply `tabular-nums` (`font-variant-numeric: tabular-nums`). Digits must never shift horizontally when values update in real time.
- **Type Scale:**
  - **Hero Display (Grand Total / Net Balance):** `text-3xl` to `text-4xl` (`font-extrabold tracking-tight tabular-nums`)
  - **Screen Title:** `text-xl` to `text-2xl` (`font-extrabold tracking-tight`)
  - **Card Title / Dish Name:** `text-[0.95rem]` (`font-semibold text-main`)
  - **Micro Label / Section Overline:** `text-[0.7rem]` (`font-bold uppercase tracking-widest text-muted`)

---

## 4. Spatial Geometry & Bento Card Language

### 4.1 Inset Bento Cards (No Full-Bleed Strips)

- Never use edge-to-edge `border-y` strips that touch the left/right screen bezels.
- All content groups must sit inside inset containers (`mx-4 rounded-2xl bg-surface border border-border shadow-sm`).
- Internal list rows within a Bento card use `divide-y divide-border/60` with `p-4` touch padding.

### 4.2 Touch Targets & Thumb-Zone Ergonomics

- **Minimum Touch Target:** `44px × 44px` (`h-11` minimum for primary inputs and action buttons).
- **Scoped Input Utility (`.input-field`):** Raw `<input>` and `<select>` tags in `base.css` must remain un-opinionated in width/height so custom inline controls (like stepper inputs) require zero `!important` overrides. Standard form inputs use the `.input-field` class.
- **Safe Area Insets:** All fixed bottom docks, steppers, and bottom sheets must include `pb-safe` (`env(safe-area-inset-bottom)`) to clear the iOS Home Indicator and Android gesture bar.

---

## 5. Motion & Micro-Interaction Specification

All animations use **Framer Motion Spring Physics** so velocity scales naturally across 60Hz, 120Hz, 144Hz, and 240Hz displays:

### 5.1 Canonical Spring Presets

- **Snappy UI Spring (Buttons, Pills, Toggles, Avatar Badges):**
  `{ type: 'spring', stiffness: 500, damping: 32, mass: 0.8 }`
- **Fluid Sheet / Page Transition Spring (BottomSheets, Stepper Slides, Drawers):**
  `{ type: 'spring', stiffness: 340, damping: 30, mass: 1 }`
- **Bouncy Feedback Spring (Claim Completion Checkmarks, Quota Badges):**
  `{ type: 'spring', stiffness: 600, damping: 22 }`

### 5.2 Required Micro-Interactions

1. **Tactile Press (`whileTap`):** Interactive cards and primary buttons compress to `scale: 0.97` on pointer down and spring back on release, accompanied by a subtle haptic tap (`triggerHaptic('light')`).
2. **Shared Layout Indicators (`layoutId`):** Active navigation dock tabs, segmented mode toggles (`Host` vs `Join`, `Pre-Tax` vs `Post-Tax`), and member filter pills use Framer Motion `layoutId` so the active highlight glides smoothly between options.
3. **Staggered List Cascades:** Lists of sessions, dishes, or friends stagger their entrance by `0.035s` per item (`staggerChildren: 0.035`), capped at 10 items so long lists never feel sluggish.

---

## 6. Brand Identity, Logo & `<BrandLoader/>` Specification

### 6.1 Visual Concept ("The Equilibrium Mark")

The Ekwly mark represents **fairness, division, and financial balance**:

- Constructed as a multi-path inline SVG (`viewBox="0 0 64 64"`) with three precision geometric bars forming both an abstract **"E"** and an **Equal/Split symbol** (`=`).
- Because the mark is a native multi-path SVG:
  - **Static Mode (`<BrandLogo size="{32}"/>`):** Renders with zero rasterization blur at any DPI.
  - **Animated Loader Mode (`<BrandLoader label="Syncing Room..."/>`):** The three geometric bars oscillate horizontally with phase-shifted spring physics and a gradient shimmer, visually depicting "splitting and balancing" while data loads.
- **Replacement Contract:** All loading states across the entire app must use `<BrandLoader/>` (never raw `<Loader2/>` spinners for page loads). When updating brand artwork, editing `src/components/ui/BrandLoader.tsx` updates every loader and logo instance app-wide.

---

## 7. Cross-Platform Parity Contract (PWA = iOS = Android)

1. **Zero Native Browser Popups:** `window.alert`, `window.confirm`, and `window.prompt` are strictly forbidden. Destructive or critical actions must use `<ConfirmSheet/>` (`src/components/ui/ConfirmSheet.tsx`).
2. **Browser & Hardware Back Parity:** Navigating between views or wizard steps must push/pop state cleanly so both the Android hardware back gesture (`@capacitor/app`), iOS edge swipe, and Web Browser Back button behave identically.
3. **Universal Haptic Utility (`utils.haptic`):** Calls Capacitor Haptics on native builds or `navigator.vibrate` on web with a silent no-op fallback on unsupported desktop browsers.
4. **Universal UPI Settlement:** Always provide both the `upi://pay` deep-link button (for mobile devices with UPI apps installed) **and** a 1-tap **"Show UPI QR"** modal (so users on iOS Safari, desktop PWA, or across the restaurant table can scan to pay with GPay/PhonePe).
