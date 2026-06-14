# Form Page Notification Patterns — Audit Report

Date: 2026-06-14
Project: ~/Desktop/customer
Scope: All form pages + Msg component + navbar overlap + responsive

---

## 1. Msg Component (components/ui/msg.jsx)

| Property | Value |
|---|---|
| Position | `fixed left-1/2 -translate-x-1/2 top-5 z-[60000]` |
| Width | `w-[92%] max-w-md` (responsive: 92% viewport on mobile, capped 448px on desktop) |
| Types | `success` (emerald), `error` (red), `info` (surface) |
| Auto-dismiss | `duration` prop (default 2500ms) with fade-out anim (300ms) |
| Accessibility | `role="status"`, `aria-live="polite"` |

### Overlap with Navbar

- Desktop navbar: `sticky top-0 z-50` → Msg `z-[60000]` >> 50 → **No overlap**
- Mobile bottom tab bar: `fixed bottom-0 z-[1000]` → Msg z-index >> 1000 → **No overlap**
- Msg `top-5` places it below the sticky desktop navbar's visual area → visible above content
- **BUT**: On pages with `sticky top-0` header bars (e.g. /store/edit with `editTopContent` z-20), Msg at top-5 may overlap that sticky header content visually. The z-index (60000) ensures it's on top, but the header may partially block the toast.
- **Risk**: On /orders/new, the search bar area is `sticky top-0 z-40` — Msg z-[60000] > 40, so Msg renders above it, but the `top-5` positioning means the toast may sit on top of the sticky bar content rather than above it.

### Responsive Assessment

- `w-[92%]` → 92% of viewport on all screens, capped at `max-w-md` (448px) → **Adequate**
- No horizontal scroll issues on mobile
- `break-words` prevents overflow with long text
- `top-5` stays fixed; on mobile with bottom tab bar (56px), notification is visible above content
- **Verdict**: Good responsive behavior

---

## 2. Per-Page Audit Table

