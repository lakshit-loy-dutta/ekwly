# Ekwly — Brand Identity, Logo Geometry & Visual Guidelines (`BRAND_IDENTITY.md`)

> **Version:** 1.0.1 (Unclipped `354 × 114` Wordmark & 3-Mode Animation Suite)  
> **Brand Concept:** "The Equilibrium Monolith" — Equality in every bar, fairness in every split.

---

## 1. Logo Construction & Mathematical Grid (`100 × 100` Coordinate System)

The Ekwly mark is engineered on a strict mathematical equality grid where **all three horizontal arms of the `E` and both horizontal bars of the negative-space `=` share the exact same vertical thickness ($T = 13.90\text{ units}$)**.

| Parameter                                  | Locked Value              | Purpose & Visual Role                                                                |
| :----------------------------------------- | :------------------------ | :----------------------------------------------------------------------------------- |
| **Equal Bar Height ($T$)**                 | `13.90` units             | Identical thickness across all 3 `E` arms and both `=` bars.                         |
| **Total Mark Height ($H$)**                | `85.50` units             | $5T + 4g = 69.50 + 16.00 = 85.50$ (centered vertically: $y \in [7.25, 92.75]$).      |
| **Total Mark Width ($W$)**                 | `76.50` units             | Centered horizontally ($x \in [11.75, 88.25]$).                                      |
| **Spine Width**                            | `17.38` units (`1.25x T`) | Anchors the left vertical spine ($x \in [11.75, 29.13]$).                            |
| **Channel Seam ($g$)**                     | `4.00` units              | Uniform vertical negative-space gap between every `E` arm and `=` bar.               |
| **Spine-to-`=` Gap ($s$)**                 | `8.50` units              | Separates the left of the `=` bars ($x = 37.63$) from the inner spine ($x = 29.13$). |
| **Middle `E` Arm Length**                  | `66%` (`x = 68.15`)       | Recessed middle tongue that opens the right profile so the `=` sign dominates.       |
| **`=` Bar Right Extension**                | `-10.0` (`x = 78.25`)     | Nested inside the top/bottom arms (`width = 40.63` units).                           |
| **Outer Spine Radius ($R\_{\text{out}}$)** | `12.00` units             | Smooth, approachable outer-left spine corners.                                       |
| **Inner Armpit Fillet ($R\_{\text{in}}$)** | `7.00` units              | Concave inner fillets where the 3 arms meet the spine, cradling the `=` bars.        |
| **Pill Tip Radius ($r\_{\text{tip}}$)**    | `6.00` units              | Rounded stadium terminals on all right-facing arm and bar tips.                      |

---

## 2. Full Integrated Wordmark (`[E=]kwly` — `354 × 114` Unified SVG)

- **Lockup Architecture:** The standalone `E=` icon acts directly as the capital **`E`** of **`Ekwly`**, followed by custom-drawn rounded capsule vector letterforms for **`kwly`** inside a single `viewBox="0 0 354 114"` SVG (`2124 × 684` master PNG resolution) so the full rounded descender of the `y` ($Y_{\max} = 109.82$) has clean vertical clearance.
- **Locked Wordmark Metrics:**
  - **`E` to `kwly` Gap:** `3` SVG units (`kwly` group starts at `x = 91.25`).
  - **`kwly` Scale:** `109%` (`scale(1.09)`).
  - **Baseline Offset ($Y$):** `-8` (`translateY = 4.09`).
  - **Stroke Thickness:** `15` units (`stroke-linecap="round" stroke-linejoin="round"`).

---

## 3. Official Brand Color Palette

### 3.1 Primary Dark Mode ("OLED Deep Slate + Ice kwly")

- **App Canvas (`--bg-page`):** `#050914`
- **Icon Badge Gradient:** `#071226` $\rightarrow$ `#0F2342` (Border: `#1E3A5F`)
- **`E` Monolith Fill:** `#FFFFFF` (Pure White)
- **`kwly` Wordmark Stroke:** `#93C5FD` (Ice Azure)
- **Upper `=` Bar Fill:** `#0080FF` (Ekwly Electric Azure)
- **Lower `=` Bar Fill:** `#38BDF8` (Cyan Sky)

### 3.2 Primary Light Mode & Print Receipts ("Crisp Daylight")

- **Surface Canvas:** `#FFFFFF` / `#F8FAFC`
- **`E` Monolith Fill:** `#050914` (Deep Midnight Ink)
- **`kwly` Wordmark Stroke:** `#0284C7` (Deep Cerulean)
- **Upper `=` Bar Fill:** `#0080FF`
- **Lower `=` Bar Fill:** `#38BDF8`

---

## 4. Complete 3-Mode Motion Suite (`<BrandLoader/>` & `brand-kit/svg/`)

Only the standalone **`E=` Icon Mark** is animated (`transform-origin: left center; transform-box: fill-box;`). All 3 animations are exported in `brand-kit/svg/` and supported via the `state` prop on `<BrandLoader/>`:

1. **`state="lockin"` (`ekwly-loader-lockin.svg` — 1.0s Magnetic Lock-In):**
   - **Usage:** Initial app boot, room creation, and data fetch states.
   - **Keyframes (`cubic-bezier(0.22, 1, 0.36, 1)`):** Upper and lower `=` bars slide in from `+26px` (`scaleX: 0.5`, `opacity: 0`) with a `0.12s` stagger, overshoot to `-2.5px` (`scaleX: 1.06`), rebound to `+1.5px` (`scaleX: 0.97`), and lock into `0px` (`scaleX: 1.0`).
2. **`state="equalizer"` (`ekwly-loader-equalizer.svg` — 1.0s Counter-Phase Equalizer):**
   - **Usage:** Live split recalculations and background synchronization.
   - **Keyframes (`cubic-bezier(0.45, 0, 0.55, 1)`):** Upper bar shifts `[0 -> +5px (0.72x) -> -1.5px (1.08x) -> 0]` while lower bar counter-balances `[0 -> -2px (1.10x) -> +6px (0.70x) -> 0]`.
3. **`state="scan"` (`ekwly-loader-scan.svg` — 1.2s AI Laser Scan):**
   - **Usage:** Active while `MagicScanner.tsx` / `scan-receipt` processes a restaurant bill photo.
   - **Keyframes (`ease-in-out`):** A `#38BDF8` laser line (`width: 84`, `height: 3.5`) sweeps vertically across the `E=` monolith from `y = 12` to `y = 86` and back.
