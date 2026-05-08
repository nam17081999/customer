# Task Request

## Goal
- Đồng nhất modal `Xác nhận cập nhật cửa hàng` ở màn chi tiết báo cáo với các modal xác nhận chuẩn khác trong app.

## Task Type
- Bug Fix

## Why
- Modal xác nhận ở `pages/store/reports/[id].js` đang có style/structure khác pattern chung, gây lệch UI và trải nghiệm không nhất quán.

## In Scope
- `pages/store/reports/[id].js`
- `components/ui/confirm-dialog.jsx` nếu cần dùng lại API hiện có
- `docs/current-work.md`

## Out of Scope
- Không redesign toàn bộ hệ thống dialog.
- Không đổi business logic approve/reject report.
- Không chỉnh các modal khác ngoài phạm vi cần để đồng nhất pattern.

## Must Preserve
- Hành vi xác nhận approve report giữ nguyên.
- Wording nghiệp vụ hiện có giữ nguyên nếu không cần đổi.
- Dùng pattern modal xác nhận chung của app khi phù hợp.

## Inputs / Repro / Expected
- Repro:
  1. Vào màn chi tiết báo cáo cửa hàng.
  2. Bấm duyệt/cập nhật.
  3. Mở modal `Xác nhận cập nhật cửa hàng`.
- Current:
  - Modal này khác style/spacing/layout so với các modal xác nhận khác.
- Expected:
  - Modal dùng cùng pattern với `ConfirmDialog` và nhìn đồng nhất với create/edit/delete flows.

## Constraints
- Không thêm dependency mới.
- Ưu tiên thay đổi tối thiểu, tận dụng component chung.

## Required Verification
- So khớp với pattern `components/ui/confirm-dialog.jsx`.
- Kiểm tra lại file report detail sau khi thay đổi.
- Chạy `npm run lint` nếu thay đổi logic/component đủ nhỏ để verify nhanh.

## Definition of Done
- Modal xác nhận ở report detail dùng cùng pattern/modal shell với các confirm modal khác.
- Không đổi behavior approve report.

## Done
- Đã chuyển modal xác nhận ở trang chi tiết báo cáo sang dùng `ConfirmDialog` chung để đồng nhất style/spacing/actions với các flow create/edit/delete.

## Verification
- So khớp pattern với `components/ui/confirm-dialog.jsx`.
- `npx eslint 'pages/store/reports/[id].js'` passed.

## Risks / Next
- Chưa chạy smoke test trên browser trong phiên này, nhưng thay đổi chỉ đổi shell modal, không đổi logic approve.
