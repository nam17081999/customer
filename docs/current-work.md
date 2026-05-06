# Task Request

## Goal
- Khi bấm `Thêm vị trí` ở màn bổ sung và màn sửa, logic phải hoạt động tương tự khi tới bước 3 của màn tạo cửa hàng; đồng thời kiểm tra đầy đủ bằng toàn bộ test suite và lint của repo.

## Task Type
- Feature

## Why
- User muốn trải nghiệm `Thêm vị trí` ở sửa/bổ sung nhất quán với create step 3.
- User cũng muốn xác nhận toàn diện để giảm rủi ro regression.

## In Scope
- `helper/useStoreCreateController.js`
- `helper/useStoreEditController.js`
- `components/store/store-supplement-form.jsx`
- `pages/store/edit/[id].js`
- `helper/storeLocationStep.js`
- `__tests__/helper/storeLocationStep.test.js`
- `docs/current-work.md`

## Out of Scope
- Không đổi logic report.
- Không đổi flow create ngoài việc dùng làm chuẩn tham chiếu.
- Không chạy e2e nếu không có yêu cầu riêng.

## Must Preserve
- Create step 3 tiếp tục hoạt động như hiện tại.
- Edit/supplement chỉ khởi tạo logic vị trí khi user bấm `Thêm vị trí` nếu trước đó chưa có tọa độ.
- Các logic GPS, maps link, khóa/mở khóa, submit, validation và cache vẫn giữ nguyên hành vi hiện có.

## Required Verification
- `npm test`
- `npm run lint`
- Rà checklist liên quan: `Edit / Supplement / Report`, `Create Flow`, `Map Flow`, `Tiếng Việt / UI Safety`.

## Done
- Trích phần reset state vị trí dùng chung thành helper riêng.
- Đồng bộ flow `Thêm vị trí` ở sửa/bổ sung với bootstrap của create step 3.
- Thêm test cho helper reset state/tọa độ.
- Chạy toàn bộ unit test suite và lint toàn repo.

## Verification
- `npm test` passed: `24` test files, `286` tests.
- `npm run lint` passed.
- Đối chiếu checklist liên quan: `Edit / Supplement / Report`, `Create Flow`, `Map Flow`, `Tiếng Việt / UI Safety`.

## Risks / Next
- Chưa chạy `playwright` e2e, nên phần xác nhận trực quan trên UI mobile/desktop vẫn là bước tiếp theo nếu muốn kiểm tra mức cao hơn.
