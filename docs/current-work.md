# Current Work

## Goal
- Follow up PR review comments for order/inventory changes and verify the remaining fixes are covered.

## Task Type
- Bug Fix

## Why
- PR review flagged two issues in the order/inventory follow-up area.
- `toInventoryNumber()` must honor fallback values for blank input.
- Store mini map popup must avoid HTML injection while keeping OSM attribution enabled.

## In Scope
- `helper/orderInventoryFlow.js`
- `components/map/store-detail-mini-map.jsx`
- Direct regression coverage in `__tests__/helper/orderInventoryFlow.test.js`
- Update this working-memory file for the current task.

## Out of Scope
- New order/inventory features outside the flagged review comments.
- Refactors outside the touched helper/map popup code.
- Unrelated UI/layout changes.
- New dependencies.

## Must Preserve
- Pages Router and current routes.
- Existing order/inventory create/list/detail behavior.
- Mini map rendering and nearby-store marker behavior.
- Dark theme, contrast, and readable sizing.
- UTF-8 tiếng Việt.
- OSM attribution compliance and safe popup text rendering.

## Inputs / Repro / Expected
- Input: PR review comments on `toInventoryNumber()` and mini map popup HTML handling.
- Current: latest branch commits already contain the production-code fixes.
- Expected: keep those fixes, add regression proof where practical, and confirm no fresh CI/local validation failures in scope.

## Constraints
- Dùng `apply_patch`.
- Patch nhỏ, giữ behavior.
- Không mở rộng scope sang feature work.

## Required Verification
- `npm run lint`
- `npm run test -- __tests__/helper/orderInventoryFlow.test.js`
- `git diff --check`
- Checklist:
  - Checklist chung cho mọi task
  - Map Flow
  - Tiếng Việt / UI Safety

## Definition of Done
- Blank-input fallback regression is covered by automated test.
- Mini map popup remains safe and attributable.
- Lint/test/diff pass or blockers are documented.

## Plan
- Inspect current branch state vs original comment commit for the two flagged files.
- Add a focused regression test for blank-string fallback behavior.
- Re-run lint and targeted unit tests.
- Summarize CI status and local verification.

## Done
- Verified the latest branch already includes the production-code fixes:
  - `toInventoryNumber()` now returns `fallback` for `null`/blank input before parsing.
  - `StoreDetailMiniMap` keeps `attributionControl: true` and uses `setDOMContent()` with text content instead of `setHTML()`.
- Added a focused unit test that locks blank-string fallback behavior for `toInventoryNumber()`.

## Verification
- Pass: `npm run lint`
  - 0 errors.
  - 1 existing warning remains in `pages/orders/[id].js:272` for external `<img>`.
- Pass: `npm run test -- __tests__/helper/orderInventoryFlow.test.js`
  - 27 tests passed.
- Pass: `git diff --check`.
- Checked GitHub Actions:
  - `develop` recent runs found, all completed successfully.
  - Current branch has an in-progress Copilot run (`26043263157`); no failed jobs/logs available yet.
- Checklist verified:
  - Checklist chung cho mọi task: scoped fix, docs reread, no dependency added, lint/test/diff checked.
  - Map Flow: popup text handling kept safe without changing map source/marker behavior; OSM attribution preserved.
  - Tiếng Việt / UI Safety: no Vietnamese copy changed; patch stayed small.

## Risks / Next
- Did not add an automated test for the mini map popup because the current repo coverage in this area is unit-test focused; popup safety was verified by code inspection plus existing lint.
- `npm ci` warned that the sandbox is on Node 20 while the repo expects Node 24, but lint and the targeted Vitest run still completed successfully.
- Files intentionally touched for this request:
  - `__tests__/helper/orderInventoryFlow.test.js`
  - `docs/current-work.md`
