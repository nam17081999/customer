# Current Work

## Goal
Thiết kế lại toàn bộ giao diện (UI/UX) của dự án theo hướng workbench hiện đại, phù hợp mobile/tablet/desktop, có cả light và dark theme, tối ưu cho người dùng cơ bản, telesale và admin nhưng vẫn giữ nguyên business logic và dữ liệu.

## Task Type
refactor with tests first

## In Scope
- Làm mới app shell: navbar, bottom nav, page frame, light/dark theme consistency.
- Thiết kế lại các màn trọng yếu trước: Search home, Today, Overview, Login, Orders, Inventory, Account.
- Chuẩn hóa các block UI dùng chung để làm nền cho các màn sau.

## Out of Scope
- Không đổi route, API, DB schema, validation, cache, hay business rule.
- Không làm lại toàn bộ màn admin ít dùng trong phase này nếu chưa cần.

## Must Preserve
- Giữ nguyên các luồng: tìm cửa hàng, thêm cửa hàng, lên đơn, telesale, admin thao tác kho/lãi.
- Giữ nguyên theme toggle, auth gating, cache/sync event, và copy tiếng Việt hiện có.

## Required Verification
- Chạy lint.
- Smoke test giao diện ở mobile/tablet/desktop cho các màn đã chạm.
- Kiểm tra light/dark theme trên shell và các trang đã sửa.

## Plan (high level)
1. Audit current shell and core pages.
2. Redesign shared app frame + navigation.
3. Restyle high-traffic pages with unified cards, tables, and CTAs.
4. Verify responsive, light/dark, and accessibility behavior.

## Definition of Done
- Shell và các màn trọng yếu đã có diện mạo mới nhất quán.
- Không làm hỏng business flow hoặc auth/cache/map/search.

## Output Contract
- Goal
- What changed
- Files touched (linkable)
- Verification done
- Risks / unverified parts

## Progress / Done
- Audit: completed.

## Done
- App shell and navigation refreshed for light/dark themes.
- Login, account, today, overview, home search, orders, and inventory list surfaces restyled into a unified workbench language.
- Shared v2 primitives updated to match the new visual system.

## Verification
- `npm run lint`
- Code review of touched page shells and shared UI primitives.

## Risks / Next
- Risk: chưa chạy browser smoke nên cần mở app thật để kiểm tra spacing, overflow, print view, và theme toggle ở mobile/tablet/desktop.
- Next: nếu bạn muốn, mình có thể tiếp tục chốt các màn còn lại như store detail, verify/reports, telesale, map theo cùng ngôn ngữ mới.
