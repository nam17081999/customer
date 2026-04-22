# 📋 Quy Tắc Nghiệp Vụ - NPP Hà Công

## 1. Trạng Thái Cửa Hàng

| Trạng thái | `active` | `deleted_at` | Mô tả |
|---|---|---|---|
| Chờ duyệt | `false` | `null` | User thường tạo |
| Đã xác thực | `true` | `null` | Admin duyệt |
| Đã xóa | any | timestamp | Soft-deleted, ẩn hoàn toàn |

---

## 2. Tạo Cửa Hàng — Luồng Từng Bước

### Bước 1: Tên
- Chọn **loại cửa hàng** ở một khối riêng phía trên ô tên
- Loại hiển thị dạng nút chọn, mobile hiển thị **2 loại / 1 hàng**
- Mặc định loại = `Tạp hóa`
- Giá trị loại lấy từ `STORE_TYPE_OPTIONS` trong `lib/constants.js`
- Nút loại cửa hàng ở màn tạo dùng cùng icon meta với màn tìm kiếm (`getStoreTypeMeta()`)
- Bắt buộc nhập tên
- Tự động convert sang **Title Case VI** (`toTitleCaseVI()`)

### Bước 2: Thông Tin
- **Bắt buộc**: Quận/Huyện + Xã/Phường (từ danh sách `DISTRICT_WARD_SUGGESTIONS`)
- **Tùy chọn**: Địa chỉ chi tiết, SĐT 1, SĐT 2, Ghi chú
- SĐT: format VN (`0xxx` hoặc `+84xxx`, 9-10 số sau prefix)
- SĐT 2 chỉ hiển thị khi đã bắt đầu nhập SĐT 1
- Không cho phép SĐT 2 trùng với SĐT 1
- Khi bấm **Tiếp theo** ở bước 2, hệ thống mới chạy duplicate check chính
- Trong lúc check trùng ở bước 2, UI hiển thị **full-page loading** che toàn bộ form đang nhập
- Với **telesale** (không phải admin), có nhánh **Lưu cửa hàng ở bước 2** (không cần bước 3):
  - vẫn bắt buộc `Quận/Huyện` + `Xã/Phường`
  - **bắt buộc** `SĐT 1` hợp lệ
  - trước khi lưu phải hỏi xác nhận việc lưu cửa hàng **không có vị trí**
  - store được tạo với `latitude = null`, `longitude = null`
  - store mới tạo mặc định `is_potential = true` (theo role telesale)

### Bước 3: Kiểm Tra Trùng (chỉ xuất hiện khi có candidate)
- Màn tạo không còn UI step indicator; chỉ render nội dung của step hiện tại
- Step này chỉ xuất hiện khi duplicate check ở bước 2 hoặc lúc lưu cuối phát hiện candidate
- Danh sách nghi trùng vẫn hiển thị như flow cũ
- Candidate còn thiếu dữ liệu có thể mở flow **Bổ sung**
- Nhấn **Tiếp theo** để xác nhận vẫn tạo store mới

### Bước 4: Vị Trí
- Auto lấy GPS khi vào bước 4
- User có thể: kéo map / paste Google Maps link / lấy GPS mới
- Nếu là admin và đang dùng mobile, phần dán **Google Maps link** hiển thị mặc định ngay dưới bản đồ
- **Ưu tiên tọa độ**: edited map > GPS ban đầu > GPS hiện tại

### Khi Submit
1. Chạy validate dữ liệu cuối và duplicate check lại bằng cùng rule của bước 2 nếu chưa được người dùng xác nhận vượt qua
2. INSERT Supabase (`active = isAdmin`, lưu thêm `store_type`)
3. `appendStoreToCache(newStore)`
4. Ngoại lệ: nếu **Lưu luôn** ở bước 2 thì bỏ duplicate check cuối, vì người dùng đã xác nhận ở bước 2 và store chưa có vị trí

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
- `/map` có modal tuyến đường chung cho mobile/desktop; trên mobile modal ưu tiên chiều cao để không khuyết phần trên và nằm trên cụm nút điều hướng dưới cùng
- Trong modal tuyến đường, nút ẩn/hiện cửa hàng ngoài tuyến chỉ còn đặt bên trong modal
- Nút vị trí chỉ còn hành vi đưa về vị trí hiện tại, không hiển thị loading
- Nút hướng khi bật sẽ xoay bản đồ theo hướng người dùng, khóa kéo bản đồ, và giữ zoom hiện tại; khi tắt thì bản đồ trở về thao tác bình thường
- Vị trí và hướng người dùng trên `/map` được làm mới định kỳ mỗi 3 giây khi màn hình này đang mở
- Khi chế độ hướng bật, bản đồ phải bám tâm theo vị trí người dùng, không cho kéo lệch khỏi vị trí đó

**Bản đồ trong form (create/edit/supplement/report edit)**:
- Dùng chung `LocationPicker`/`StoreLocationPicker`.
- Luôn hiển thị thêm các cửa hàng lân cận quanh vị trí đang đứng (tâm pin hiện tại).
- Cách hiển thị marker lân cận tương tự màn `/map` (icon + nhãn), để người dùng dễ đối chiếu vị trí.
- Chỉ render tối đa **50 cửa hàng gần nhất** (đã lọc tọa độ hợp lệ).

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
- Nút gọi trên card/modal dùng chung cho mọi role:
  - nếu cửa hàng chỉ có 1 số thì gọi ngay
  - nếu cửa hàng có 2 số thì mở hộp chọn số để gọi
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

**Rule duplicate hiện tại**:
- `certain duplicate`: trùng chính xác ít nhất 1 số điện thoại với store đang có
- `possible duplicate`: cùng quận, và:
  - cùng xã, hoặc
  - xã lân cận theo draft map trong `helper/duplicateCheck.js`
  - đồng thời trùng ít nhất 1 từ có nghĩa trong tên sau khi lọc từ rác
- `address_detail` chỉ dùng để cộng điểm ưu tiên, không phải điều kiện bắt buộc để match
- Không dùng bán kính/khoảng cách để quyết định trùng
- Kết quả được sort ưu tiên: `certain` trước, rồi theo `duplicateScore`

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
- `role` chỉ lấy từ **app_metadata** của Supabase (server-managed), không dùng `user_metadata`
- Tài khoản không có role hợp lệ được xem là `guest` (không có quyền admin/telesale)

---

## 10. Xuất Dữ Liệu

- Màn export Excel/CSV phải xuất **tất cả cửa hàng đang có** (`deleted_at IS NULL`)
- File Excel/CSV **không phụ thuộc** cửa hàng có số điện thoại hay không
- File danh bạ `.vcf` vẫn chỉ xuất các cửa hàng có số điện thoại hợp lệ
- Khi tải dữ liệu export từ Supabase, cần đọc theo trang để không bị hụt bản ghi khi số lượng store lớn

---

## 11. Nhập Dữ Liệu

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

## 12. Quy Tắc Tiếng Việt & Dialog Xác Nhận

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
## 13. Tạo Store Theo Role

- Nếu người tạo là `telesale`, store mới được tạo trực tiếp trong `stores` sẽ mặc định có `is_potential = true`.
- Rule này áp dụng cho cả:
  - luồng tạo đủ 3 bước
  - nhánh lưu ở bước 2 (không có vị trí) dành cho telesale
- `guest` và `admin` giữ nguyên hành vi cũ, không tự bật `is_potential` chỉ vì vừa tạo store.
