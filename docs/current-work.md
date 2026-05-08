# Current Work

## Goal
- Sửa hiện tượng danh sách cửa hàng ở màn tìm kiếm bị khựng, trượt giật và đôi lúc nhảy một đoạn trên điện thoại, phù hợp cho cả web mobile và app cài ra màn hình chính trên iPhone.

## Task Type
- Bug Fix

## Why
- Hành vi cuộn không mượt đang ảnh hưởng flow chính của route `/`.
- Ứng dụng chạy trên nhiều trình duyệt điện thoại và cả iPhone standalone PWA nên fix phải ưu tiên tính ổn định viewport và tránh list reorder giữa lúc user đang lướt.

## In Scope
- `pages/index.js`
- `helper/useHomeSearchController.js`
- `components/search-store-card.jsx`
- Điều chỉnh behavior scroll/search list ở route `/`.
- Cập nhật `docs/current-work.md`.

## Out of Scope
- Không redesign UI lớn.
- Không đổi business rule search/filter/sort mặc định ngoài việc tránh re-sort giữa lúc user đang cuộn.
- Không thêm dependency mới.

## Must Preserve
- Search tiếng Việt có dấu/không dấu và rule phonetic hiện tại.
- Pages Router, query sync, filter behavior, cache read hiện tại.
- Mặc định vẫn ưu tiên sort theo khoảng cách khi có location; chỉ thay đổi thời điểm áp dụng lại sort để tránh jump.
- Accessibility và touch targets hiện tại.

## Inputs / Repro / Expected
- Repro: trên điện thoại, lướt danh sách cửa hàng ở màn tìm kiếm thì cuộn không mượt; đôi lúc danh sách bị khựng rồi nhảy/trượt đi một đoạn.
- Current: viewport list có thể bị remeasure khi mobile browser chrome đổi trạng thái; list cũng có thể đổi thứ tự khi location update đến trong lúc user đang cuộn.
- Expected: vùng list có chiều cao ổn định hơn trên mobile/PWA và list không tự reorder khi user đang ở giữa danh sách.

## Constraints
- Giữ thay đổi tối thiểu, đúng phạm vi bugfix.
- Phải phù hợp cả Safari mobile và iPhone home-screen app.

## Required Verification
- `npm run lint`
- Đối chiếu section `Search Flow` trong `docs/regression-checklist.md`
- Verify logic route `/` không phá query sync/search/filter hiện tại.

## Definition of Done
- Đã loại bỏ nguồn gây jump chính từ viewport height, location-driven reorder, và giảm rủi ro re-measure của virtual row.
- Lint pass.
- `docs/current-work.md` có `Done`, `Verification`, `Risks / Next` mới.

## Plan
- Dùng viewport height ổn định hơn cho mobile search page.
- Theo dõi trạng thái list ở top để chỉ áp dụng lại sort theo location khi an toàn.
- Ổn định hóa row height cho virtual list.
- Chạy lint và cập nhật working memory.

## Done
- Đã đổi container chính của trang search từ `100dvh` sang `100svh` trên mobile và giữ `100dvh` cho `sm+`, giúp vùng list ổn định hơn khi Safari/iPhone browser chrome ẩn/hiện trong lúc cuộn.
- Đã nối `atTopStateChange` từ `react-virtuoso` để biết khi list đang ở đầu.
- Đã tách `currentLocation` và `sortLocation`:
  - `currentLocation` vẫn refresh như cũ để giữ dữ liệu vị trí mới nhất.
  - `sortLocation` chỉ được commit khi list đang ở top hoặc khi search criteria đổi.
  - Nếu vị trí mới đến khi user đang cuộn giữa danh sách, update sẽ được defer để tránh reorder/jump giữa chừng.
- Đã tối ưu thêm tầng virtualization:
  - đặt `fixedItemHeight={124}` cho `Virtuoso`
  - giảm `overscan` từ `300` xuống `180`
  - bọc mỗi row bằng khung cao cố định `124px`
- Đã ổn định hóa compact row:
  - card compact cao cố định `112px`
  - bỏ `OverflowMarquee` ở compact row, chuyển sang `truncate` tĩnh để tránh `ResizeObserver` đo lại từng item khi cuộn
  - cố định chiều cao vùng badge/khoảng cách và block địa chỉ
  - bọc `SearchStoreCard` bằng `memo` để giảm rerender row visible
- Đã giữ nguyên search/query/filter behavior hiện có.

## Verification
- Đối chiếu `Search Flow` trong `docs/regression-checklist.md` để giữ nguyên behavior search/filter/sort/query sync.
- Chạy `npm run lint` thành công, không còn warning/error.
- Rà lại code path các điểm sửa:
  - `pages/index.js`
  - `helper/useHomeSearchController.js`
  - `components/search-store-card.jsx`

## Risks / Next
- Cần smoke test trực tiếp trên:
  - Safari iPhone
  - iPhone app cài ra màn hình chính
  - Android Chrome
- Nếu vẫn còn jump trên một nhóm máy cụ thể, bước kế tiếp cần xem liệu `StoreDetailModal`/`TelesaleCallDialog` mount trong mỗi row có còn gây cost đáng kể không; khi đó nên chuyển sang lazy-mount dialog theo item đang mở.
