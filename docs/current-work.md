# Current Work

## Goal
- Áp dụng các chỉnh sửa theo review thread PR #70: khôi phục map picker ở report edit step 3, xử lý các lỗi lint (unused import/duplicate reset), đồng bộ dark-mode placeholder và dọn indentation JSX.

## Task Type
- Bug Fix

## Why
- Review thread nêu các lỗi có thể làm fail lint và regression UX ở flow location/map/report.
- Cần chốt bản sửa nhỏ, đúng phạm vi các comment đã được yêu cầu.

## In Scope
- `components/store-report-form.jsx`
- `pages/map.js`
- `helper/mapDerivedData.js`
- `helper/useStoreEditController.js`
- `helper/useStoreCreateController.js`
- `pages/store/create.js`
- `components/store/store-supplement-form.jsx`
- `lib/storeCache.js`
- `docs/current-work.md`

## Out of Scope
- Không đổi business rule ngoài các điểm đã bị review.
- Không thêm dependency mới.
- Không refactor lớn ngoài phần cần để giải quyết comment.

## Must Preserve
- Flow create/edit/supplement/report hiện tại và rule dữ liệu location.
- Quy tắc dark-mode only trong design system.
- Hành vi map derived data và duplicate check nhất quán với rule hiện có.

## Inputs / Repro / Expected
- Input: comment mới yêu cầu áp dụng toàn bộ chỉnh sửa trong review thread đã link.
- Current: còn các lỗi map render step 3 report edit, lint unused import, placeholder light-mode, indentation lệch, duplicated reset lines.
- Expected: tất cả điểm review được xử lý đầy đủ, lint/test pass (trừ lỗi môi trường build ngoài scope nếu còn).

## Constraints
- Thay đổi nhỏ nhất có thể.
- Giữ UTF-8 cho file tiếng Việt.

## Required Verification
- `npm run lint`
- `npm run test`
- Đối chiếu checklist: `Edit / Supplement / Report`, `Map Flow`, `Create Flow`, `Tiếng Việt / UI Safety`, `Stores Read / Cache`.

## Definition of Done
- Tất cả điểm actionable trong review thread đã được sửa.
- Không còn lint error từ các điểm được nêu.
- `docs/current-work.md` có `Done`, `Verification`, `Risks / Next`.

## Plan
- Sửa code đúng từng comment review theo phạm vi file.
- Chạy lại lint + test và smoke build nếu môi trường cho phép.
- Cập nhật `docs/current-work.md` và báo cáo tiến độ.

## Done
- Khôi phục map block cho step 3 của `StoreReportForm` (mode edit) với `StoreLocationPicker` + placeholder, đảm bảo còn dùng được `heading`/`compassError` và không còn import thừa.
- Xóa các import không dùng ở `pages/map.js`, `helper/useStoreCreateController.js`, `helper/useStoreEditController.js`.
- Đồng bộ nguồn `IGNORED_NAME_TERMS` sang helper dùng chung `helper/ignoredNameTerms.js`, để `duplicateCheck` và `mapDerivedData` không drift danh sách.
- Đổi placeholder chưa có tọa độ ở create/supplement sang dark palette (`bg-gray-950`, `border-gray-800`, `text-gray-300/400`).
- Sửa indentation các block JSX bị lệch ở create/supplement.
- Xóa các dòng reset `lastFreshValidationAt = 0` bị lặp trong `lib/storeCache.js`.

## Verification
- `npm run lint` ✅
- `npm run test` ✅ (29 test files, 358 tests pass)
- `npm run build` ⚠️ fail do môi trường không truy cập được `fonts.googleapis.com` (lỗi mạng ngoài scope code change)
- Đối chiếu checklist đã chạm:
  - `Edit / Supplement / Report`
  - `Map Flow`
  - `Create Flow`
  - `Tiếng Việt / UI Safety`
  - `Stores Read / Cache`

## Risks / Next
- Chưa có screenshot live đầy đủ cho flow `supplement` vì môi trường local thiếu backend thật; cần QA UI thủ công thêm trên PR preview.
- Build production vẫn phụ thuộc mạng fetch Google Fonts trong môi trường sandbox hiện tại.
