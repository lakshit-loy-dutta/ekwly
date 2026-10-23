# Ekwly — Brand Identity, Logo Geometry & Visual Guidelines (`BRAND_IDENTITY.md`)

> **Version:** 1.0.3 (Complete Specification: Unclipped `354 × 114` Wordmark, Maskable Safe-Zone Icon Scaling, Binary `.ICO` Spec, `<canvas>` Ticket Rendering & Executive PDF Vector Header)  
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
- **Locked Wordmark Metrics:** Gap = `3` (`x = 91.25`) | Scale = `109%` (`scale(1.09)`) | Baseline Offset $Y = -8$ (`translateY = 4.09`) | Stroke = `15` (`stroke-linecap="round" stroke-linejoin="round"`).

---

## 3. Official Brand Color Palette & Cross-Media Deployment

1. **Dark Mode & Shareable Receipt Tickets:** Canvas `#050914` | Ticket Surface `#152238` | `E` `#FFFFFF` | `kwly` `#93C5FD` | Top `=` `#0080FF` | Bottom `=` `#38BDF8`.
2. **Light Mode:** Canvas `#F2F8FF` | Surface `#FFFFFF` | `E` `#050914` | `kwly` `#0284C7` | Top `=` `#0080FF` | Bottom `=` `#38BDF8`.
3. **Executive PDF Statement (`src/lib/pdf.ts`):** Draws the `[E=]kwly` vector mark directly into the `#071226` header banner using native PDF vector primitives (`doc.roundedRect`).
