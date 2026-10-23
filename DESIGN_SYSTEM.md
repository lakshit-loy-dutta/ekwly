# Ekwly — Design System, Motion Language & High-FPS Engineering Spec (`DESIGN_SYSTEM.md`)

> **Version:** 1.0.2 (Dynamic Theme-Color Meta Sync, Seamless Sawtooth Thermal Receipt, 3-Row Receipt Item Hierarchy & Skeuomorphic Shareable Receipt Tickets)  
> **Design Philosophy:** "Tactile Financial Equilibrium" — Precision dark-slate fintech aesthetics paired with skeuomorphic thermal receipt tactility and 240Hz-ready spring physics.  
> **Target Platforms:** Web PWA, iOS Native (Capacitor 8), Android Native (Capacitor 8) — 100% Feature & Visual Parity.

---

## 1. High-Refresh-Rate Rendering Rules (60Hz / 90Hz / 120Hz / 144Hz / 240Hz)

1. **Strictly Composited Animations Only:** Animate only `transform` and `opacity` (or Framer Motion `layout="position"`).
2. **2-Tier Glassmorphic System (`src/styles/components.css`):**
   - **`.glass-chrome`:** Uses `backdrop-filter: blur(20px) saturate(180%)` strictly on fixed viewport chrome (Sticky Top Header, Sticky 2-Tab Switcher, Floating `<BottomDock/>`).
   - **`.glass-card`:** Uses a multi-stop translucent linear gradient and top specular inner highlight border (`inset 0 1px 0`) with `0ms` blur overhead on scrolling cards.
3. **Dynamic OS Status Bar & Gesture Bar Sync (`src/pages/index.astro`):**
   - `applyThemeMeta(theme)` updates `<meta id="theme-color-meta" name="theme-color">`, `document.documentElement.style.colorScheme`, and `document.documentElement.style.backgroundColor` dynamically between `#f2f8ff` (`light`) and `#050914` (`dark`) so mobile notification and home indicator bars blend seamlessly with the app canvas.

---

## 2. Skeuomorphic Thermal Receipt & Shareable Ticket Language

### 2.1 In-App Live Bill Split Receipt (`ReceiptWorkbench.tsx`)

- **Seamless 32-Tooth Sawtooth Edges (`<ThermalReceiptSawtooth/>`):** Overlaps `.pos-receipt` by `-1px` (`-mb-px` / `-mt-px`) with matching `--receipt-bg` fill and no conflicting top inset border so the serrated teeth and receipt body fuse into a single sheet in both Light and Dark modes.
- **Tidy 3-Row Dish Layout:**
  - **Row 1:** `01. Dish Name` (left) + `₹LineTotal` & `Edit`/`Delete` icons (right).
  - **Row 2:** Compact single-line metadata strip (`xQty • ₹Unit/ea • select.receipt-select [Tax %] • [+S.C.] • [✓ Split]`).
  - **Row 3:** `[All]` + `[Member Fraction]` avatar pills + `[Sliders]` custom fraction toggle.

### 2.2 Shareable Skeuomorphic Receipt Images & 1-on-1 Payment Cards (`bentoReceipt.ts`)

- Rendered on a theme-independent Midnight-Paper slate ticket (`#152238` $\rightarrow$ `#111C2E` over `#070D19` with 28 serrated teeth and perforated side notches) so shared images look crisp inside both Light and Dark WhatsApp chat threads.
- **Full Receipt Image (`exportBentoReceiptImage`):** Displays Grand Total, Individual Shares, `SETTLEMENT SUMMARY (WHO PAYS WHOM)`, and embeds a Scan-to-Pay UPI QR block for **every unsettled creditor**.
- **Personal Payment Card (`exportPersonalNudgeImage`):** Displays a single friend's itemized dishes, exact amount owed, and a pre-filled UPI QR code for 1-on-1 WhatsApp nudges.
