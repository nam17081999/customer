# Current Work

## Mục đích

File này là bộ nhớ làm việc ngắn hạn cho người và AI.

Chỉ ghi những gì cần để tiếp tục công việc an toàn ở phiên sau:
- đang làm gì
- được phép sửa gì
- phải giữ rule nào
- đã xác minh đến đâu
- còn rủi ro nào mở

Không dùng file này để viết tài liệu dài hay ghi lịch sử đầy đủ.

---

## Cách dùng cho mỗi task

Trước khi code:
- cập nhật `Goal`
- cập nhật `In Scope`
- cập nhật `Out of Scope`
- cập nhật `Must Preserve`
- ghi ngắn `Plan`

Trong khi làm:
- cập nhật `Progress` khi đã xong một mốc rõ ràng
- cập nhật `Open Questions` nếu phát hiện blocker hoặc điểm chưa chắc

Kết thúc task:
- cập nhật `Done`
- cập nhật `Verification`
- cập nhật `Risks / Next`

Nếu mở phiên AI mới:
1. Đọc `AGENTS.md`
2. Đọc `docs/current-work.md`
3. Đọc `docs/regression-checklist.md`
4. Đọc thêm các docs/contract liên quan đúng flow đang sửa

Quy ước bắt buộc:
- Không bắt đầu sửa code nếu `docs/current-work.md` chưa phản ánh đúng task hiện tại.
- Không kết luận xong task nếu chưa đi lại section phù hợp trong `docs/regression-checklist.md`.
- Nếu task đổi phạm vi hoặc phát hiện rule mới, cập nhật file này ngay trong phiên đó.
- Khi mở phiên AI mới, ưu tiên tin dữ liệu trong file này hơn chat history cũ.

---

## Template

```md
# Current Work

## Goal
- ...

## In Scope
- ...

## Out of Scope
- ...

## Must Preserve
- ...

## Plan
- ...

## Progress
- ...

## Done
- ...

## Verification
- ...

## Open Questions
- ...

## Risks / Next
- ...
```

---

## Current Snapshot

### Task Type
- Bug Fix

### Goal
- Sửa lỗi trên desktop của màn `/map`: loading overlay `Đang tải bản đồ…` bị treo dù bản đồ đã hiển thị.
- Sửa thêm regression runtime mới trên desktop của màn `/map`: `RangeError mismatched image size` khi tạo `user-heading-fan`.
- Làm theo hướng test-first: viết test tái hiện đúng lỗi người dùng còn gặp, để chỉ sửa khi test đã chứng minh bug.

### In Scope
- Cập nhật `docs/current-work.md` cho task bugfix này.
- Viết test tái hiện bug desktop loading overlay trên `/map`.
- Viết test tái hiện bug kích thước ảnh marker heading khi `devicePixelRatio` là số lẻ trên desktop Chrome.
- Chạy test để xác nhận đang fail trước khi sửa.
- Sửa logic tạo asset map liên quan trong `helper/mapMarkerImages.js` và verify hẹp cho bug desktop `/map`.
- Chạy lại test mục tiêu và verify hẹp cho bug desktop loading overlay trên `/map`.

### Out of Scope
- Không thay đổi search, route planning, filter khu vực, navigation follow mode hay marker logic ngoài phần cần cho bug loading này.
- Không refactor lớn `pages/map.js` hay đổi kiến trúc controller map.
- Không đụng các file đang bẩn sẵn ngoài phần tối thiểu phục vụ fix.

### Must Preserve
- `/map` vẫn nhận đúng query `storeId`, `lat`, `lng` và giữ hành vi focus/highlight hiện tại.
- Chỉ store có tọa độ hợp lệ mới hiển thị trên map; không làm ảnh hưởng blue dot, điều hướng, route drawing.
- Overlay loading chỉ biến mất khi map đã đủ sẵn sàng để user tương tác; không bỏ qua lỗi khởi tạo map thật.
- Asset marker/heading vẫn phải hiển thị đúng trên DPR nguyên và không làm hỏng render khi DPR desktop là số lẻ do zoom.
- Text tiếng Việt giữ UTF-8 an toàn; ưu tiên patch nhỏ.

### Plan
- Viết test desktop tái hiện lỗi người dùng còn thấy.
- Chạy test để chốt trạng thái đỏ trước khi sửa.
- Sửa tối thiểu theo đúng tín hiệu test fail.
- Chạy lint hoặc focused verification phù hợp, đi lại checklist `Checklist chung` và `Map Flow`.
- Cập nhật `Done`, `Verification`, `Risks / Next` sau khi verify xong.

