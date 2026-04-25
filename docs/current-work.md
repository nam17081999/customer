# Current Work

## Goal
- Sửa sai lệch vị trí marker cửa hàng trên màn `/map` khi zoom out để marker bám tọa độ ổn định và chính xác nhất có thể ở mọi mức zoom.

## Task Type
- Bug Fix

## Why
- Hiện tại khi zoom lớn thì marker nhìn đúng, nhưng khi zoom nhỏ marker bị lệch nhẹ xuống dưới so với vị trí thực tế.
- Đây là lỗi hiển thị bản đồ, làm giảm độ tin cậy của tọa độ và trải nghiệm định vị.

## In Scope
- `docs/current-work.md`
- `pages/map.js`
- `helper/mapMarkerImages.js`
- Có thể thêm/cập nhật test gần vùng map marker nếu repo đã có chỗ phù hợp.

## Out of Scope
- Không đổi flow tìm kiếm, route, geolocation, cache, hay dữ liệu store.
- Không redesign UI marker ngoài phần cần thiết để sửa lệch tọa độ.
- Không mở rộng sang `components/map/location-picker.jsx` nếu không chứng minh được cùng root cause trong task này.

## Must Preserve
- `/map` vẫn nhận đúng query `storeId`, `lat`, `lng`.
- Validate tọa độ và logic tự sửa lat/lng đảo chiều vẫn giữ nguyên.
- Chỉ store có tọa độ hợp lệ mới được render marker.
- UI marker hiện tại vẫn giữ phong cách icon + label, highlight và route order.
- Không làm hỏng blue dot, route line, popup hover, click mở chi tiết.

## Inputs / Repro / Expected
- Repro: vào màn `/map`, quan sát marker cửa hàng khi zoom tối đa thì đúng; khi zoom nhỏ dần thì marker nhìn trôi nhẹ xuống dưới vị trí thật.
- Current: marker không bám cùng một anchor hình học theo các mức zoom.
- Expected: marker giữ đúng điểm neo với tọa độ ở mọi mức zoom, sai lệch thị giác tối thiểu và nhất quán.

## Constraints
- Giữ cấu trúc hiện tại, sửa tối thiểu và đúng root cause.
- Ưu tiên sửa ở lớp render marker/image thay vì vá bằng offset cảm tính theo zoom.

## Required Verification
- Chạy `npm.cmd run lint -- pages/map.js helper/mapMarkerImages.js`.
- Tự rà logic theo checklist: `Map Flow`, `Tiếng Việt / UI Safety`.
- Nếu có test phù hợp, chạy focused check liên quan map marker.
- Smoke review code để xác nhận anchor marker không còn phụ thuộc sai vào kích thước label khi zoom.

## Definition of Done
- Root cause được xác định rõ.
- Marker store trên `/map` dùng điểm neo đúng về hình học, không còn lệch xuống do cách dựng ảnh/layer.
- Các hành vi map liên quan vẫn giữ nguyên.

## Plan
- Xác nhận root cause trong layer marker và ảnh marker.
- Chỉnh cách dựng ảnh/anchor để marker bám đúng tọa độ.
- Rà lại side effects cho hover, click, route order, highlight.
- Chạy lint và ghi kết quả vào current-work.

## Done
- Xác định root cause ở `pages/map.js`: layer `store-marker` đang dùng `icon-anchor: 'top'` cho một image marker có label nằm bên dưới icon.
- Xác định root cause ở `helper/mapMarkerImages.js`: canvas marker không cân đối phần trên/dưới quanh tâm icon, nên điểm neo của cả image không trùng tâm hình học của icon.
- Đã thêm `topPadding` cân đối canvas để tâm image trùng tâm icon.
- Đã đổi `store-marker` sang `icon-anchor: 'center'` để marker bám đúng tọa độ, không phụ thuộc chiều cao label khi zoom.

## Verification
- `npm.cmd run lint -- pages/map.js helper/mapMarkerImages.js` passed.
- Đã đối chiếu checklist: `Map Flow`, `Tiếng Việt / UI Safety`.
- Đã smoke review logic: query `/map`, validate tọa độ, sửa lat/lng đảo chiều, hover popup, click marker, route order/highlight không bị đổi logic.

## Risks / Next
- Chưa có visual/e2e test tự động để đo sai lệch marker theo zoom; phần verify hiện là code-level + lint.
- `components/map/location-picker.jsx` cũng đang có `icon-anchor: 'top'`, nhưng chưa sửa trong task này vì chưa xác nhận cùng kiểu marker/image và chưa có bug report ở flow đó.