| # | Page | Component | Uses Msg? | Success Msg | Error Msg | Validation Msg | Inline Error? | Duration | Notes |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `/store/create` | `pages/store/create.js` → `StoreStepFormLayout` | **Yes** ✅ | `pushSearchWithNotice('Tạo cửa hàng thành công!')` → flash + redirect to `/` | `showMessage('error', ...)` → Msg toast | `showMessage('error', ...)` → Msg toast + fieldErrors `<div>` | Yes (`fieldErrors.name`, etc.) | 2500ms | Success uses sessionStorage flash (persistent on next page); errors are auto-dismiss toast |
| 2 | `/store/edit/[id]` | `pages/store/edit/[id].js` → `StoreSupplementForm` → `StoreStepFormLayout` | **Yes** ✅ | `pushSearchWithNotice('Đã lưu thay đổi cửa hàng!')` → flash + redirect | `showMessage('error', ...)` → Msg toast | `showMessage('error', ...)` → Msg toast + fieldErrors | Yes | 3000ms | Same pattern as create; edit controller has 3000ms duration |
| 3 | `/store/report/[id]` | `pages/store/report/[id].js` → `StoreReportForm` | **Yes** ✅ (direct) | `showMessage('success', ...)` Msg + `pushSearchWithNotice(...)` | `showErrorWithScroll(...)` → Msg toast | `showErrorWithScroll(...)` → Msg toast + scroll-to-field | No inline (uses Msg for validation) | 3000ms | Validation errors only go to Msg toast (auto-dismiss) — user may miss them |
| 4 | `/store/verify` | `pages/store/verify.js` | **No** ❌ | `setMessage(...)` → inline green `<div>` | `setError(...)` → inline red `<div>` | N/A (select-based) | No | Persistent | Uses inline colored boxes — good for persistent visibility |
| 5 | `/store/import` | `pages/store/import.js` | **No** ❌ | `setImportResult(...)` → inline green `<div>` | `setParseError(...)` → inline red `<div>` | `setParseError` per-row issues | Yes (per-row) | Persistent | Good persistent error display |
| 6 | `/store/export` | `pages/store/export.js` | **No** ❌ | None (file download, no feedback) | `setError(...)` → inline red `<div>` | N/A | No | Persistent | No success message after export; user may not know download started |
| 7 | `/orders/new` | `pages/orders/new.js` | **Yes** ✅ (direct) | `showSuccessMessage(...)` → Msg success (or flash + redirect) | `setError(...)` → inline red **banner** (NOT Msg) | N/A (inline error banner) | No (error banner) | 2500ms (success) | **Inconsistency**: success → Msg toast, error → inline banner. Errors should also use Msg or vice versa |
| 8 | `/orders/[id]` | `pages/orders/[id].js` | **No** ❌ | None after cancel (reloads data) | `setError(...)` → inline red `<div>` | N/A | No | Persistent | Missing success feedback after cancel |
| 9 | `/inventory/products` | `pages/inventory/products.js` | **No** ❌ | `setMessage(...)` → inline green `<div>` | `setError(...)` → inline red `<div>` | N/A (native HTML5 form) | No | Persistent | Inline boxes used consistently |
| 10 | `/inventory/purchases/new` | `pages/inventory/purchases/new.js` | **No** ❌ | None (redirects on success) | `setError(...)` → inline red `<div>` | N/A | No | N/A for success | **Missing success feedback**: redirects to `/inventory/products` without any message |
| 11 | `/inventory/purchases/[id]` | `pages/inventory/purchases/[id].js` | **No** ❌ | None (reloads data) | `setError(...)` → inline red `<div>` | N/A | No | Persistent | Missing success feedback after cancel |
| 12 | `/account` | `screens/auth/account-screen.jsx` | **No** ❌ | None | None (sign-out errors logged to console) | N/A | No | N/A | Not a form page per se; no feedback needed |
| 13 | `/admin/users` | `pages/admin/users.js` | **No** ❌ | `setMessage(...)` → inline green `<div>` | `setError(...)` → inline red `<div>` | N/A | No | Persistent | Consistent inline pattern |
| 14 | `/login` | `pages/login.js` | **No** ❌ | None (redirects) | `setError(...)` → inline red `<p>` text | Inline text (`setError` for empty fields) | Yes (paragraph) | Persistent | Uses plain `<p>` with no styling beyond `text-red-400` — no border/box |
| 15 | `/inventory/products/[id]` | Does not exist as page | N/A | N/A | N/A | N/A | N/A | N/A | Not found in codebase |

---

## 3. Patterns Summary

### Msg Usage
- **Uses Msg**: `/store/create`, `/store/edit/[id]`, `/store/report/[id]`, `/orders/new`
- **Uses inline boxes**: `/store/verify`, `/store/import`, `/store/export`, `/orders/[id]`, `/inventory/products`, `/inventory/purchases/new`, `/inventory/purchases/[id]`, `/admin/users`
- **Uses plain text**: `/login`
- **No feedback**: `/account`

### Notification Pattern Mix
Two fundamentally different patterns exist:

**Pattern A — Toast (Msg)**: Auto-dismiss after 2.5–3s. Used by store create/edit/report and orders/new. 
- ✅ Non-blocking, user continues work
- ❌ Errors disappear quickly; if user was looking elsewhere, they miss the error
- ❌ Duration (2500ms) may be too short for Vietnamese text of 20+ chars

**Pattern B — Inline boxes**: Persistent until next action. Used by verify/import/export/inventory/admin.
- ✅ User can read at their own pace
- ❌ Takes up layout space
- ❌ Some pages don't clear them on subsequent actions

---

## 4. Msg Overlap with Navbar — Detailed