### Progress
- Đã đọc đầy đủ bộ docs bắt buộc và skill docs trong repo cho task này.
- Đã phân loại task là `Bug Fix`.
- Đã quay lại pha test-first theo yêu cầu mới của user vì bug vẫn còn xuất hiện ngoài thực tế.
- Đã thêm test desktop riêng `desktop /map vẫn tắt loading overlay khi canvas asset marker bị lỗi` trong `e2e/store-map.spec.js`.
- Đã chạy lại test mục tiêu trên nhánh hiện tại và test đang fail: overlay `Đang tải bản đồ…` vẫn visible dù map UI đã lên.
- Đã khoanh vùng root cause khả dĩ ở `pages/map.js`: `setMapReady(true)` đang nằm sau nhánh tạo asset canvas tùy chọn (`user-heading-fan` và marker image), nên nếu desktop Chrome lỗi canvas phụ thì loading overlay không bao giờ tắt.
- Đã vá `pages/map.js` để coi base map là sẵn sàng trước các asset canvas tùy chọn, đồng thời bọc fallback an toàn cho heading asset và batch tạo marker image.
- Đã chạy lại hai test desktop mục tiêu sau khi sửa và cả hai đều pass.
- Đã nhận bug runtime mới từ user: `RangeError mismatched image size` ở `map.addImage('user-heading-fan', ...)`.
- Đã khoanh vùng root cause mới ở `helper/mapMarkerImages.js`: `createUserHeadingFanImage()` đang trả `width/height` theo số float khi `window.devicePixelRatio` là số lẻ, trong khi buffer canvas thực tế dùng kích thước integer.
- Đã thêm unit test hẹp `__tests__/helper/mapMarkerImages.test.js` để tái hiện case `devicePixelRatio = 0.9`; test fail trước khi sửa vì `image.width` không phải integer.
- Đã vá `helper/mapMarkerImages.js` để `createUserHeadingFanImage()` dùng kích thước integer và trả đúng `canvas.width`, `canvas.height`, `ImageData` đồng nhất.
- Đã chạy lại test helper mới, hai regression Playwright của `/map`, và lint vùng sửa; tất cả đều pass.

### Done
- Đã khóa regression `mismatched image size` theo hướng test-first:
  - test helper đỏ trước khi sửa với DPR lẻ
  - vá tối thiểu ở `helper/mapMarkerImages.js`
  - test helper và các regression desktop `/map` đều xanh
- Nhánh `user-heading-fan` không còn nổ `RangeError` do width/height float lệch buffer ảnh trên desktop Chrome.

### Verification
- Đã chạy `npx.cmd playwright test e2e/store-map.spec.js --grep "desktop /map vẫn tắt loading overlay khi canvas asset marker bị lỗi"`:
  - trước khi sửa: fail, do `getByText('Đang tải bản đồ…')` vẫn visible
  - sau khi sửa: pass (`1 passed`)
- Đã chạy `npx.cmd playwright test e2e/store-map.spec.js --grep "desktop /map ẩn loading overlay sau khi bản đồ đã sẵn sàng"`: pass (`1 passed`).
- Đã chạy `npx.cmd eslint pages/map.js e2e/store-map.spec.js --ext .js,.jsx --quiet`: pass.
- Đã chạy `npx.cmd vitest run __tests__/helper/mapMarkerImages.test.js`:
  - trước khi sửa: fail, vì `image.width` không phải integer ở DPR lẻ
  - sau khi sửa: pass (`1 passed`)
- Đã chạy `npx.cmd playwright test e2e/store-map.spec.js --grep "desktop /map vẫn tắt loading overlay khi canvas asset marker bị lỗi|desktop /map ẩn loading overlay sau khi bản đồ đã sẵn sàng"`: pass (`2 passed`).
- Đã chạy `npx.cmd eslint helper/mapMarkerImages.js __tests__/helper/mapMarkerImages.test.js pages/map.js e2e/store-map.spec.js --ext .js,.jsx --quiet`: pass.
- Checklist đã đi lại:
  - `Checklist chung`
  - `Map Flow`

### Open Questions
- Không có blocker mới; test-first đã xác nhận bug nằm trên nhánh loading overlay của `/map`, không cần đoán thêm.

### Risks / Next
- Worktree đang có thay đổi sẵn ở `pages/map.js` và `helper/useMapRouteController.js`; khi patch phải tránh ghi đè phần không liên quan.
- Còn `1` test map ngoài scope đang fail về thứ tự search suggestion; cần tránh để nó che mất tín hiệu của test loading mới.
- Chưa rerun toàn bộ `e2e/store-map.spec.js` vì file này đang có một test ngoài scope đã biết là fail; bằng chứng xanh hiện tập trung ở 2 regression desktop liên quan trực tiếp tới loading overlay.
- Desktop Chrome có thể tạo `devicePixelRatio` số lẻ khi zoom, nên mọi asset canvas trả về cho MapLibre cần dùng width/height integer khớp tuyệt đối với buffer ảnh.
