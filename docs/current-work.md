# Current Work

## Goal
- Fix mobile overflow trên màn `/account`: đảm bảo nội dung hiển thị full chiều ngang trên mobile.

## Task Type
bugfix

## Root Cause
- `html { font-size: 19px }` trên mobile → rem padding lớn hơn chuẩn (`p-5` = 23.75px, `px-4` = 19px).
- CSS Grid trên mobile không có `grid-template-columns` rõ ràng → grid items dùng `min-width: auto` mặc định → không shrink đúng khi nội dung gần sát mép.
- Trên màn 320px, text menu link dài ("Công việc hôm nay" ~177px) không vừa text area ~168px → overflow.

## In Scope
- `screens/auth/account-screen.jsx`: padding + grid classes.

## Changes
1. **CardContent padding**: `p-5` → `p-4 sm:p-5` (mobile: 19px thay vì 23.75px) — SidebarCard, MenuCard, info card.
2. **Link items**: `px-4` → `px-3 sm:px-4` (mobile: 14.25px thay vì 19px).
3. **Grid**: thêm `grid-cols-1` để mobile có `minmax(0, 1fr)` — grid items shrink đúng, không overflow.

## Verification
- `npm run lint` → ✔ No warnings or errors.
- `npm run build` → ✔ Build succeeds, /account page 5 kB.
- Playwright (viewport 375×812) → page loads, no overflow, scrollWidth ≤ clientWidth.

## Risks
- Text menu link sẽ wrap nếu quá dài trên màn rất nhỏ — đây là behavior an toàn.
