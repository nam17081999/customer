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
- Chọn **loại cửa hàng** ở một khối riêng phía trên ô tên
- Loại hiển thị dạng nút chọn, mobile hiển thị **2 loại / 1 hàng**
- Mặc định loại = `Tạp hóa`
- Giá trị loại lấy từ `STORE_TYPE_OPTIONS` trong `lib/constants.js`
- Bắt buộc nhập tên
- Tự động convert sang **Title Case VI** (`toTitleCaseVI()`)
- **Kiểm tra trùng tên** (bắt buộc trước khi sang bước 2):
  - `findNearbySimilarStores()`: bán kính 100m, ít nhất 1 từ khóa trùng
  - `findGlobalExactNameMatches()`: toàn hệ thống, tất cả từ khóa trùng
  - `mergeDuplicateCandidates(near, global, lat, lng)`: gộp 2 nguồn và bổ sung khoảng cách cho cả match toàn hệ thống nếu có tọa độ
  - Nếu có → cảnh báo + cần xác nhận "Vẫn tạo" mới tiếp tục

### Bước 2: Thông Tin
- **Bắt buộc**: Quận/Huyện + Xã/Phường (từ danh sách `DISTRICT_WARD_SUGGESTIONS`)
- **Tùy chọn**: Địa chỉ chi tiết, SĐT, Ghi chú, Ảnh
- SĐT: format VN (`0xxx` hoặc `+84xxx`, 9-10 số sau prefix)
- Ảnh: JPEG/PNG/WebP ≤10MB, nén về ≤1MB trước upload
- Khi bước 1 đã lấy được GPS để kiểm tra trùng, hệ thống sẽ tự prefill quận/huyện + xã/phường của cửa hàng gần nhất ngay trong nền, bất kể kết quả trùng hay không trùng; sang bước 2 thì field đã sẵn sàng nếu chưa bị nhập tay
- Có nút **Lưu luôn** ngay tại bước 2 chỉ khi là admin hoặc telesale:
  - vẫn bắt buộc `Quận/Huyện` + `Xã/Phường`
  - **bắt buộc thêm số điện thoại hợp lệ**
  - trước khi lưu phải hỏi xác nhận việc lưu cửa hàng **không có vị trí**
  - khi lưu theo nhánh này, store được tạo với `latitude = null`, `longitude = null`

### Bước 3: Vị Trí
- Auto lấy GPS khi vào bước 3
- User có thể: kéo map / paste Google Maps link / lấy GPS mới
- Nếu là admin và đang dùng mobile, phần dán **Google Maps link** hiển thị mặc định ngay dưới bản đồ
- **Ưu tiên tọa độ**: edited map > GPS ban đầu > GPS hiện tại

### Khi Submit
1. Duplicate check lần cuối bằng tọa độ final
2. Upload ảnh → `imageFilename`
3. INSERT Supabase (`active = isAdmin`, lưu thêm `store_type`)
4. `appendStoreToCache(newStore)`
5. Ngoại lệ: nếu **Lưu luôn** ở bước 2 thì bỏ duplicate check cuối theo tọa độ, vì store chưa có vị trí

---

## 2b. Chỉnh sửa & Báo cáo (Edit/Report)

### Chỉnh sửa (Admin)
- **Bắt buộc**: Quận/Huyện + Xã/Phường khi **chỉnh sửa**.
- Lưu xong: ưu tiên cập nhật cache local rồi dispatch `storevis:stores-changed`.
- Nếu mở `/store/edit/[id]?mode=supplement`:
  - luôn bắt đầu từ **bước 1**
  - chỉ cho nhập dữ liệu còn thiếu, dữ liệu đã có thì bị khóa
  - nếu store chưa có vị trí thì flow có **3 bước**
  - nếu store đã có vị trí thì flow chỉ có **2 bước**, bước 2 hoàn thành luôn
  - khi vào **bước 3** của store chưa có vị trí, trang sẽ tự lấy GPS hiện tại một lần
  - nếu là admin đã đăng nhập thì submit update trực tiếp `stores`
  - nếu chưa đăng nhập thì submit tạo `store_reports.report_type = 'edit'` để admin duyệt

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
- **Báo cáo sửa**: cập nhật `stores` theo `proposed_changes`, sau đó cập nhật cache local + dispatch `storevis:stores-changed`.
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

**Mặc định khi chưa nhập tiêu chí tìm kiếm**:
- Nếu `q` rỗng và chưa chọn bộ lọc → hiển thị **toàn bộ cửa hàng**
- Vẫn sắp xếp theo khoảng cách **gần → xa**

**Làm mới vị trí người dùng**:
- Trang `/` tự lấy lại vị trí sau mỗi `3 phút` khi app đang mở
- Khi người dùng quay lại tab/trang (`visibilitychange`, `focus`, `pageshow`), vị trí cũng được refresh lại

