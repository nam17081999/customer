# Current Work

## Goal
Fix create-store flow where step 3 can still block with “store already exists” after the user reviewed possible duplicate suggestions and intentionally continued.

## Task Type
bugfix

## In Scope
- Create-store duplicate detection/confirmation state.
- Step transition from duplicate warning to final create step.
- Minimal UI/state logic needed to preserve intentional continue behavior.

## Out of Scope
- Redesign create-store UI.
- Change store matching algorithms beyond this bug.
- Change DB schema, cache architecture, or unrelated report/edit flows.

## Must Preserve
- Duplicate checks and final validation order.
- Vietnamese-friendly matching behavior.
- Store create cache update rules.
- No hard delete/store-photo logic changes.
- Existing Pages Router/import conventions.

## Plan
1. Locate create-store step and duplicate state logic.
2. Identify stale duplicate flag/error path at step 3.
3. Patch minimal state transition/reset behavior.
4. Run focused lint or validation where practical.
5. Update this file with Done/Verification/Risks.

## Required Verification
- Confirm duplicate warning can be intentionally bypassed only via existing next/continue path.
- Confirm exact duplicate final guard still blocks when no duplicate confirmation exists.
- Run `npm run lint` and focused create-store e2e.

## Done
- Bound “Vẫn tạo cửa hàng” confirmation to the normalized store name.
- Final name-duplicate recheck now skips only when the same normalized name was explicitly confirmed.
- Name changes/reset/new duplicate check clear that confirmation so stale bypass cannot leak.

## Verification
- `npm run lint` passed with 0 errors; 1 unrelated existing warning in `.claude/worktrees/condescending-williamson-122bbe/pages/orders/[id].js` about `<img>`.
- `./node_modules/.bin/playwright test e2e/store-create.spec.js -g 'hiện cảnh báo nghi trùng' --reporter=line` passed.
- Regression checklist sections verified: Create/Edit duplicate flow, cache mutation path unchanged, Vietnamese matching helper unchanged, UI flow unchanged.

## Risks / Next
- Manual browser smoke on real Supabase data still recommended for the exact device/location case.
