# Current Work

## Goal
Fix the short extra vertical scroll/gap that appears on iPhone Safari and Chrome on short pages, while preserving normal scrolling when page data/content is taller than the viewport.

## Task Type
Bug Fix

## In Scope
- Global app/layout CSS that controls viewport height and document scrolling.
- Shared layout wrappers used across pages, especially public pages like `/login`.
- Focused smoke verification for both short-page no-scroll behavior and long-page scroll behavior.

## Out of Scope
- Business logic, Supabase reads/writes, cache behavior, auth behavior, store mutations.
- Redesigning page content, navbar structure, map behavior, or order/inventory flows.
- Adding dependencies.

## Must Preserve
- Dark theme and design-system tokens.
- Pages Router conventions.
- Existing mobile bottom navigation behavior and safe-area spacing.
- UTF-8 Vietnamese text.
- Store/search/map/cache/auth business rules.

## Inputs / Repro / Expected
- Repro: open `/login` or another short page on iPhone Safari/Chrome; page can scroll slightly although no data/content exists below.
- Current: document height exceeds visual viewport by a small amount on iOS browsers.
- Expected: short pages fit the visible viewport without a fake bottom scroll gap; pages with data/content taller than the viewport still scroll normally.

## Constraints
- Prefer a minimal CSS/layout fix.
- Avoid changing data flows or route behavior.
- Use current Tailwind v4/global CSS conventions.

## Required Verification
- Inspect global CSS/layout root cause.
- Run lint or the closest available static check after changes.
- Smoke test a mobile viewport for `/login` with no fake scroll.
- Smoke test a mobile viewport for at least one long/shared-layout page and confirm scrolling still works.
- Regression checklist sections: Checklist chung cho mọi task; Tiếng Việt / UI Safety.

## Plan
- Inspect root layout, `_app`, navbar/layout wrappers, and global CSS viewport rules.
- Identify the CSS causing iOS viewport/document height mismatch.
- Apply a scoped global/layout fix for mobile viewport units, root scroll sizing, and app content overflow.
- Verify short-page no-scroll and long-page scroll behavior with lint and browser/mobile viewport smoke checks.

## Done
- Root cause: global `body` used `min-height: 100vh` while the app shell already uses `dvh`; on iOS browsers `100vh` can exceed the visible viewport when browser chrome is present, creating a small fake scroll range.
- Updated root viewport sizing in `app/globals.css` so `html`, `body`, and `#__next` share the app background and use `100dvh` with `100vh` fallback.
- Added `dvh` overrides for `h-screen` and `min-h-screen` so short pages using Tailwind screen-height utilities do not fall back to iOS `100vh`.
- Re-check requested: ensure the fix does not block legitimate scrolling on pages with content/data taller than the viewport.
- Updated `.content` to `overflow-y: auto` with iOS momentum scrolling, so AppLayout pages can scroll inside the content pane when content is taller than the viewport.

## Verification
- `npm run lint` — 0 errors, 6 existing warnings in unrelated files.
- Playwright mobile viewport smoke test at 390x844:
  - `/login`: `scrollHeight = 844`, `innerHeight = 844`, `maxScrollable = 0`.
  - `/notifications` redirected to `/` when unauthenticated; resulting shared-layout page: `scrollHeight = 844`, `innerHeight = 844`, `maxScrollable = 0`.
  - `/login` after re-check: `maxScrollable = 0`, `bodyOverflowY = auto` (not locked).
  - `/store/create` short state: `mainOverflowY = auto`, `mainMaxScrollable = 0`, no fake document scroll.
  - `/store/create` with temporary 1800px browser-only filler: `mainScrollTop = 500`, `mainMaxScrollable = 1800`, proving long content still scrolls.
- Checklist verified: Checklist chung cho mọi task; Tiếng Việt / UI Safety.

## Risks / Next
- Browser smoke test used Playwright desktop browser with mobile viewport, not a physical iPhone Safari session.
- There are many pre-existing modified/untracked files in the worktree; this task intentionally only changed `app/globals.css` and `docs/current-work.md`.
