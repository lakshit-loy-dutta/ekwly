# Ekwly — Brand Identity, Logo Geometry & Motion Choreography

> **Version:** 1.0.4 (Locked v3 Master Geometry)
> **Brand Concept:** "The Equilibrium Monolith" — Equality in every bar, fairness in every split.
> **Source Implementation:** `src/components/ui/BrandLoader.tsx` & `scripts/generate-brand-assets.mjs`

---

## 1. Logo Construction (`100 × 100` Coordinate Grid)

All three horizontal arms of the `E` and both horizontal bars of the negative-space `=` share identical vertical thickness ($T = 13.90\text{ units}$).

| Parameter                   | Locked Value                                                | Visual Role                                                     |
| :-------------------------- | :---------------------------------------------------------- | :-------------------------------------------------------------- |
| **Equal Bar Height ($T$)**  | `13.90` units                                               | Uniform thickness across all 3 `E` arms and both `=` bars       |
| **Total Mark Height ($H$)** | `85.50` units                                               | $5T + 4g = 69.50 + 16.00$ ($y \in [7.25, 92.75]$)               |
| **Total Mark Width ($W$)**  | `76.50` units                                               | Horizontally centered ($x \in [11.75, 88.25]$)                  |
| **Spine Width**             | `17.38` units (`1.25x T`)                                   | Anchors left vertical spine ($x \in [11.75, 29.13]$)            |
| **Channel Seam ($g$)**      | `4.00` units                                                | Vertical gap between `E` arms and `=` bars                      |
| **Spine-to-`=` Gap ($s$)**  | `8.50` units                                                | Separates `=` bars ($x = 37.63$) from inner spine ($x = 29.13$) |
| **Middle `E` Arm Length**   | `66%` (`x = 68.15`)                                         | Recessed middle arm emphasizing the `=` negative space          |
| **`=` Bar Geometry**        | `x="37.63"`, `width="40.63"`, `height="13.90"`, `rx="6.00"` | Upper bar `y="25.15"`, Lower bar `y="60.95"`                    |
| **Corner Radii**            | Outer `12.00`, Inner fillet `7.00`, Pill tips `6.00`        | Smooth geometric precision                                      |

### Canonical Path (`EKWLY_E_PATH`)

```text
M 23.75 7.25 L 82.25 7.25 A 6.00 6.00 0 0 1 88.25 13.25 L 88.25 15.15 A 6.00 6.00 0 0 1 82.25 21.15 L 36.13 21.15 A 7.00 7.00 0 0 0 29.13 28.15 L 29.13 36.05 A 7.00 7.00 0 0 0 36.13 43.05 L 62.15 43.05 A 6.00 6.00 0 0 1 68.15 49.05 L 68.15 50.95 A 6.00 6.00 0 0 1 62.15 56.95 L 36.13 56.95 A 7.00 7.00 0 0 0 29.13 63.95 L 29.13 71.85 A 7.00 7.00 0 0 0 36.13 78.85 L 82.25 78.85 A 6.00 6.00 0 0 1 88.25 84.85 L 88.25 86.75 A 6.00 6.00 0 0 1 82.25 92.75 L 23.75 92.75 A 12.00 12.00 0 0 1 11.75 80.75 L 11.75 19.25 A 12.00 12.00 0 0 1 23.75 7.25 Z
```

---

## 2. Integrated Wordmark (`[E=]kwly` — `354 × 114` SVG)

- Uses `viewBox="0 0 354 114"` (`2124 × 684` PNG master) so the `y` descender ($Y_{\max} = 109.82$) is never clipped.
- `kwly` vector stroke group: `transform="translate(91.25, 4.09) scale(1.09)"`, `strokeWidth="15"`, `strokeLinecap="round"`, `strokeLinejoin="round"`.

---

## 3. Official Brand Color Palette

| Role                               | Dark Mode (OLED Deep Slate)               | Light Mode (Crisp Daylight)       |
| :--------------------------------- | :---------------------------------------- | :-------------------------------- |
| **App Canvas**                     | `#050914`                                 | `#F2F8FF` / `#FFFFFF`             |
| **Icon Badge Gradient**            | `#071226` -> `#0F2342` (Border `#1E3A5F`) | Same (always dark squircle badge) |
| **`E` Monolith Fill**              | `#FFFFFF`                                 | `#050914`                         |
| **`kwly` Stroke (`--brand-kwly`)** | `#93C5FD`                                 | `#0284C7`                         |
| **Upper / Lower `=` Bars**         | `#0080FF` / `#38BDF8`                     | `#0080FF` / `#38BDF8`             |

---

## 4. 3-Mode Loader Motion Suite (`<BrandLoader/>`)

1. **`lockin` (1.0s Magnetic Lock-In):** Staggered `=` bar slide-in with overshoot (`cubic-bezier(0.22, 1, 0.36, 1)`) for initial boot and room loading.
2. **`equalizer` (1.0s Counter-Phase Equalizer):** Alternating horizontal balance (`cubic-bezier(0.45, 0, 0.55, 1)`).
3. **`scan` (1.2s AI Laser Scan):** Vertical `#38BDF8` sweep (`y: 12 -> 86 -> 12`) during receipt OCR.
4. **Reduced Motion Requirement (Stage 5 — `AUD-14`):** All loader animations must honor OS `prefers-reduced-motion` via Framer Motion `<MotionConfig reducedMotion="user">`, and `<BrandLogo boxed/>` must use React `useId()` for its `<linearGradient>` ID.

---

## 5. Asset Pipeline & Safe Zones

- **Tracked Master Inputs (`resources/`):** `icon-only.png` (`1024×1024`), `icon-foreground.png` (`0.56x` safe inset), `icon-background.png`, `splash.png`, `splash-dark.png` (`2732×2732`).
- **Tracked Web Runtime Icons (`public/`):** `icon.svg`, `favicon.ico`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` (maskable safe-zone `0.62x` scale on full-bleed `rx="0"` background).
- **Reproducible Exports (`brand-kit/`, gitignored):** Regenerated on demand via `node scripts/generate-brand-assets.mjs` (includes `brand-kit/export-png-and-gif.html` and the `1024×500` Google Play Feature Graphic).
