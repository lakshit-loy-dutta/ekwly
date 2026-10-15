# AI Coding & Architecture Guidelines for Ekwly

You are an expert Principal Full-Stack Mobile & Web Engineer and Product Designer. When writing or refactoring code for Ekwly, adhere strictly to these rules:

## 1. Tech Stack & Tooling Rules

- **Package Manager:** Always use `pnpm` (`pnpm install`, `pnpm test`, `pnpm build`, `pnpm dlx`). Never use `npm` or `yarn` commands.
- **Framework:** We use **React 19** inside **Astro 7**. Do not use `.astro` components for dynamic state; strictly use React `.tsx` components.
- **Styling:** We use **Tailwind CSS v4**. Do not use deprecated classes or `!important` layout overrides (`w-20!`, `pl-10!`). Use scoped utility classes and the semantic design tokens defined in `src/styles/theme.css`.
- **TypeScript:** Strict typing is mandatory. Never introduce `any` when a concrete interface from `src/lib/types.ts` can be used.
- **Unit Testing:** Any change to `src/lib/mathEngine.ts`, `src/lib/splitwiseCsv.ts`, or `src/lib/utils.ts` must pass `pnpm test` (`vitest run`).

## 2. ₹0 Operational Cost Guardrails

- **Static Web Hosting:** Keep Astro output strictly static (`output: 'static'`) for ₹0 hosting on GitHub Pages and local Capacitor bundles.
- **Zero Cloud Storage for Images:** Compress receipt images client-side via HTML5 `<canvas>` before invoking `scan-receipt`, and process them strictly in-memory inside the Edge Function without storing files in Supabase Storage.
- **Batch Database Operations:** Never execute Supabase `.insert()`, `.upsert()`, or `.delete()` inside a `for...of` loop. Always pass arrays to batch mutations (`addItemsBatchToDB`, `batchUpdateClaimsInDB`, `replaceTaxPresetsInDB`) to minimize database connections and Realtime broadcasts.

## 3. UI/UX & Mobile-First Design Principles

- **No Native Browser Dialogs:** Ekwly is a native Capacitor app. Never use `window.alert`, `window.confirm`, or `window.prompt`. Always use `showToast` (`src/lib/utils.ts`) and `<ConfirmSheet/>` / `<BottomSheet/>`.
- **Bento Card Geometry:** Avoid dated full-bleed `border-y` edge-to-edge strips. Group related controls and lists inside inset `mx-4 rounded-2xl bg-surface border border-border shadow-sm` cards with clean vertical rhythm.
- **Financial Scannability:** All currency figures, quantities, and PIN codes must use `tabular-nums` (`font-variant-numeric: tabular-nums`) so digits never jitter during live recalculations.
- **Safe Areas & Thumb Zones:** Respect hardware notches and home indicators using `pb-safe` and `pt-safe`. Keep primary navigation and frequent actions within one-handed thumb reach at the bottom of the viewport.
- **Environment-Aware Paths:** Never hardcode `/ekwly/` in components or pages. Always use `utils.resolvePath('...')` in `.tsx` files and `import.meta.env.BASE_URL` in `.astro` files so both GitHub Pages (`/ekwly`) and Capacitor (`/`) builds resolve assets cleanly.

## 4. Supabase Realtime & Offline Queue Principles

- **Optimistic UI First:** Update React state immediately on user interaction, check `if (!navigator.onLine)` to route to `enqueueMutation` (`src/lib/session/offlineQueue.ts`), and otherwise fire the Supabase mutation in the background with error rollback.
- **Sequenced Reconnection:** Always await `processOfflineQueue()` before calling `fetchSessionData(true)` on `online`/`focus` events so stale server state never overwrites un-synced local mutations.
