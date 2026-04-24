# NPP Hà Công Agents Guide

This file defines how AI agents should work in this repository.

## 1. Mission

Build and maintain NPP Hà Công safely, with high correctness for:
- Store search (Vietnamese-friendly matching)
- Store create/edit/report/verify flows
- Map and geolocation behavior
- Supabase + cache consistency
- Accessibility-first UI

## 2. Mandatory Read Order (before coding)

1. `docs/ai-rules.md`
2. `docs/architecture.md`
3. `docs/business-rules.md`
4. `docs/database.md`
5. `docs/design-system.md`
6. `docs/project-context.md`
7. `docs/ai-task-template.md`
8. `docs/ai-task-types.md`
9. `docs/current-work.md`
10. `docs/regression-checklist.md`
11. `docs/skills/storevis-project-execution.SKILL.md`
12. `docs/skills/storevis-ai-collaboration.SKILL.md`

## 2b. Daily Working Memory (mandatory)

- `docs/current-work.md` is the short-term working memory for every task.
- `docs/regression-checklist.md` is the required regression gate before claiming completion.
- `docs/ai-task-template.md` is the required request structure for every task.
- `docs/ai-task-types.md` is the required classification list for every task.
- Before editing code or docs, explicitly choose one primary `Task Type` from `docs/ai-task-types.md`.
- Before editing code or docs, the task must be normalized into the structure from `docs/ai-task-template.md`.
- If the user request is not already written in that structure, the agent must synthesize it from the prompt, docs, and code before implementation.
- Before editing code or docs, update `docs/current-work.md` with:
  - `Goal`
  - `In Scope`
  - `Out of Scope`
  - `Must Preserve`
  - `Plan`
- Do not start implementation while the normalized task still lacks:
  - `Goal`
  - `Task Type`
  - `In Scope`
  - `Out of Scope`
  - `Must Preserve`
  - `Required Verification`
- Before closing a task, update `docs/current-work.md` with:
  - `Done`
  - `Verification`
  - `Risks / Next`
- For every task, explicitly choose the relevant sections in `docs/regression-checklist.md` and verify them before reporting success.
- Do not rely on chat history as the source of truth when these files are present.
- If one user request mixes `bugfix`, `refactor`, and `feature`, split it into phases and keep only one primary `Task Type` active at a time.

## 3. Default Skill Stack

For all technical tasks, combine:
- `$storevis-project-execution`
- `$storevis-ai-collaboration`

Add when text/data can break Vietnamese output:
- `$lean-vietnamese-dev-flow`

## 4. Architecture Constraints

- Routing: use Pages Router (`pages/`) for page routes.
- Internal imports: use `@/` alias, avoid deep relative imports.
- Public store reads: use `getOrRefreshStores()` from `lib/storeCache.js`.
- Keep existing app structure and patterns unless explicitly asked to redesign.

## 5. Data and Safety Rules

- Never hard-delete stores. Use soft delete with `deleted_at`.
- `image_url` in DB stores filename only, not full URL.
- After store mutation, update cache correctly:
- create -> `appendStoreToCache(newStore)`
- soft delete -> `removeStoreFromCache(id)` (and invalidate if needed)
- edit/verify/report-apply -> `invalidateStoreCache()`
- Broadcast `storevis:stores-changed` when cross-page sync is needed.
- Do not bypass business state rules for `active`, `deleted_at`, report statuses.

## 6. Domain Behavior Rules

- Create flow must keep duplicate checks and final validation order.
- Search must preserve Vietnamese matching behavior (accent/no-accent and phonetic rules in docs).
- Map flow must keep `/map` query behavior (`storeId`, `lat`, `lng`) and coordinate validation.
- Report flows must keep clear separation:
- `edit` report can propose data changes
- `reason_only` report does not edit store data directly

## 7. UI and Accessibility Rules

- Follow dark theme rules defined in docs.
- Maintain readable text sizing and high contrast.
- Keep actionable controls touch-friendly (minimum practical tap size).
- Do not introduce tiny text for important information.

## 8. Working Process (every task)

1. Restate goal and assumptions briefly.
2. Classify the task with one primary `Task Type` from `docs/ai-task-types.md`.
3. Normalize the request using `docs/ai-task-template.md`.
4. Update `docs/current-work.md` before coding.
5. Scope impacted files/routes/components and relevant checklist sections.
6. Apply minimal, targeted code changes.
7. Verify with the closest checks (`npm run lint`, focused smoke tests) plus the relevant items in `docs/regression-checklist.md`.
8. Update `docs/current-work.md` with outcome, verification evidence, and residual risk.
9. Report result with changed files, verification evidence, and residual risk.

## 9. Response Contract (agent output)

Always include:
- Goal
- What changed
- Files touched
- Verification done
- Risks or unverified parts

Prefer to also include:
- Task Type
- Checklist sections verified

## 10. Do Not

- Do not make unrelated refactors during small fixes.
- Do not silently change project conventions.
- Do not claim success without fresh verification evidence.
- Do not add new dependencies unless required and justified.
