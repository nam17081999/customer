# Current Work

## Goal
- Add product unit conversion management to the order/inventory MVP.

## Task Type
- Feature

## Why
- The previous phase completed product edit, but unit conversion editing remained read-only.
- Operators need to add/edit/disable sale units like `thùng 24`, `lốc 6`, `chai/lon` prices directly from the product screen.

## In Scope
- `helper/orderInventoryFlow.js`
- `api/inventory/inventory-client.js`
- `/inventory/products/[id]`
- Unit conversion add/update/disable UI.
- Tests before implementation.

## Out of Scope
- Payment/debt management.
- Barcode support.
- Chart-heavy analytics dashboard.
- Reworking order/purchase flows already completed.
- Applying Supabase migrations to the remote environment.

## Must Preserve
- Admin-only protection for order/inventory pages.
- Stock stored in base units.
- Base unit must stay active with conversion `1`.
- Purchase creation enters stock immediately.
- Sales creation exits stock immediately.
- No hard deletes for products or product units.
- Vietnamese UTF-8 text.
- 1900px workbench design with mobile readability.

## Inputs / Repro / Expected
- Current:
  - Product edit shows units read-only.
  - API lacks create/update helpers for `product_units`.
  - Helper lacks unit payload validation.
- Expected:
  - Admin can add a non-base unit conversion.
  - Admin can update an existing unit conversion/prices/active flag.
  - Base unit cannot be disabled or changed away from conversion `1`.

## Constraints
- Test-first for helper/API behavior.
- Avoid new dependencies.
- Keep UI pragmatic and consistent with the existing dark workbench.

## Required Verification
- Initial focused tests must fail before implementation.
- Focused unit tests for unit helper/API logic.
- Full `npm run test`.
- `npm run lint`.
- `npm run build`.
- `git diff --check`.
- `npm run text:check`.
- Checklist:
  - Checklist chung cho mọi task
  - Tiếng Việt / UI Safety

## Definition of Done
- Tests are written first and pass after implementation.
- Product unit add/update API helpers exist.
- Product edit page can add/update/disable units.
- Verification passes or residual risk is recorded.

## Plan
- Add failing helper/API tests for unit payload validation and unit create/update.
- Implement unit helper and API functions.
- Update product edit UI to add/update/disable units.
- Run focused tests and full verification.

## Done
- Added test-first coverage for product unit payload validation and unit create/update API helpers.
- Added `buildProductUnitPayload()`:
  - normalizes unit names
  - validates positive conversion
  - validates non-negative prices
  - keeps base unit conversion at `1`
  - blocks disabling the base unit
- Added API helpers:
  - `createProductUnit()`
  - `updateProductUnit()`
- Updated `/inventory/products/[id]`:
  - existing units can be edited in-place
  - non-base units can be disabled via `active=false`
  - base unit cannot be disabled and conversion stays locked
  - new unit conversion can be added from the product edit screen

## Verification
- Initial focused tests failed before implementation, as expected:
  - missing `buildProductUnitPayload`
  - missing `createProductUnit`
  - missing `updateProductUnit`
- Pass: focused `npm run test -- __tests__/helper/orderInventoryFlow.test.js __tests__/api/inventoryClient.test.js`
  - 2 test files passed
  - 31 tests passed
- Pass: full `npm run test`
  - 33 test files passed
  - 422 tests passed
- Pass: `npm run lint`.
- Pass: `npm run build`.
- Pass: `git diff --check`.
- Pass: `npm run text:check`.
- Checklist verified:
  - Checklist chung cho mọi task: tests first, scoped implementation, full verification passed.
  - Tiếng Việt / UI Safety: mojibake scan passed; UI remains readable and dark-workbench aligned.

## Risks / Next
- No authenticated browser smoke was run against a real admin session.
- Supabase RLS must allow admin update/insert on `product_units`, already intended by the migration.
