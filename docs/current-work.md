# Current Work

## Goal
- Thêm quận `Cầu Giấy` vào danh sách địa chỉ, gồm danh sách phường và dữ liệu tọa độ/boundary liên quan để chọn địa chỉ và tự nhận diện quận/phường từ tọa độ.

## Task Type
- Feature

## Why
- User cần mở rộng phạm vi địa lý sang Cầu Giấy.
- Repo hiện dùng `DISTRICT_WARD_SUGGESTIONS` cho dropdown/search/filter và `OLD_ADMIN_AREA_BOUNDARIES` cho reverse lookup tọa độ theo mô hình quận/phường cũ.

## In Scope
- `lib/constants.js`
- `data/oldAdminAreaBoundaries.js`
- Test helper liên quan đến area resolver/constants nếu cần.
- Verify dropdown/filter/reverse lookup data path ở mức unit.

## Out of Scope
- Không đổi business flow create/edit/report/map.
- Không đổi mô hình địa chỉ sang hệ thống hành chính mới sau 2025.
- Không sửa dữ liệu store hiện có.
- Không đổi thuật toán search/filter/cache.

## Must Preserve
- `DISTRICT_SUGGESTIONS` vẫn sinh từ `DISTRICT_WARD_SUGGESTIONS`.
- Các quận/phường hiện có giữ nguyên.
- Reverse lookup tọa độ vẫn validate lat/lng và không trả sai khi không match boundary.
- UTF-8 tiếng Việt phải sạch.
- Không đè các thay đổi đang có trong working tree.

## Inputs / Repro / Expected
- Input: Cầu Giấy theo mô hình cũ gồm 8 phường: `Dịch Vọng`, `Dịch Vọng Hậu`, `Mai Dịch`, `Nghĩa Đô`, `Nghĩa Tân`, `Quan Hoa`, `Trung Hòa`, `Yên Hòa`.
- Expected:
  - Dropdown quận có `Cầu Giấy`.
  - Chọn `Cầu Giấy` hiện đúng các phường trên.
  - Reverse lookup tọa độ mẫu trong Cầu Giấy trả đúng quận/phường tương ứng.

## Constraints
- Dữ liệu địa giới hiện tại trong app là `oldAdminAreaBoundaries`; nếu thêm boundary polygon quá lớn/rủi ro, ưu tiên dữ liệu bounds/geometry đơn giản đủ cho reverse lookup theo điểm trung tâm đã kiểm.
- Không thêm dependency.

## Required Verification
- `npm run lint`
- `npm run test -- __tests__/helper/storeAreaResolver.test.js`
- `npm run text:check`
- `git diff --check`
- Checklist: `Map Flow`, `Search Flow`, `Create Flow`, `Edit / Supplement / Report`, `Tiếng Việt / UI Safety`.

## Definition of Done
- `Cầu Giấy` có trong constants.
- Các phường Cầu Giấy có trong gợi ý.
- Tọa độ mẫu của từng phường Cầu Giấy resolve được đúng quận/phường.
- Verification pass hoặc rủi ro được ghi rõ.

## Plan
- Xác minh danh sách phường Cầu Giấy theo mô hình cũ.
- Thêm `Cầu Giấy` vào `DISTRICT_WARD_SUGGESTIONS`.
- Bổ sung dữ liệu tọa độ/boundary Cầu Giấy vào data resolver.
- Thêm/cập nhật unit test cho constants và reverse lookup Cầu Giấy.
- Chạy lint/test/text/diff checks.

## Done
- Chưa thực hiện.

## Verification
- Chưa chạy.

## Risks / Next
- Chưa có.
