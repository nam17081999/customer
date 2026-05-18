# Current Work

## Goal
- Fix the reported React Doctor issues in state/effects, performance, correctness, Next.js routing warning, and the explicitly referenced architecture warnings without changing store business behavior.

## Task Type
- Bug Fix

## Why
- The current report shows effect subscriptions without explicit cleanup, unnecessary rerender state, chained iterations, index keys, and style warnings.
- These can cause leaks, unstable render behavior, avoidable rerenders, or noisy quality gates.

## In Scope
- `components/map/store-detail-mini-map.jsx`
- `components/map/location-picker.jsx`
- `components/store/store-supplement-form.jsx`
- `components/search-store-card.jsx`
- `screens/auth/account-screen.jsx`
- `components/layout/app-navbar.jsx`
- `pages/map.js`
- `pages/_app.js`
- Minimal docs working-memory update for this task.

## Out of Scope
- Broad Tailwind palette migration across the whole app.
- New features or route redesign.
- Store mutation/cache logic.
- Search scoring, duplicate detection, DB schema, auth provider changes.
- Adding dependencies.

## Must Preserve
- Pages Router route structure.
- Public store reads through `getOrRefreshStores()`.
- Map query/location behavior and coordinate validation assumptions.
- Supplement flow step behavior, including auto-start location only when entering the location step.
- Account page auth guard behavior for unauthenticated users.
- Dark theme, readable text, and Vietnamese UTF-8.

## Inputs / Repro / Expected
- Input: React Doctor report listing warnings in map mini map, supplement form, navbar, account screen, location picker, and search card.
- Current: subscriptions/timers are not always cleaned explicitly, some state is only used as a rerender gate, array index is used as highlight key, and some Tailwind classes trigger project warnings.
- Expected: referenced warnings are removed or reduced with minimal targeted changes, while the affected UI flows keep the same behavior.

## Constraints
- Use `apply_patch` for file edits.
- Do not rewrite unrelated UI or business logic.
- Keep the scope to the issues named in the user request.

## Required Verification
- `npm run lint`
- `npm run text:check`
- `git diff --check`
- Run a focused React Doctor check if available.
- Checklist:
  - Checklist chung cho mọi task
  - Map Flow
  - Edit / Supplement / Report
  - Search Flow
  - Tiếng Việt / UI Safety

## Definition of Done
- Targeted code changes compile through lint.
- Cleanup functions remove MapLibre listeners/timers where applicable.
- No array index key remains in the reported search highlight path.
- Account screen avoids page-ready state rerenders and destructures router methods.
- Working memory records final verification and residual risk.

## Plan
- Patch map mini map listener cleanup and combine nearby-store iteration.
- Patch location picker listener/timer cleanup and batch simple DOM style writes.
- Move supplement location auto-start logic into the step transition handler where possible.
- Patch account screen router method usage and replace render-only state.
- Patch search highlight key stability.
- Patch the referenced navbar Tailwind warning examples.
- Run verification and update this file with outcome.

## Done
- Fixed explicit MapLibre listener cleanup in `components/map/store-detail-mini-map.jsx`.
- Reworked mini map nearby-store processing to avoid chained `.filter().map()` and replaced nearby-store updates with reducer dispatch.
- Reworked mini map readiness trigger to avoid render-only state.
- Batched selected-location marker DOM style writes in `components/map/location-picker.jsx`.
- Added explicit MapLibre listener cleanup in `components/map/location-picker.jsx`.
- Combined nearby store coordinate normalization/filtering into one loop in `components/map/location-picker.jsx`.
- Moved supplement location auto-start out of a state-setting effect and into step transition handling in `components/store/store-supplement-form.jsx`.
- Removed account `pageReady` state, destructured router `replace`, and kept the auth guard behavior in `screens/auth/account-screen.jsx`.
- Replaced highlighted search mark index keys with stable range keys in `components/search-store-card.jsx`.
- Updated the referenced navbar palette/size shorthand examples in `components/layout/app-navbar.jsx`.
- Removed mobile zoom restriction from `pages/_app.js`.
- Added explicit map event detachers for public `/map` marker/load/style listeners in `pages/map.js`.

## Verification
- Pass: `npm run lint`
  - 0 errors.
  - 1 existing warning remains in `pages/orders/[id].js` for external QR `<img>`.
- Pass: `npm run test`
  - 33 test files passed.
  - 427 tests passed.
- Pass: `npm run text:check`
  - No mojibake detected.
- Pass: `git diff --check`.
- Pass with warnings: `npx react-doctor@latest . --verbose`
  - Exit code 0.
  - 0 errors.
  - Score 63 / 100.
  - 1598 warnings remain across 100 files, mostly pre-existing broad architecture/design/dead-code warnings outside this task.
- Checklist verified:
  - Checklist chung cho mọi task: scoped change, no dependency added, lint/test/text/diff checked.
  - Map Flow: listener cleanup changed only; map query/store rendering behavior not changed.
  - Edit / Supplement / Report: supplement step behavior preserved; location setup still starts when entering step 3.
  - Search Flow: highlight key stability changed only; search scoring/filtering untouched.
  - Tiếng Việt / UI Safety: UTF-8 scan passed.

## Risks / Next
- No browser/manual smoke test was run for map drag/click interactions.
- React Doctor still reports broad repo warnings outside the requested targeted fixes, especially palette migration, giant components, dead code, and unrelated array-index keys.
- `components/map/store-detail-mini-map.jsx:141` still has a React Doctor `async-defer-await` warning because the dynamic import keeps a post-await cancellation guard to avoid creating a map after unmount.
