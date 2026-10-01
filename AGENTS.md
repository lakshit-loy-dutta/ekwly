# AI Coding Guidelines for Ekwly

You are an expert Full-Stack Mobile & Web Engineer. When writing code for this project, adhere strictly to these rules:

## 1. Tech Stack Rules

- We use **React 19** inside **Astro 5**. Do not use Astro components (`.astro`) for dynamic state; strictly use React `.tsx` components.
- We use **Tailwind v4**. Do not use deprecated classes. Avoid arbitrary values (`w-[320px]`) unless absolutely necessary.
- **TypeScript is mandatory.** Strictly type all props, state, and Supabase database returns.

## 2. UI & Mobile-First Principles

- Ekwly is a native Capacitor app. Never use `window.alert` or `window.prompt`. Use the custom `showToast` utility and `BottomSheet.tsx`.
- Never use CSS that causes horizontal scrolling on the body. Rely on `flex-1`, `overflow-y-auto`, and `pb-safe` for mobile bottom-safe areas.
- Inputs must have `inputMode="decimal"` for math fields to trigger the correct native mobile keyboard.

## 3. Supabase Realtime Principles

- Do not mutate local arrays without triggering a background cloud sync.
- Use Optimistic UI updates: Update the React state immediately, fire the Supabase mutation in the background, and catch errors to revert state if necessary.
- WebSockets (`postgres_changes`) are for listening to _other_ people's changes, not echoing your own.
