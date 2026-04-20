# Store Edit History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an admin-only “Lịch sử chỉnh sửa” feature that logs store mutations as diffs and displays per-store history on a dedicated page.

**Architecture:** Persist change diffs in a new `public.store_edit_history` table (RLS admin-only). Add a shared logger helper to compute normalized diffs and insert history rows after successful store mutations. Add a Pages Router page `/store/history/[id]` and a button in `StoreDetailModal` (admin-only) to navigate there.

**Tech Stack:** Next.js Pages Router, React, Supabase JS, Tailwind v4, existing AuthContext (`useAuth`) + RLS helper `public.is_admin_user()`.

---

### Task 1: Add history DB migration (docs/sql)

**Files:**
- Create: `docs/sql/2026-04-20-add-store-edit-history.sql` (already drafted)
- Reference: `docs/sql/2026-04-06-auth-roles-and-rls.sql`

- [ ] **Step 1: Verify `stores.id` type before applying migration**
  - Check in Supabase: `public.stores.id` is `uuid` (default) or `bigint`.
  - If `bigint`, edit migration to use `store_id bigint` and FK accordingly.

- [ ] **Step 2: Apply SQL migration in Supabase**
  - Run SQL in Supabase SQL Editor.
  - Expected: table exists, RLS enabled, policies created.

---

### Task 2: Add shared diff + logger helper

**Files:**
- Create: `lib/storeEditHistory.js`

- [ ] **Step 1: Implement diff normalization helpers**
  - Normalize nullable text: treat `''` and `null` as equal.
  - Normalize coordinates: round to 6 decimals before compare.

- [ ] **Step 2: Implement `buildStoreDiff(before, afterPartial)`**
  - Input: `beforeStore` object (from cache/UI), `afterPartial` object (updates we are applying).
  - Output: `changes` json object `{ fieldKey: { from, to } }` for fields that differ after normalization.
  - Exclude UI-only fields (e.g. `distance`).

- [ ] **Step 3: Implement `logStoreEditHistory(...)`**
  - Inserts into `store_edit_history` with `store_id`, `action_type`, `actor_user_id`, `actor_role='admin'`, `changes`.
  - No-op if `changes` is empty.

---

### Task 3: Add admin history page `/store/history/[id]`

**Files:**
- Create: `pages/store/history/[id].js`

- [ ] **Step 1: Add admin-only guard**
  - If not authenticated: redirect `/login?from=<current>`
  - If authenticated but not admin: redirect `/account`

- [ ] **Step 2: Load store name from cache**
  - Try `getCachedStores()` and find store by `id`.
  - If cache is empty/unavailable, fallback to `getOrRefreshStores()` then find by `id`.
  - Show safe fallback header when store name is missing (e.g. `Cửa hàng: <id>`).

- [ ] **Step 3: Query history with paging**
  - Query `store_edit_history` by `store_id`, order `created_at desc`, fetch 50 rows via `.range(0, 49)`.
  - Implement “Tải thêm” to fetch next page (50 at a time).
  - Empty state if no rows.

- [ ] **Step 4: Render history entries**
  - Action label mapping: `edit`, `supplement`, `verify`, `report_apply`, `delete_soft`.
  - Render each changed field with `from → to` display.
  - Keep font sizes accessible (no `text-xs` for important content).

---

### Task 4: Add “Lịch sử chỉnh sửa” button in store detail modal (admin-only)

**Files:**
- Modify: `components/store-detail-modal.jsx`

- [ ] **Step 1: Add button visible only for `isAdmin`**
  - Label: `Lịch sử chỉnh sửa`
  - On click: `router.push(/store/history/${store.id}?from=<encoded current>)`

---

### Task 5: Hook logging into store mutations

**Files:**
- Modify: `pages/store/edit/[id].js`
- Modify: `pages/store/verify.js`
- Modify: `pages/store/reports.js`
- Modify: `components/store-detail-modal.jsx`

- [ ] **Step 1: `/store/edit/[id]`**
  - After successful `supabase.from('stores').update(...)`:
    - compute diff between `store` (before) and `updates`/`storeUpdates`
    - log `action_type='supplement'` or `action_type='edit'`
    - pass `actor_user_id = user?.id` (from `useAuth()`)
  - Only admin branch logs (supplement guest branch inserts `store_reports` → do not log here).

- [ ] **Step 2: `/store/verify`**
  - After successful bulk verify:
    - Use store objects in current `stores` state as `beforeStore`
    - For each `id`: diff `active: false → true` (and include `updated_at` optionally)
    - Batch insert history rows (chunk size 100) to avoid large payloads.
    - pass `actor_user_id = user?.id` (from `useAuth()`)

- [ ] **Step 3: `/store/reports`**
  - In `handleApproveEdit(report)` after stores update succeeds:
    - diff from `report.store` to `storeUpdates`
    - log `action_type='report_apply'`
    - pass `actor_user_id = user?.id` (from `useAuth()`)
  - Do not log for `reason_only` (no stores update).

- [ ] **Step 4: `StoreDetailModal` soft delete**
  - After successful update `deleted_at`:
    - log `action_type='delete_soft'` with `deleted_at: null → nowIso`
    - pass `actor_user_id = user?.id` (from `useAuth()`)

---

### Task 6: Verification

**Files:**
- (no new files)

- [ ] **Step 1: Run lint**
  - Run: `npm run lint`
  - Expected: exit code 0

- [ ] **Step 2: Smoke test (admin)**
  - Open store detail modal → see “Lịch sử chỉnh sửa”
  - Click → history page loads
  - Edit a store note → refresh history → see diff with `from/to`

- [ ] **Step 3: RLS + edge-case checks**
  - Login as non-admin → history page redirects to `/account` (or `/login` if signed out)
  - Approve `reason_only` report → must NOT create history rows
  - “Load more” pagination works without duplicates
  - Cold navigation: open `/store/history/[id]` directly (no prior cache) and page still renders acceptably

