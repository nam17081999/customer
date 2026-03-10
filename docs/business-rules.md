# 📋 Quy Tắc Nghiệp Vụ - StoreVis

## 1. Trạng Thái Cửa Hàng

| Trạng thái | `active` | `deleted_at` | Mô tả |
|---|---|---|---|
| Chờ duyệt | `false` | `null` | User thường tạo |
| Đã xác thực | `true` | `null` | Admin duyệt |
| Đã xóa | any | timestamp | Soft-deleted, ẩn hoàn toàn |

---

## 2. Tạo Cửa Hàng — 3 Bước

### Bước 1: Tên
- Bắt buộc nhập tên
- Tự động convert sang **Title Case VI** (`toTitleCaseVI()`)
- **Kiểm tra trùng tên** (bắt buộc trước khi sang bước 2):
  - `findNearbySimilarStores()`: bán kính 100m, ít nhất 1 từ khóa trùng
  - `findGlobalExactNameMatches()`: toàn hệ thống, tất cả từ khóa trùng
  - Nếu có → cảnh báo + cần xác nhận "Vẫn tạo" mới tiếp tục

### Bước 2: Thông Tin
- **Bắt buộc**: Quận/Huyện + Xã/Phường (từ danh sách `DISTRICT_WARD_SUGGESTIONS`)
- **Tùy chọn**: Địa chỉ chi tiết, SĐT, Ghi chú, Ảnh
- SĐT: format VN (`0xxx` hoặc `+84xxx`, 9-10 số sau prefix)
- Ảnh: JPEG/PNG/WebP ≤10MB, nén về ≤1MB trước upload

### Bước 3: Vị Trí
- Auto lấy GPS khi vào bước 3
- User có thể: kéo map / paste Google Maps link / lấy GPS mới
- **Ưu tiên tọa độ**: edited map > GPS ban đầu > GPS hiện tại

### Khi Submit
1. Duplicate check lần cuối bằng tọa độ final
2. Upload ảnh → `imageFilename`
3. INSERT Supabase (`active = isAdmin`)
4. `appendStoreToCache(newStore)`

---

## 2b. Chỉnh sửa & Báo cáo (Edit/Report)

### Chỉnh sửa (Admin)
- **Bắt buộc**: Quận/Huyện + Xã/Phường khi **chỉnh sửa**.
- Lưu xong: `invalidateStoreCache()` + dispatch `storevis:stores-changed`.

### Báo cáo (User) — trong `StoreDetailModal`
User có 2 lựa chọn:

1) **Sửa thông tin** (gửi đề xuất chỉnh sửa)
   - **Bắt buộc**: Quận/Huyện + Xã/Phường.
   - Các trường gửi: `name`, `address_detail`, `ward`, `district`, `phone`, `note`, `latitude`, `longitude`.
   - Chuẩn hóa `toTitleCaseVI()` cho tên + địa chỉ.
   - Nếu **không có thay đổi** → không cho gửi.

2) **Chỉ báo cáo** (không sửa)
   - Chọn **một hoặc nhiều lý do**:
     - Sai địa chỉ
     - Sai vị trí
     - Sai số điện thoại
     - Ảnh không đúng
   - **Không** yêu cầu ảnh minh chứng.

**Trạng thái báo cáo**: `pending` → `approved` hoặc `rejected`.

### Admin duyệt báo cáo
- **Báo cáo sửa**: cập nhật `stores` theo `proposed_changes`, sau đó `invalidateStoreCache()` + dispatch `storevis:stores-changed`.
- **Báo cáo lý do**: chỉ đánh dấu đã xử lý (`approved`), **không** sửa dữ liệu.
- Nút **Chỉ đường** ở màn admin **chỉ hiện** khi **có thay đổi tọa độ** (lat/lng).

---

## 3. Tìm Kiếm — Client-side

**Thuật toán scoring** (filter trên `allStores` đã cache):

| Score | Điều kiện |
|---|---|
| 2 | Tên chứa chuỗi tìm kiếm (có/không dấu) |
| 1 | Tất cả từ của query xuất hiện trong tên |
| 0 | Ít nhất 1 từ xuất hiện |
| loại | Không có từ nào |

**Sort**: score desc → khoảng cách asc → active first → created_at desc

**Tiếng Việt không dấu**: dùng `removeVietnameseTones()` để chuẩn hóa cả query lẫn tên store.

**Tương đương phát âm**: khi chuẩn hóa search, coi các cặp/cụm phụ âm sau là tương đương để người dùng gõ sai chính tả vẫn tìm ra kết quả:
- s ↔ x
- ch ↔ tr
- ng ↔ ngh
- d ↔ gi ↔ r
- l ↔ n (trừ “ng/nh” để tránh đè lên âm ng/nh)

Hàm hỗ trợ: `normalizeVietnamesePhonetics()` (được dùng ở trang tìm kiếm và màn xác thực admin).

---

## 4. Bản Đồ

- Tile: OpenStreetMap (không cần key)
- Default center: `[105.6955684, 21.0768617]` (Hà Nội)
- Markers: canvas tùy chỉnh (house icon + label)
- Click marker → `StoreDetailModal`
- Hover (desktop) → popup tên + địa chỉ
- **Filter sidebar**: Quận → Xã; phải chọn xã mới filter stores
- Highlight marker khi được chọn: ring `#38bdf8`
- Auto-fix lat/lng nếu bị reversed (swap khi lat nằm ngoài [-90,90])

---

## 5. Xác Thực (Admin)

- `/store/verify`: danh sách `active = false`, bulk select + verify
- Xác thực: `UPDATE stores SET active = true WHERE id IN (...)`
- Soft delete: `UPDATE stores SET deleted_at = now()`
- Sau xác thực/xóa: `invalidateStoreCache()` + dispatch `storevis:stores-changed`

---

## 6. Phát Hiện Trùng Tên

Bỏ qua các từ chung khi so sánh (`IGNORED_NAME_TERMS`):
> "cửa hàng", "tạp hoá", "quán nước", "cafe", "siêu thị", "quán", "shop", "mart", và nhiều loại khác

**Ví dụ**: "Cửa hàng Minh Anh" → từ khóa so sánh là **"Minh Anh"**

---

## 7. Địa Lý

6 huyện trong `lib/constants.js`: Hoài Đức, Đan Phượng, Phúc Thọ, Bắc Từ Liêm, Nam Từ Liêm, Quốc Oai (~100+ xã/phường).

Huyện ngoài danh sách: user nhập tay (không có dropdown suggestion).

---

## 8. Authentication

- Supabase Email/Password — không có đăng ký
- `AuthContext.js`: `user`, `loading`, `signIn`, `signOut`
- Route protection: mỗi admin page tự check + redirect `/login?from=...`
- `isAdmin = Boolean(user)`

---

## 9. Image Upload Flow

```
1. Compress (browser-image-compression): max 1MB, 1600px, JPEG 0.8
2. POST /api/upload-image (multipart)
3. Server: ImageKit SDK upload (private key)
4. Response: { name, fileId, ...}
5. Lưu `name` vào DB (image_url)
6. Nếu insert DB lỗi → DELETE ảnh đã upload (rollback)
```
