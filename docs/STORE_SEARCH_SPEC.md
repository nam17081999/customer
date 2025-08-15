# Đặc Tả Nghiệp Vụ Tìm Kiếm Cửa Hàng & Khoảng Cách

## 1. Mục đích
Xác định các quy tắc nghiệp vụ bất biến cho việc tìm kiếm cửa hàng, phân trang, tính khoảng cách, chọn cửa hàng và virtual scrolling, nhằm tránh phát sinh thay đổi logic ngoài ý muốn.

## 2. Phạm vi
- File: `pages/index.js` (logic HomePage)
- Nguồn dữ liệu: bảng Supabase `stores`
- Tính khoảng cách (vị trí NPP vs vị trí người dùng)
- Virtual scrolling (react-virtuoso)
- Lưu danh sách cửa hàng đã chọn
- CTA tạo cửa hàng khi không có kết quả

## 3. Thuật ngữ
| Thuật ngữ | Ý nghĩa |
|----------|---------|
| `NPP_LOCATION` | Vị trí tham chiếu mặc định (xem `lib/constants.js`) |
| `PAGE_SIZE` | Số bản ghi mỗi lần fetch |
| `MIN_SEARCH_LEN` | Số ký tự tối thiểu để bắt đầu tìm kiếm |
| `searchResults` | Danh sách kết quả đã fetch (kèm khoảng cách) |
| `stores` | Danh sách cửa hàng người dùng đã chọn, lưu trong localStorage |
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
7. (Mới) Nếu không có kết quả (khi `!loading && searchTerm.length >= MIN_SEARCH_LEN && results.length === 0`) thì:
   - Nếu đã đăng nhập: hiển thị nút "+ Tạo cửa hàng mới".
   - Link mang query `?name=<searchTerm đã encode>` để prefill tên ở trang tạo.
   - Nếu chưa đăng nhập: hiển thị chú thích yêu cầu đăng nhập, KHÔNG hiển thị nút.

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

## 7. Chuyển vị trí (Location Switch)
- Chế độ: `npp` | `user`.
- Vị trí tham chiếu:
  - Nếu mode = `user` VÀ có `currentLocation` → dùng tọa độ người dùng.
  - Ngược lại → dùng `NPP_LOCATION`.
- Việc chuyển chỉ tính lại trường `distance` trong `searchResults`.
- KHÔNG được phát sinh fetch mới.

## 8. Tính khoảng cách
- Hàm: `haversineKm(lat1, lon1, lat2, lon2)`.
- Thiếu bất kỳ tọa độ nào → `distance = null`.
- Định dạng hiển thị xử lý ở component thẻ cửa hàng (không xử lý tại đây).

## 9. Lưu trữ
- Khóa localStorage: `selectedStores`.
- Khi thay đổi state `stores`: lưu JSON + dispatch `CustomEvent('selectedStoresUpdated')`.

## 10. CTA Khi Không Có Kết Quả
| Điều kiện hiển thị | Hành vi |
|--------------------|---------|
| Đã đăng nhập & no results & `searchTerm.length >= MIN_SEARCH_LEN` | Nút `+ Tạo cửa hàng mới` (prefill param `name`) |
| Chưa đăng nhập & no results & hợp lệ | Chỉ hiển thị thông báo yêu cầu đăng nhập |
| Đang loading hoặc chưa đủ ký tự | Không hiển thị CTA |

Quy tắc:
- Không trigger thêm fetch khi bấm nút (chuyển trang tạo).
- Tham số `name` chỉ dùng để prefill (frontend đọc query), không dùng làm dữ liệu cuối cùng nếu user sửa.
- Không encode thêm nhiều lần (dùng `encodeURIComponent` một lần lúc build link).

## 11. Quy tắc bất biến (KHÔNG PHÁ VỠ)
1. Không refetch khi đổi `locationMode`.
2. `queryKey` để chống fetch trùng = chỉ `searchTerm` gốc.
3. Giữ nguyên thứ tự sắp xếp: `status DESC`, `created_at DESC` trừ khi cập nhật tài liệu.
4. Luôn lọc trùng khi gộp phân trang.
5. Không mutate trực tiếp mảng `searchResults` hiện tại.
6. Không thay đổi `PAGE_SIZE`, `MIN_SEARCH_LEN`, hay debounce nếu chưa chỉnh tài liệu.
7. Không pre-load trang kế tiếp tự động trước lần load hợp lệ đầu tiên (khi suppression còn hiệu lực).
8. (Mới) Không hiển thị nút tạo nếu người dùng chưa đăng nhập hoặc chưa đạt đủ điều kiện no-result.
9. (Mới) Prefill param `name` chỉ phản ánh thời điểm xây link, không ép buộc tên khi submit nếu người dùng xóa/sửa.

## 12. Các thay đổi an toàn (cập nhật tài liệu nếu đổi)
- UI / Styling / Skeleton.
- `overscan` & chiều cao container.
- Định dạng hiển thị khoảng cách (làm tròn, đơn vị).
- Thêm cache theo `searchTerm`.
- Thêm AbortController để hủy request cũ.
- Thay đổi text thông báo no-result hoặc label nút tạo.

## 13. Checklist Dev (trước khi commit)
- [ ] Search debounce đúng thời gian.
- [ ] Đổi `locationMode` không sinh network call.
- [ ] `loadMore` chỉ bắn 1 lần mỗi lần chạm đáy (không race).
- [ ] Không xuất hiện bản ghi trùng sau nhiều lần phân trang.
- [ ] Khoảng cách cập nhật ngay khi đổi chế độ vị trí.
- [ ] Xóa search (< `MIN_SEARCH_LEN`) reset đầy đủ.
- [ ] Xử lý tốt khi thiếu tọa độ.
- [ ] CTA no-result chỉ xuất hiện đúng điều kiện.
- [ ] Link tạo chứa query `name` chính xác và được encode.

## 14. Kịch bản test thủ công
| Kịch bản | Kỳ vọng |
|----------|---------|
| Nhập < `MIN_SEARCH_LEN` | Không gọi network, xóa kết quả |
| Nhập term hợp lệ 1 lần | 1 lần fetch, có dữ liệu |
| Nhập lại cùng term | Không fetch thêm (dedupe) |
| Chuyển NPP ↔ User | Khoảng cách đổi, không network |
| Cuộn cuối danh sách nhiều lần | Tăng trang tuần tự |
| Cố tình trùng id khi loadMore | Không xuất hiện bản sao |
| No result & logged in | Thấy nút tạo + param name đúng |
| No result & not logged in | Không có nút tạo, chỉ nhắc đăng nhập |

## 15. Mở rộng tương lai (chưa làm)
- Prefetch trang kế tiếp khi idle.
- Cache LRU các searchTerm.
- Hủy request cũ khi gõ nhanh (AbortController).
- Tính khoảng cách phía server (SQL / PostGIS) để giảm tải client.
- Gợi ý auto tạo từ template khi không có kết quả.

## 16. Lịch sử thay đổi
- v1.0 (Khởi tạo): Khóa hành vi hiện tại (2025-08-15).
- v1.1 (2025-08-15): Thêm CTA tạo cửa hàng khi không có kết quả.

---
Luôn cập nhật tài liệu này khi thay đổi hành vi liên quan.