**Bộ lọc chi tiết trên `/`**:
- Có nút **Lọc** nằm bên phải ô tìm kiếm
- Có thể kết hợp nhiều bộ lọc cùng lúc
- `Quận / Huyện`: chọn **1**
- `Xã / Phường`: chọn **1**
- `Loại cửa hàng`: chọn nhiều
- `Chi tiết dữ liệu`: chọn nhiều (`Có số điện thoại`, `Có ảnh`, `Không có vị trí`)
- Trên mobile, panel lọc được rút gọn:
  - `Quận / Huyện` và `Xã / Phường` dùng `select`
  - Các nhóm còn lại hiển thị dạng lưới 2 cột
  - Footer thao tác nằm gọn trong panel, không được làm tràn ngang

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
- **Filter sidebar**:
  - Khu vực: Quận → Xã; phải chọn xã mới filter stores
  - Loại cửa hàng: chọn nhiều
- Chỉ hiển thị trên bản đồ các store có tọa độ hợp lệ; store không có vị trí không được render marker hay xuất hiện trong search suggestion của `/map`
- Highlight marker khi được chọn: ring `#38bdf8`
- Auto-fix lat/lng nếu bị reversed (swap khi lat nằm ngoài [-90,90])
- Từ modal chi tiết, nút **Bản đồ** chuyển sang `/map` kèm `storeId + lat/lng`
- Khi đi theo luồng này, `/map` mở gần đúng vị trí cửa hàng trước rồi highlight marker sau khi tải dữ liệu
- Không tự mở modal chi tiết trên `/map`
- Có nút **về vị trí đang đứng** ở góc phải dưới, dùng GPS hiện tại rồi `flyTo()`
- Khi vào `/map`, hiển thị thêm **chấm xanh** cho vị trí hiện tại của người dùng

**Thẻ chi tiết cửa hàng**:
- Trong `StoreDetailModal`, `loại cửa hàng` hiển thị phía trên tên
- Dùng cỡ chữ nhỏ hơn tên để giữ hierarchy
- Nếu store chưa có tọa độ thì hiển thị nhãn **Chưa có vị trí**
- Nếu store còn thiếu dữ liệu quan trọng thì có nút **Bổ sung** để mở `/store/edit/[id]?mode=supplement`
- Ở màn tạo store, duplicate panel có thể hiện nút **Bổ sung** để mở supplement flow của store nghi trùng

---

## 5. Xác Thực (Admin)

- `/store/verify`: danh sách `active = false`, bulk select + verify
- Xác thực: `UPDATE stores SET active = true WHERE id IN (...)`
- Soft delete: `UPDATE stores SET deleted_at = now()`
- Sau xác thực/xóa: cập nhật cache local + dispatch `storevis:stores-changed`

---

## 6. Telesale

- Chỉ cửa hàng `is_potential = true` và có `phone` mới xuất hiện ở màn telesale.
- Guest bấm gọi thì gọi thẳng.
- `telesale/admin` bấm gọi sẽ có 2 lựa chọn:
  - `Chỉ gọi`
  - `Gọi lên đơn`
- `Gọi lên đơn` sẽ:
  - gọi ra số điện thoại
  - cập nhật `last_called_at`
  - tự chuyển store sang `is_potential = true`
  - điều hướng sang `/telesale/call/[id]` để chốt kết quả gọi
- Khi lưu kết quả gọi:
  - cập nhật `last_call_result`
  - cập nhật `last_call_result_at`
  - cập nhật `sales_note`
  - nếu là `da_len_don` thì cập nhật thêm `last_order_reported_at`
- Danh sách ưu tiên gọi sắp theo:
  1. store chưa gọi
  2. store đã gọi nhưng chưa cập nhật kết quả trong vòng 30 phút
  3. `goi_lai_sau`
  4. `khong_nghe`
  5. `con_hang`
  6. `da_len_don`
- `con_hang` chỉ hiện lại trong danh sách ưu tiên khi lần cập nhật kết quả đó đã quá 2 ngày.
- `da_len_don` chỉ hiện lại trong danh sách ưu tiên khi lần báo đơn đó đã quá 3 ngày.

---

## 7. Phát Hiện Trùng Tên

Bỏ qua các từ chung khi so sánh (`IGNORED_NAME_TERMS`):
> "cửa hàng", "tạp hoá", "quán nước", "cafe", "siêu thị", "quán", "shop", "mart", và nhiều loại khác

**Ví dụ**: "Cửa hàng Minh Anh" → từ khóa so sánh là **"Minh Anh"**

**Khoảng cách trong duplicate check**:
- Chỉ store có `latitude` và `longitude` hợp lệ mới được gắn `distance`
- Store không có vị trí vẫn có thể xuất hiện trong match toàn hệ thống, nhưng **không được hiển thị khoảng cách giả**

---

## 8. Địa Lý

6 huyện trong `lib/constants.js`: Hoài Đức, Đan Phượng, Phúc Thọ, Bắc Từ Liêm, Nam Từ Liêm, Quốc Oai (~100+ xã/phường).

