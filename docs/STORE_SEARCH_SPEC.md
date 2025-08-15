# Đặc Tả Nghiệp Vụ Tìm Kiếm Cửa Hàng & Khoảng Cách

## 1. Mục đích
Xác định các quy tắc nghiệp vụ bất biến cho việc tìm kiếm cửa hàng, phân trang, tính khoảng cách, chọn cửa hàng và virtual scrolling, nhằm tránh phát sinh thay đổi logic ngoài ý muốn.

## 2. Phạm vi
- File: `pages/index.js` (logic HomePage)
- File liên quan đồng bộ vị trí: `pages/visit-list.js`
- Nguồn dữ liệu: bảng Supabase `stores`
- Tính khoảng cách (vị trí NPP vs vị trí người dùng)
- Virtual scrolling (react-virtuoso)
- Lưu danh sách cửa hàng đã chọn
- CTA tạo cửa hàng khi không có kết quả
- (v1.3) Đồng bộ & persist chế độ vị trí giữa trang tìm kiếm và trang danh sách ghé thăm

## 3. Thuật ngữ
| Thuật ngữ | Ý nghĩa |
|----------|---------|
| `NPP_LOCATION` | Vị trí tham chiếu mặc định (xem `lib/constants.js`) |
| `PAGE_SIZE` | Số bản ghi mỗi lần fetch |
| `MIN_SEARCH_LEN` | Số ký tự tối thiểu để bắt đầu tìm kiếm |
| `searchResults` | Danh sách kết quả đã fetch (kèm khoảng cách) |
| `stores` | Danh sách cửa hàng người dùng đã chọn, lưu trong localStorage |
| `LOCATION_MODE_KEY` | Khóa localStorage lưu chế độ vị trí hiện tại (`locationMode`) |
| `USER_LOCATION_KEY` | Khóa localStorage lưu tọa độ người dùng đã lấy được |
| "CTA Không Kết Quả" | Nút tạo cửa hàng mới xuất hiện khi không có kết quả |

## 4. Luồng tìm kiếm
1. Người dùng nhập `searchTerm` (độ dài >= `MIN_SEARCH_LEN`) → debounce theo `SEARCH_DEBOUNCE_MS`.
2. Gọi Supabase bảng `stores` với điều kiện OR:
   - `name ILIKE %term%`
   - `address ILIKE %term%`
   - `name_search ILIKE %normalized%` (normalized = `removeVietnameseTones(lower(term))`)
3. Sắp xếp: `status` DESC rồi `created_at` DESC.
4. Giới hạn: `PAGE_SIZE` (trang đầu tiên).
5. Sau khi thành công:
   - Ghi `lastQueryRef = searchTerm` (KHÔNG phụ thuộc `locationMode`).
   - Tính `distance` cho từng record dựa trên vị trí tham chiếu hiện tại.
6. Thay đổi `locationMode` (NPP ↔ user) KHÔNG refetch; chỉ tính lại khoảng cách.
7. (v1.1) Nếu không có kết quả (khi `!loading && searchTerm.length >= MIN_SEARCH_LEN && results.length === 0`) thì logic CTA áp dụng như phần 10.

## 5. Phân trang (loadMore)
- Dùng `.range(offset, limit)` dựa trên trang hiện tại.
- Chỉ được phép khi: không `loading`, không `loadingMore`, `hasMore === true`, `searchTerm` hợp lệ.
- Gộp dữ liệu mới vào kết quả hiện tại. Loại bỏ trùng theo `id`.
- `hasMore = (fetchedCount === PAGE_SIZE)`.

## 6. Virtual Scrolling
- Thư viện: `react-virtuoso`.
- Chiều cao container ~70vh (thay đổi phải cập nhật tài liệu).
- `endReached` gọi `loadMore()`.
- `overscan = 300`.

## 6.1. Skeleton Loading (MỚI v1.2)
(giữ nguyên như v1.2 — không thay đổi ở v1.3)

## 7. Chuyển vị trí (Location Switch)
- Chế độ: `npp` | `user`.
- Vị trí tham chiếu:
  - Nếu mode = `user` VÀ có `currentLocation` → dùng tọa độ người dùng.
  - Ngược lại → dùng `NPP_LOCATION`.
- Việc chuyển chỉ tính lại trường `distance` trong tất cả danh sách liên quan (kết quả tìm kiếm + danh sách ghé thăm) — KHÔNG fetch lại.
- (v1.3) Đồng bộ hai trang (`/` và `/visit-list`):
  - Khi chuyển switch trên một trang → lưu `locationMode` vào `localStorage.LOCATION_MODE_KEY` + phát `CustomEvent('locationModeChanged')`.
  - Nếu mode = `user` và vừa lấy tọa độ thành công → lưu tọa độ vào `USER_LOCATION_KEY`.
  - Trang khác lắng nghe sự kiện & storage event để cập nhật ngay, tránh lệch trạng thái.
