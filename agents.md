# StoreVis Agents Guide

This file defines how AI agents should work in this repository.

## 1. Mission

Build and maintain StoreVis safely, with high correctness for:
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
7. `docs/skills/storevis-project-execution.SKILL.md`
8. `docs/skills/storevis-ai-collaboration.SKILL.md`

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
2. Scope impacted files/routes/components.
3. Apply minimal, targeted code changes.
4. Verify with the closest checks (`npm run lint`, focused smoke tests).
5. Report result with changed files, verification evidence, and residual risk.

## 9. Response Contract (agent output)

Always include:
- Goal
- What changed
- Files touched
- Verification done
- Risks or unverified parts

## 10. Do Not

- Do not make unrelated refactors during small fixes.
- Do not silently change project conventions.
- Do not claim success without fresh verification evidence.
- Do not add new dependencies unless required and justified.

