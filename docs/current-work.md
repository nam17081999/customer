# Current Work

## Goal
Thiết kế lại UI/UX lớp giao diện cho các màn vận hành bán hàng/phân phối theo hướng SaaS hiện đại, mobile-first, tối ưu thao tác nhanh, không đổi business logic/API/schema/data flow.

## Task Type
refactor

## In Scope
- Presentation layer: layout, màu sắc, responsive, hierarchy, spacing, typography, table/card/form affordance.
- Reusable UI shell/components cho dashboard, đơn hàng, tồn kho, sản phẩm, báo cáo vận hành.
- Dark/light theme hiện có, focus states, loading/empty/error visual states ở mức UI.
- Giữ nguyên hàm load dữ liệu, handler, API client, field names, route contracts.

## Out of Scope
- Không đổi business logic, DB schema, Supabase queries/contracts, cache rules, auth rules.
- Không thêm dependency mới nếu không bắt buộc.
- Không redesign map/create/edit store flow ngoài scope vận hành bán hàng hiện tại.
- Không thay đổi logic tính tồn kho, doanh thu, lãi/lỗ, công nợ.

## Must Preserve
- Pages Router và import alias `@/`.
- Store reads qua `getOrRefreshStores()` khi đọc stores.
- Existing order/inventory/report flows, form state, submit handlers, validation order.
- Vietnamese UTF-8 text, contrast cao, touch target lớn.
- Existing tests/API contracts.

## Plan
1. Audit UI routes/components đang dùng.
2. Thêm/chuẩn hóa design-system primitives an toàn.
3. Refactor navigation/shell cho vận hành.
4. Nâng cấp dashboard/order/inventory/customer-facing layouts UI-only.
5. Verify lint/tests liên quan và checklist regression.

## Required Verification
- `npm run lint`.
- Focused tests cho operator/order/inventory/theme nếu phù hợp.
- Manual code review checklist: no API/schema/business logic changes, responsive classes, dark/light contrast, keyboard/focus states.

## Done
Pending.

## Verification
Pending.

## Risks / Next
Task rất rộng; ưu tiên nền design system và các route vận hành chính trước, tránh rewrite logic sâu.
