# Task Request

## Goal
- Thêm bản đồ thu nhỏ vào modal chi tiết cửa hàng, nằm dưới phần chi tiết và trên phần thao tác.

## Task Type
- Feature

## Why
- Giúp xem nhanh vị trí cửa hàng đang mở và các cửa hàng lân cận ngay trong modal mà không cần chuyển sang trang bản đồ.

## In Scope
- Thêm 1 khối bản đồ vuông trong `StoreDetailModal`.
- Highlight cửa hàng đang xem.
- Hiển thị các cửa hàng xung quanh trên cùng bản đồ.
- Tái sử dụng dữ liệu cửa hàng qua `getOrRefreshStores()` và giữ pattern map hiện có.

## Out of Scope
- Không đổi layout tổng thể của modal ngoài việc chèn thêm khối map đúng vị trí yêu cầu.
- Không thay đổi logic trang `/map`, search, route planning, report, verify.
- Không thêm dependency mới.

## Must Preserve
- Modal detail hiện tại vẫn mở/đóng, scroll, action button như cũ.
- Nút `Bản đồ` hiện có vẫn hoạt động và vẫn dẫn sang `/map?storeId=...&lat=...&lng=...`.
- Chỉ đọc danh sách cửa hàng qua cache `getOrRefreshStores()`.
- Chỉ hiển thị map khi cửa hàng có tọa độ hợp lệ.

## Inputs / Repro / Expected
- Input: mở modal chi tiết của một cửa hàng có tọa độ.
- Expected: dưới phần thông tin chi tiết có 1 ô vuông hiển thị map, cửa hàng hiện tại được highlight rõ, và vẫn thấy các cửa hàng lân cận.

## Constraints
- Sửa tối thiểu, ưu tiên tách component nhỏ tái sử dụng.
- Giữ UI dark theme, tương phản tốt, không làm modal nặng bất thường.

## Required Verification
- `npm.cmd run lint`
- Smoke review code cho `StoreDetailModal` và component map mới.
- Đối chiếu checklist: `Store Detail / Actions`, `Map / Geolocation`, `Search Flow`, `Tiếng Việt / UI Safety`.

## Definition of Done
- Modal detail có mini map đúng vị trí yêu cầu.
- Cửa hàng hiện tại được highlight, các cửa hàng xung quanh vẫn hiển thị.
- Nút và flow cũ không bị ảnh hưởng.
- Có bằng chứng verify mới.

## Plan
- Tạo component mini map cho modal detail.
- Nạp stores từ cache và render marker xung quanh.
- Chèn map vào modal giữa chi tiết và thao tác.
- Chạy lint, rà checklist, cập nhật kết quả.

## Done
- Thêm component mini map mới tại modal detail để hiển thị 1 ô vuông bản đồ ngay dưới phần thông tin và trên phần thao tác.
- Dùng `getOrRefreshStores()` lấy danh sách cửa hàng từ cache, lọc cửa hàng có tọa độ hợp lệ và lấy nhóm gần cửa hàng đang xem.
- Highlight cửa hàng hiện tại và các cửa hàng xung quanh bằng cùng kiểu marker image/label như màn `/map`, vẫn có tooltip tên khi hover.
- Giữ nguyên nút `Bản đồ` cũ để chuyển sang trang `/map` đầy đủ khi cần.

## Verification
- `npm.cmd run lint` passed.
- Smoke review code: modal chỉ chèn thêm mini map, không đổi logic đóng/mở modal hay các action cũ; marker mini map đã đồng bộ với `/map`.
- Đối chiếu checklist trong phạm vi liên quan: `Store Detail / Actions`, `Map Flow`, `Search Flow`, `Tiếng Việt / UI Safety`.
- Xác nhận map chỉ render khi store có tọa độ hợp lệ và dữ liệu stores vẫn đi qua `getOrRefreshStores()`.

## Risks / Next
- Chưa mở browser để canh cảm giác zoom thực tế; nếu muốn thấy rộng hơn hoặc hẹp hơn khu vực lân cận có thể chỉnh nhanh `DEFAULT_ZOOM` trong component mini map.
- Tooltip hover cho cửa hàng lân cận đã có, nhưng chưa thêm click action trong mini map vì hiện chưa được yêu cầu.