- (v1.3) Guard: Chỉ chuyển sang `user` sau khi geolocation thành công; nếu lỗi hoặc bị từ chối → alert và giữ nguyên `npp`.
- (v1.3) Hydration: Khởi tạo `locationMode` + user location từ localStorage trong state initializer (trước render) để tránh nhấp nháy switch khi điều hướng giữa trang.

## 8. Tính khoảng cách
(giữ nguyên)

## 9. Lưu trữ
- Khóa localStorage: `selectedStores`, `LOCATION_MODE_KEY`, `USER_LOCATION_KEY` (v1.3 thêm 2 khóa cuối).
- Khi thay đổi state `stores`: lưu JSON + dispatch `CustomEvent('selectedStoresUpdated')`.

## 10. CTA Khi Không Có Kết Quả
(giữ nguyên)

## 11. Quy tắc bất biến (KHÔNG PHÁ VỠ)
1. Không refetch khi đổi `locationMode`.
2. `queryKey` để chống fetch trùng = chỉ `searchTerm` gốc.
3. Giữ nguyên thứ tự sắp xếp: `status DESC`, `created_at DESC` trừ khi cập nhật tài liệu.
4. Luôn lọc trùng khi gộp phân trang.
5. Không mutate trực tiếp mảng `searchResults` hiện tại.
6. Không thay đổi `PAGE_SIZE`, `MIN_SEARCH_LEN`, hay debounce nếu chưa chỉnh tài liệu.
7. Không pre-load trang kế tiếp tự động trước lần load hợp lệ đầu tiên (khi suppression còn hiệu lực).
8. (v1.1) Không hiển thị nút tạo nếu người dùng chưa đăng nhập hoặc chưa đạt đủ điều kiện no-result.
9. (v1.1) Prefill param `name` chỉ phản ánh thời điểm xây link, không ép buộc tên khi submit nếu người dùng xóa/sửa.
10. (v1.2) KHÔNG hiển thị empty-state trong khi `showSkeleton === true`.
11. (v1.2) Logic xác định `showSkeleton` chỉ dựa trên (đủ ký tự) AND (loading OR isPendingSearch).
12. (v1.3) `locationMode` được persist trong localStorage và phải được hydrate trước render đầu tiên (không flash switch).
13. (v1.3) Chỉ chuyển `locationMode` sang `user` nếu geolocation thành công; nếu thất bại hiển thị alert và giữ chế độ cũ.
14. (v1.3) Đồng bộ chéo trang: mọi thay đổi `locationMode` phải phát `CustomEvent('locationModeChanged')` và cập nhật localStorage.
15. (v1.3) Khi mode = `user` thay đổi hoặc user location được lấy lần đầu, phải cập nhật khoảng cách cho mọi danh sách phụ thuộc mà không refetch.

## 12. Các thay đổi an toàn (cập nhật tài liệu nếu đổi)
(giữ nguyên + có thể thêm sửa UX đồng bộ, không cần cập nhật nếu chỉ đổi style switch)

## 13. Checklist Dev (trước khi commit)
Thêm:
- [ ] (v1.3) Chuyển trang giữa `/` và `/visit-list` không flash switch.
- [ ] (v1.3) Thử bật sang "user" khi từ chối quyền → vẫn ở "npp" và có alert.
- [ ] (v1.3) Bật ở trang A → trang B phản ánh ngay (event + storage).
- [ ] (v1.3) Khoảng cách trên cả hai trang đổi nhất quán sau switch.

(Phần còn lại giữ nguyên checklist cũ.)

## 14. Kịch bản test thủ công
Thêm kịch bản v1.3:
| Kịch bản | Kỳ vọng |
|----------|---------|
| Mở trang tìm kiếm khi trước đó đã chọn user | Switch ở trạng thái user ngay, không flash |
| Từ chối quyền định vị rồi chọn user | Alert, vẫn ở npp |
| Chọn user ở trang tìm kiếm rồi mở trang visit-list | Trang visit-list hiển thị user và khoảng cách đã cập nhật |
| Đổi lại về npp ở trang visit-list | Trang tìm kiếm chuyển về npp sau khi quay lại / focus |

(Các kịch bản cũ giữ nguyên.)

## 15. Mở rộng tương lai (chưa làm)
- (Gợi ý) Đồng bộ qua BroadcastChannel thay vì CustomEvent + storage.
- Prefetch trang kế tiếp khi idle.
- Cache LRU các searchTerm.
- Hủy request cũ khi gõ nhanh (AbortController).
- Tính khoảng cách phía server (SQL / PostGIS) để giảm tải client.
- Gợi ý auto tạo từ template khi không có kết quả.

## 16. Lịch sử thay đổi
- v1.3 (2025-08-16): Đồng bộ & persist `locationMode`, guard geolocation, hydrate tránh nhấp nháy, cập nhật khoảng cách đa trang.
- v1.2 (2025-08-15): Thêm cơ chế skeleton mô phỏng thẻ store & chặn flash empty-state.
- v1.1 (2025-08-15): Thêm CTA tạo cửa hàng khi không có kết quả.
- v1.0 (Khởi tạo): Khóa hành vi hiện tại (2025-08-15).

---
Luôn cập nhật tài liệu này khi thay đổi hành vi liên quan.
