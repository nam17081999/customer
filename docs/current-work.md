# Task Request

## Goal
- Thêm phần màu xanh hiển thị hướng trong bản đồ dùng cho create/edit/supplement/report, giống hành vi ở màn `/map`.

## Task Type
- Feature

## Why
- Giúp người dùng dễ đối chiếu hướng thực tế khi chọn vị trí trong form.
- Đồng bộ trải nghiệm giữa `/map` và các map picker trong form.

## In Scope
- `LocationPicker` dùng chung cho create/edit/supplement/report edit.
- Hiển thị lớp hướng màu xanh theo `heading` hiện có.
- Giữ tương thích với `StoreLocationPicker` và các form đang dùng chung.
- Verify nhanh các flow liên quan bằng test/lint gần nhất.

## Out of Scope
- Không đổi logic route/navigation đầy đủ của `/map`.
- Không refactor lớn các component form.
- Không thay đổi business rule lưu vị trí.

## Must Preserve
- Marker/pin vị trí hiện tại vẫn hoạt động như cũ.
- Nearby stores layer vẫn hiển thị như hiện tại.
- Nếu không có `heading`, map vẫn dùng bình thường và không lỗi.
- Các flow create/edit/supplement/report không đổi submit/validation.

## Inputs / Repro / Expected
- Input: mở bản đồ trong create/edit/supplement/report khi đã có `heading`.
- Expected: trên map có thêm phần màu xanh hiển thị hướng, tương tự `/map`.

## Constraints
- Ưu tiên tái sử dụng asset/helper đang có từ `/map`.
- Sửa tối thiểu trong component map dùng chung.

## Required Verification
- `npm.cmd run test:e2e -- e2e/store-edit.spec.js`
- `npm.cmd run lint`
- Đối chiếu checklist: `Map / Geolocation`, `Store Edit Flow`, `Tiếng Việt / UI Safety`.

## Definition of Done
- Map picker trong create/edit/supplement/report có phần hướng màu xanh khi có `heading`.
- Không làm hỏng marker vị trí, overlay, hay interaction hiện có.
- Có bằng chứng verify mới.

## Plan
- Đọc logic hướng đang dùng ở `/map`.
- Tái dùng vào `LocationPicker` chung.
- Soát các màn form đang dùng component này.
- Chạy verify gần nhất và cập nhật kết quả.

## Done
- Tái sử dụng asset `createUserHeadingFanImage()` từ `/map` để hiển thị lớp hướng màu xanh trong `LocationPicker` dùng chung.
- Thêm source/layer riêng cho heading fan và đồng bộ vị trí + heading theo tâm pin/map hiện tại.
- Giữ tương thích cho các flow create/edit/supplement/report vì tất cả đang dùng chung `LocationPicker` qua `StoreLocationPicker`.

## Verification
- `npm.cmd run lint` passed.
- `npm.cmd run test:e2e -- e2e/store-edit.spec.js` passed: 5/5 tests.
- Đối chiếu checklist trong phạm vi liên quan: `Map / Geolocation`, `Store Edit Flow`, `Tiếng Việt / UI Safety`.

## Risks / Next
- Chưa có e2e riêng để assert trực tiếp layer hướng màu xanh; hiện mới verify bằng lint + các flow form còn hoạt động bình thường.
- Nếu muốn, bước tiếp theo có thể thêm e2e visual/assert nhẹ cho trạng thái có `heading` ở map picker test double hoặc browser thật.
