# Task Request

## Goal
- Sửa sạch lỗi tiếng Việt/mã hóa trong các file changed hiện tại, đồng thời giữ nguyên logic boundary lookup mới.

## Task Type
- Bug Fix

## Why
- User phát hiện các file changed còn lỗi tiếng Việt (mojibake / ký tự vỡ dấu).
- Các file đã đi qua nhiều phase thử nghiệm nên có một số chuỗi bị hỏng encoding, đặc biệt ở create controller.

## In Scope
- `helper/useStoreCreateController.js`
- các file changed còn lại liên quan đến phase boundary lookup
- `docs/current-work.md`

## Out of Scope
- Không đổi business logic boundary lookup vừa hoàn thành.
- Không refactor thêm ngoài phạm vi fix text/mã hóa.

## Must Preserve
- Logic `point-in-polygon` từ boundary local vẫn hoạt động.
- Test hiện có vẫn pass.
- Không còn chuỗi tiếng Việt bị lỗi trong các file changed.

## Required Verification
- `node scripts/check-mojibake.js --files ...`
- `.\node_modules\.bin\vitest.cmd run __tests__/helper/storeAreaResolver.test.js __tests__/pages/api/reverse-geocode-area.test.js`
- `npm.cmd run lint`

## Done
- Sửa toàn bộ chuỗi tiếng Việt bị mojibake trong `helper/useStoreCreateController.js`.
- Rà lại toàn bộ các file changed bằng `scripts/check-mojibake.js`.
- Dọn 2 file data tạm không còn dùng từ phase cũ:
  - `data/gadm41_VNM_3.json`
  - `data/oldAdminAreaSeeds.js`
- Giữ nguyên logic boundary lookup mới.

## Verification
- `node scripts/check-mojibake.js --files ...` passed, không còn phát hiện lỗi mã hóa trong các file changed.
- `.\node_modules\.bin\vitest.cmd run __tests__/helper/storeAreaResolver.test.js __tests__/pages/api/reverse-geocode-area.test.js` passed (`19/19`).
- `npm.cmd run lint` passed.

## Risks / Next
- Không còn lỗi mã hóa trong các file changed đã rà.
- Nếu muốn sạch hẳn phase cũ, bước tiếp theo có thể dọn tiếp các file thử nghiệm không còn dùng như route reverse geocode cũ.