| Scenario | Component | Z-index | Overlap? |
|---|---|---|---|
| Desktop navbar | `app-navbar` | `z-50` | No — Msg is `z-[60000]` |
| Mobile bottom tab bar | `app-navbar` mobile | `z-[1000]` | No — Msg is higher |
| Sticky header (edit page) | `editTopContent` | `z-20` | No — Msg is `z-[60000]` |
| Sticky search bar (orders/new) | `sticky top-0 z-40` | `z-40` | No — Msg is higher |
| Notification panel | `NotificationsPanel` | `z-[61]` | No — panel is below Msg |
| `ReportActionBar` (standaloneEdit) | `fixed z-[55]` | `z-[55]` | No — Msg is `z-[60000]` |

**Conclusion**: No z-index overlap issues. However, `top-5` means Msg overlays the top ~40px of page content below the navbar, which may cover the page title or first form elements on some pages.

---

## 5. Pages Needing Fix

### Priority: High

#### 1. `/store/report/[id]` — Validation errors use auto-dismiss toast
- **Issue**: `showErrorWithScroll` → `showMessage('error', ...)` → Msg auto-dismisses in 3000ms. Validation errors like "Tên cửa hàng không được để trống." disappear before user can read.
- **Fix**: Change validation errors to use persistent inline error `<div>` near the form (like `/store/create` does with `fieldErrors`), or set a very long duration (e.g. 10000ms) for validation errors.

#### 2. `/inventory/purchases/new` — No success feedback
- **Issue**: After successful submit → `router.push('/inventory/products')` with no flash/success message. User doesn't know if the purchase order was created.
- **Fix**: Add flash message before redirect, e.g. `sessionStorage.setItem('storevis:flash-message', ...)` then redirect.

#### 3. `/orders/new` — Error/Success inconsistency
- **Issue**: Success → Msg toast (auto-dismiss), Error → inline banner (persistent). Two different patterns on the same page.
- **Fix**: Standardize — either both to Msg toast, or both to inline boxes. Recommend both to inline banner since order form content is dense and toasts may go unnoticed.

#### 4. `/store/export` — No success feedback
- **Issue**: File download starts silently. No visual feedback that export began or completed. On slow networks, user may click Export multiple times.
- **Fix**: Show inline message "Đang xuất dữ liệu..." while exporting, then "Đã xuất X cửa hàng thành công!" after.

### Priority: Medium

#### 5. Msg duration is too short for error messages
- **Issue**: Create controller uses 2500ms, Edit/Report use 3000ms. Error messages like "Không kiểm tra được trùng tên (gần đây/toàn hệ thống). Vui lòng thử lại." need more time to read.
- **Fix**: Increase `showMessage('error', ...)` duration to 5000-8000ms. Use 3000ms for success, 5000ms+ for errors.

#### 6. `/store/create` and `/store/edit/[id]` — Success redirect destroys toast
- **Issue**: Success message is shown briefly in Msg, then `pushSearchWithNotice()` redirects immediately. User sees the toast only for a split second before navigation. The flash message on the destination page is what they actually see.
- **Fix**: This is actually fine as-is (flash message on search page works), but consider whether the Msg should even show for 2500ms if navigation happens immediately. Could skip the Msg and rely solely on flash.

### Priority: Low

#### 7. `/login` — Plain text error styling
- **Issue**: Uses unstyled `<p className="text-sm text-red-400">` instead of bordered inline box. Inconsistent with other pages.
- **Fix**: Wrap error in a styled `<div>` with border and background like other pages.

#### 8. `/orders/[id]` and `/inventory/purchases/[id]` — No success after cancel
- **Issue**: After successful cancel, data is reloaded but no confirmation message shown. User has to infer success from the updated status.
- **Fix**: Add inline success message "Đã hủy đơn hàng/phiếu nhập thành công." after successful cancel.

---

## 6. Summary Statistics

| Metric | Count |
|---|---|
| Total form pages audited | 14 |
| Pages using Msg component | 4 (28%) |
| Pages using inline boxes | 8 (57%) |
| Pages using plain text | 1 (7%) |
| Pages with no feedback | 1 (7%) |
| Pages with missing success msg | 3 (21%) |
| Pages with inconsistent error/success pattern | 1 (7%) |
