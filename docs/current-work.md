# Current Work

## Goal
- Hide products that are already in the active draft order from `/orders/new` product search results.

## Task Type
- Bug Fix

## Why
- The order screen currently lets users search and add the same product more than once.
- User wants an already-added product to disappear from search results for the current order.

## In Scope
- Add test-first helper coverage for excluding selected product ids from search.
- Update product search on `/orders/new` to exclude products already present in the active draft.
- Keep deletion behavior: after deleting a line, the product should be searchable again.

## Out of Scope
- Merging duplicate product rows.
- Changing inventory/order submit payload.
- Changing product units or pricing behavior.
- Other order screen layout changes.

## Must Preserve
- Existing active draft behavior.
- Existing draft persistence.
- Existing search by product name/SKU.
- Existing order submit API.
- UTF-8 Vietnamese text.

## Inputs / Repro / Expected
- Repro:
  - Open `/orders/new`.
  - Add product A to current draft.
  - Search product A again.
- Current: product A appears and can be added again.
- Expected: product A does not appear while it is already in the active draft.

## Constraints
- Use `apply_patch`.
- Tests first.
- Do not add dependencies.

## Required Verification
- `npm run test -- __tests__/helper/orderInventoryFlow.test.js`
- `npm run test`
- `npm run lint`
- `git diff --check`
- Targeted mojibake scan on touched files.
- Smoke `/orders/new`.

## Definition of Done
- Helper test proves selected product ids are excluded.
- `/orders/new` search no longer shows products already in the active draft.
- Verification passes or blockers are documented.

## Plan
- Add failing test for `filterInventoryProducts(..., excludeProductIds)`.
- Implement helper filtering.
- Pass active draft product ids from `/orders/new`.
- Run verification.

## Done
- Added test-first coverage in `__tests__/helper/orderInventoryFlow.test.js` for `excludeProductIds`.
- Extended `filterInventoryProducts()` to skip products whose ids are already selected.
- Updated `/orders/new` product search to pass product ids from the active draft items.
- Removed now-unused local `productLabel()` because product filtering is centralized in the helper.

## Verification
- Initial focused test failed before helper implementation because excluded ids were ignored.
- Pass: `./node_modules/.bin/vitest run __tests__/helper/orderInventoryFlow.test.js`
  - 41 tests passed.
- Pass: `npm exec vitest run`
  - 36 files passed, 451 tests passed.
- Pass: `npm run lint`
  - 0 errors.
  - 2 existing `<img>` warnings in `pages/orders/[id].js` and `.claude/worktrees/.../pages/orders/[id].js`.
- Pass: `git diff --check`.
- Pass: targeted mojibake scan on touched files.
- Pass: `npm run text:check:staged`.
- Smoke: `HEAD /orders/new` returned `200` on `http://localhost:3001`.

## Risks / Next
- If users need to sell the same product with two different units/prices in one order, the current requested behavior prevents that until the existing row is deleted.
