# Current Work

## Goal
Redesign store creation page from multi-step to single-page UI, with new duplicate check rules triggered after name + location are filled.

## Task Type
Feature

## Done
- Single-page layout: store type (show more) → name → map → district/ward (auto-filled) → address → phone → note → submit
- Store type picker now supports `showMore` prop: defaults to "Tạp hóa" + "Quán ăn/uống" with "Xem thêm" toggle
- Duplicate check auto-runs 800ms after name + location are both filled:
  - 50m radius: 1+ keyword match after ignoring IGNORED_NAME_TERMS
  - No-location stores: exact or reversed name match after ignoring IGNORED_NAME_TERMS
- Removed all step-based navigation (currentStep, step transitions, step indicator, mobile action bar)
- Removed `buildCreateSteps`, `shouldShowCreateMobileActionBar` from storeCreateFlow
- Telesale quick-save flow preserved (confirm dialog when no location)

## Verification
- `npm run lint` — 0 errors, 0 warnings
- `npm test` — 48 test files, 502 passed, 3 skipped
- Duplicate check tests: 53 passed (existing tests still green)

## Risks / Next
- Auto-duplicate-check triggered by name + location changes; if user moves marker many times, the check re-runs (debounced 800ms). Consider increasing debounce if perf becomes an issue.
- The `_app.js` still sets page title to 'Thêm cửa hàng' for `/store/create` — keep as-is.
- E2E test (`e2e/store-create.spec.js`) may need updating for the new single-page layout — update when running E2E.
