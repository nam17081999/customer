# Current Work

## Goal
- Rà hiệu năng việc vẽ cửa hàng lân cận trong map picker của create/edit/supplement/report và tối ưu phần chọn/render marker mà không đổi logic nghiệp vụ.

## Task Type
- Refactor With Tests First

## Why
- Map picker đang tính khoảng cách toàn bộ store rồi sort toàn bộ danh sách mỗi lần map `moveend`.
- Tài liệu yêu cầu tối đa 50 cửa hàng gần nhất, nhưng code hiện đang giới hạn 30.
- Cần trả lời rõ việc vẽ full có tốt hơn không và áp dụng tối ưu ít rủi ro nếu có.

## In Scope
- `components/map/location-picker.jsx`
- Helper/test thuần nếu cần để khóa logic chọn 50 store gần nhất.
- Không chạm create/edit/supplement/report submit/validation/cache.

## Out of Scope
- Không đổi UI marker.
- Không đổi dữ liệu đọc stores; vẫn qua `getOrRefreshStores()`.
- Không thêm dependency hoặc spatial index lớn.
- Không đổi `/map` public.

## Must Preserve
- Map picker vẫn hiển thị store lân cận quanh tâm pin/map.
- Chỉ store có tọa độ hợp lệ mới được đưa vào layer.
- Giới hạn tối đa 50 cửa hàng gần nhất.
- Marker style và nhãn vẫn như hiện tại.
- Không ảnh hưởng create/edit/supplement/report logic.

## Inputs / Repro / Expected
- User hỏi: vẽ 50 cửa hàng gần nhất có vấn đề hiệu năng không, move vị trí có phải vẽ lại gây chậm không, vẽ full có tốt hơn không, tối ưu gì được.
- Expected: giải thích được tradeoff và áp dụng tối ưu an toàn nếu có.

## Constraints
- Sửa nhỏ, test được phần lựa chọn nearest.
- Giữ UTF-8.

## Required Verification
- `npm run lint`
- `npm run test`
- E2E map picker create/edit/report nếu thay đổi render path.
- Checklist: `Map Flow`, `Create Flow`, `Edit / Supplement / Report`, `Stores Read / Cache`.

## Definition of Done
- Có câu trả lời rõ về 50 nearest vs full render.
- Code chọn 50 nearest nhất quán docs và giảm allocation/sort không cần thiết.
- Verification pass.

## Plan
- Tách logic chọn store gần nhất thành helper thuần có test.
- Đổi limit về 50 theo docs.
- Dùng helper trong `LocationPicker` và tránh `setData` nếu danh sách marker không đổi.
- Chạy lint/test/e2e liên quan và cập nhật kết quả.

## Done
- Đã kiểm tra `LocationPicker`: mỗi lần `moveend` đang tính khoảng cách toàn bộ stores, sort toàn bộ rồi slice. Việc này không vẽ lại liên tục theo từng pixel kéo vì đang chạy ở `moveend`, nhưng vẫn tạo allocation/sort không cần thiết khi data lớn.
- Đã xác định vẽ full không tốt hơn cho form picker: full render làm rối màn chọn vị trí, tăng số marker/image MapLibre phải quản lý, và trái rule docs chỉ hiển thị tối đa 50 store gần nhất.
- Đã tách helper `selectNearestStores()` để chọn N store gần nhất mà không map/sort toàn bộ danh sách store; chỉ giữ tập ứng viên tối đa theo limit.
- Đã đổi limit shared của form picker về đúng **50** theo docs.
- Đã thêm `buildNearbyStoresSignature()` và dùng trong `LocationPicker` để bỏ qua `source.setData()` khi top 50 marker không đổi, giảm redraw khi người dùng kéo/zoom nhẹ.
- Giữ nguyên `getOrRefreshStores()`, tọa độ hợp lệ, marker style, map picker create/edit/supplement/report và các logic submit/validate/cache.

## Verification
- `npm run test -- __tests__/helper/nearbyStores.test.js` ✅
- `npm run lint` ✅
- `npm run test` ✅ (30 test files, 364 tests pass)
- `npx playwright test e2e/store-create.spec.js -g "quay lại bước 2|tạo cửa hàng đầy đủ"` ✅
- `npx playwright test e2e/store-report.spec.js -g "user gửi edit report"` ✅
- `npm run text:check` ✅
- `git diff --check` ✅
- Checklist:
  - `Map Flow`: map picker vẫn chọn/render store lân cận, limit 50, marker style/path cũ.
  - `Create Flow`: happy path và back/next map picker pass e2e.
  - `Edit / Supplement / Report`: report edit map picker pass e2e; edit/supplement logic không đổi trong task này.
  - `Stores Read / Cache`: vẫn đọc public stores qua `getOrRefreshStores()`.

## Risks / Next
- Chưa benchmark số lượng lớn bằng dữ liệu production thật. Tối ưu hiện tại giảm allocation/sort/redraw ở client nhưng vẫn phải tính khoảng cách qua các store có tọa độ để biết top 50 chính xác.
