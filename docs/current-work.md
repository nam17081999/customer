# Current Work

## Goal
- Refactor With Tests First: audit and separate API/domain/business logic from UI pages, with tests written before implementation and full regression verification after.

## Task Type
- Refactor With Tests First

## Why
- Inventory/order pages still contain business-facing orchestration and raw API error handling patterns.
- Production maintainability requires reusable API/domain services independent from UI rendering.

## In Scope
- Audit API/UI coupling in inventory/order flows.
- Add tests first to lock service behavior and UI integration contracts.
- Extract reusable API/domain orchestration from UI pages where safe.
- Keep UI behavior, routes, cache, inventory/accounting logic unchanged.
- Run focused and full verification.

## Out of Scope
- New business features.
- DB schema changes/migrations.
- Visual redesign.
- Changing Supabase/RLS/inventory accounting semantics.

## Must Preserve
- Existing inventory/accounting/idempotency protections.
- Historical sales cost/profit snapshots remain immutable.
- Pages Router and `@/` imports.
- Store cache/business rules and UTF-8 Vietnamese.
- Existing operator UX and API response shapes.

## Required Verification
- New tests written before refactor for extracted service behavior.
- Focused tests for new service and impacted API client.
- Full Vitest suite.
- ESLint.
- Build.
- Playwright smoke.
- `git diff --check` and mojibake scan.

## Plan
- Audit UI/API coupling.
- Write tests first for service boundaries.
- Extract order/inventory service logic.
- Rewire pages to services without behavior change.
- Run full verification.

## Done
- Added tests first for API/UI boundary in `__tests__/services/inventory/inventoryPageService.test.js`; initial service tests failed until boundary functions were implemented.
- Added `services/inventory/inventory-page-service.js` as UI-independent orchestration layer for orders, purchases, stock, reports, product management, reconciliation, cancel flows, and import confirmation.
- Added `helper/inventoryFormat.js` so pages no longer import inventory API client just for formatting/document code helpers.
- Rewired `pages/orders/**` and `pages/inventory/**` to call service functions instead of direct Supabase/API/store-cache data/mutation calls.
- Verified with search that `pages/orders` and `pages/inventory` no longer import `@/api/inventory/inventory-client` or `@/lib/storeCache` directly.
- Preserved existing business behavior: idempotent mutations, stock checks, reconciliation, drafts, imports, reports, and operator error text.

## Verification
- Test-first proof: `./node_modules/.bin/vitest run __tests__/services/inventory/inventoryPageService.test.js --reporter=verbose` initially failed on missing service exports, then passed after implementation.
- Focused: `./node_modules/.bin/vitest run __tests__/services/inventory/inventoryPageService.test.js __tests__/api/inventoryClient.test.js --reporter=verbose` passed: 30 tests.
- Full: `./node_modules/.bin/vitest run --reporter=dot` passed: 49 files, 511 passed, 3 skipped.
- `./node_modules/.bin/eslint . --ext .js,.jsx --ignore-pattern .next --ignore-pattern node_modules --quiet` passed.
- `./node_modules/.bin/next build` passed.
- `./node_modules/.bin/playwright test e2e/erp-operator-smoke.spec.js --reporter=list` passed: 6 tests after restarting stale local dev server.
- `git diff --check` passed.
- Changed/untracked text mojibake scan passed: 73 files.
- Boundary audit: `rg "api/inventory/inventory-client|lib/storeCache" -n pages/orders pages/inventory` returns no matches.

## Risks / Next
- API/UI separation is completed for `pages/orders/**` and `pages/inventory/**`; legacy store/map flows were not refactored in this pass because they use different domain/cache contracts.
- Formatting helpers were moved to `helper/inventoryFormat.js`; API client still exports old helpers for backward compatibility outside refactored pages.
- Real staging certification remains blocked until a real `STAGING_ADMIN_ACCESS_TOKEN` is supplied.
