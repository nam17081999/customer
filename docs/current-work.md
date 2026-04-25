# Current Work

## Goal
- Bổ sung test đầy đủ hơn cho phần report, bao phủ các hành vi mới đã chốt gần đây.

## Task Type
- Feature

## Why
- Flow report đã thay đổi nhiều: route riêng cho edit, quay lại về màn report, reason-only submit quay về tìm kiếm, dùng flash message/Msg, và đổi thứ tự lý do báo cáo.
- Cần khóa các hành vi này bằng test để tránh regression.

## In Scope
- `docs/current-work.md`
- `e2e/store-report.spec.js`
- Có thể chỉnh helper/setup test trong cùng file nếu cần.

## Out of Scope
- Không đổi logic sản phẩm nếu test không phát hiện bug mới.
- Không thêm framework test mới.
- Không mở rộng sang test create/edit/supplement ngoài phạm vi report.

## Must Preserve
- Các test report hiện có vẫn pass.
- Tên tiếng Việt trong UI và assertion phải khớp hành vi thật.
- Không làm thay đổi logic app chỉ để tiện test, trừ khi phát hiện bug thực sự.

## Required Verification
- Chạy lint cho file test đổi.
- Chạy `npm run text:check`.
- Chạy toàn bộ `e2e/store-report.spec.js`.
- Đối chiếu checklist: `Edit / Supplement / Report`, `Tiếng Việt / UI Safety`.

## Plan
- Rà coverage report hiện có và chốt gap.
- Thêm test cho redirect reason-only, back button report edit, và thứ tự/lý do báo cáo.
- Chạy lint, text check, và full report e2e.
- Ghi kết quả vào current-work.

## Progress
- Đã rà các test hiện có và xác định 3 gap chính cần bổ sung.
- Đã cập nhật test `reason-only` theo hành vi mới và thêm coverage cho UI/điều hướng gần đây.

## Done
- `e2e/store-report.spec.js`: cập nhật test `reason-only` để assert redirect về tìm kiếm + flash message.
- `e2e/store-report.spec.js`: thêm test xác nhận thứ tự lý do báo cáo mới là `Sai tên`, `Sai địa chỉ`, `Sai số điện thoại`, `Sai vị trí`.
- `e2e/store-report.spec.js`: thêm test nút `Quay lại` trong màn `report edit` standalone quay về đúng màn report chi tiết.
- Toàn bộ `store-report.spec.js` hiện bao phủ 10 case report chính và đều pass.

## Verification
- `npm.cmd run lint -- e2e/store-report.spec.js` passed.
- `npm.cmd run text:check` passed.
- `npx.cmd playwright test e2e/store-report.spec.js` passed: 10 tests.
- Checklist đã đối chiếu: `Edit / Supplement / Report`, `Tiếng Việt / UI Safety`.

## Open Questions
- Không có blocker.

## Risks / Next
- Bộ test hiện tập trung vào report user/admin flow chính; chưa có visual assertion riêng cho animation `Msg`.
- Nếu cần mở rộng tiếp, bước sau hợp lý là thêm test cho mobile viewport của report edit để khóa UX sticky action bar.