Huyện ngoài danh sách: user nhập tay (không có dropdown suggestion).

---

## 9. Authentication

- Supabase Email/Password — không có đăng ký
- `AuthContext.js`: `user`, `loading`, `signIn`, `signOut`, `role`, `isAdmin`, `isTelesale`, `isAuthenticated`
- Route protection:
  - trang admin chỉ dành cho `admin`
  - trang telesale dành cho `telesale/admin`
- `role` lấy từ metadata Supabase; nếu tài khoản cũ chưa có metadata thì fallback thành `admin`

---

## 10. Image Upload Flow

```
1. Compress (browser-image-compression): max 1MB, 1600px, JPEG 0.8
2. POST /api/upload-image (multipart)
3. Server: ImageKit SDK upload (private key)
4. Response: { name, fileId, ...}
5. Lưu `name` vào DB (image_url)
6. Nếu insert DB lỗi → DELETE ảnh đã upload (rollback)
```

---

## 11. Xuất Dữ Liệu

- Màn export Excel/CSV phải xuất **tất cả cửa hàng đang có** (`deleted_at IS NULL`)
- File Excel/CSV **không phụ thuộc** cửa hàng có số điện thoại hay không
- File danh bạ `.vcf` vẫn chỉ xuất các cửa hàng có số điện thoại hợp lệ
- Khi tải dữ liệu export từ Supabase, cần đọc theo trang để không bị hụt bản ghi khi số lượng store lớn

---

## 12. Nhập Dữ Liệu

- `/store/import` là màn admin để nhập nhiều cửa hàng từ file `.csv`
- Màn này phải có nút tải **file mẫu** để người dùng điền đúng cột
- Các cột bắt buộc của file mẫu:
  - `Tên cửa hàng`
  - `Xã / Phường`
  - `Quận / Huyện`
- Các cột tùy chọn:
  - `Loại cửa hàng`
- `Địa chỉ chi tiết`
  - `Số điện thoại`
  - `Ghi chú`
  - `Vĩ độ`
  - `Kinh độ`
- Khi tải file lên, UI phải render **preview theo từng dòng** để admin kiểm tra trước khi nhập
- Mỗi dòng preview cần hiển thị:
  - dữ liệu đã chuẩn hóa
  - trạng thái `Sẵn sàng nhập` / `Nghi trùng` / `Lỗi dữ liệu`
  - danh sách lỗi hoặc cảnh báo
  - tối đa 3 store nghi trùng trong hệ thống nếu có
- Logic kiểm tra trên preview:
  - thiếu cột bắt buộc trong header → chặn import
  - thiếu `Tên cửa hàng` / `Xã / Phường` / `Quận / Huyện` → lỗi
  - `Loại cửa hàng` phải khớp `STORE_TYPE_OPTIONS`; để trống thì dùng `DEFAULT_STORE_TYPE`
  - `Số điện thoại` nếu có thì phải đúng format VN
  - `Vĩ độ` và `Kinh độ` phải đi theo cặp; nếu có thì phải hợp lệ
  - trùng trong chính file → trạng thái `Nghi trùng`
  - nghi trùng với hệ thống hiện có → trạng thái `Nghi trùng`
- Nếu nghi trùng với hệ thống, admin có thể:
  - `Tạo mới`
  - hoặc chọn một cửa hàng nghi trùng cụ thể rồi chọn `Giữ dữ liệu cũ` hoặc `Lấy dữ liệu mới`
- Với hai lựa chọn trên:
  - field chỉ có ở một bên thì vẫn được giữ lại
  - field có ở cả hai bên thì theo lựa chọn `Giữ dữ liệu cũ` hoặc `Lấy dữ liệu mới`
- Chỉ các dòng `Sẵn sàng nhập` mới được xử lý:
  - `Tạo mới` → insert vào `stores`
  - chọn store nghi trùng + `Giữ dữ liệu cũ` / `Lấy dữ liệu mới` → update store đã chọn theo rule trên
- Bulk import xong phải:
  - cập nhật cache local hoặc fallback `invalidateStoreCache()`
  - dispatch `storevis:stores-changed`
  - tải lại danh sách store hiện có để các lần import sau so trùng đúng

---

## 13. Quy Tắc Tiếng Việt & Dialog Xác Nhận

- Text tiếng Việt hiển thị cho user/admin phải giữ đúng dấu trong source và trên UI.
- Nếu terminal hiển thị sai dấu, chưa được coi đó là bằng chứng file source bị hỏng.
- Khi sửa text tiếng Việt:
  - ưu tiên patch nhỏ
  - kiểm tra lại bằng `git diff`
  - nếu là text trên màn hình thì nên reload màn đó để xác nhận
- Các dialog xác nhận trong màn admin phải luôn có:
  - tiêu đề rõ ràng
  - mô tả ngắn giải thích hành động sắp thực hiện
- Hai màn áp dụng bắt buộc:
  - `/store/verify`
  - `/store/reports`
