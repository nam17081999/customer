# 🗺️ Project Context - StoreVis

## Đây là gì?

**StoreVis** là ứng dụng web tra cứu và quản lý danh sách **cửa hàng** (tạp hóa, quán nước, quán ăn, v.v.) tại một số huyện ngoại thành Hà Nội.

**Mục tiêu chính:**
- Giúp người dùng tìm kiếm cửa hàng theo tên, quận, xã, loại và mức độ đầy đủ dữ liệu
- Hiển thị vị trí cửa hàng trên bản đồ
- Cho phép bất kỳ ai thêm cửa hàng mới (chờ admin duyệt)
- Telesale theo dõi danh sách cần gọi và cập nhật kết quả gọi
- Admin duyệt/quản lý danh sách, xem dashboard tổng quan

**Đối tượng sử dụng**: app dành cho người có thể bị mắt kém → yêu cầu font lớn, tương phản cao.

---

## Tên Hệ Thống

- **App name**: StoreVis
- **Database table**: `stores`, `store_reports`
- **IDB cache name**: `storevis_cache`

---

## Luồng Chính

### User thường (không đăng nhập)
```
Trang chủ (/) → Tìm kiếm theo tên + bộ lọc chi tiết
→ Click card → xem chi tiết (modal)
→ Báo cáo cửa hàng (từ modal)
→ Xem bản đồ (/map)
→ Thêm cửa hàng (/store/create) → chờ duyệt
```

### Telesale (đã đăng nhập)
```
Đăng nhập (/login)
→ Dashboard (/account)
→ Xem danh sách ưu tiên gọi (/telesale/overview)
→ Gọi khách hàng → chốt kết quả (/telesale/call/[id])
```

### Admin (đã đăng nhập)
```
Đăng nhập (/login)
→ Dashboard (/account) → Duyệt stores (/store/verify)
→ Màn telesale (/telesale/overview)
→ Nhập dữ liệu (/store/import)
→ Xuất dữ liệu (/store/export)
→ Duyệt báo cáo cửa hàng (/store/reports)
→ Sửa store (/store/edit/[id])
→ Bổ sung dữ liệu còn thiếu cho store (`/store/edit/[id]?mode=supplement`, public cũng mở được)
→ Thêm store → active ngay
```

---

## Các File Quan Trọng Nhất

| File | Vai trò |
|---|---|
| `lib/storeCache.js` | Cache trung tâm — đọc/ghi/invalidate |
| `lib/constants.js` | Danh sách huyện/xã cố định |
| `helper/duplicateCheck.js` | Phát hiện cửa hàng trùng tên |
| `helper/geolocation.js` | Lấy GPS, compass |
| `pages/store/create.js` | Form tạo cửa hàng 3 bước |
| `pages/store/edit/[id].js` | Chỉnh sửa store + chế độ `supplement` theo step để chỉ bổ sung dữ liệu còn thiếu |
| `pages/store/import.js` | Nhập nhiều store từ CSV mẫu, preview lỗi và nghi trùng trước khi insert |
| `pages/store/export.js` | Xuất CSV toàn bộ store đang có + VCF theo số điện thoại |
| `pages/store/reports.js` | Admin duyệt báo cáo cửa hàng |
| `pages/telesale/overview.js` | Danh sách ưu tiên gọi + thống kê telesale |
| `pages/telesale/call/[id].js` | Màn riêng để chốt kết quả cuộc gọi |
| `pages/map.js` | Bản đồ MapLibre, custom markers, focus theo query, nút về GPS, chấm xanh vị trí hiện tại, sidebar lọc |
| `pages/index.js` | Tìm kiếm local với scoring, bộ lọc chi tiết, refresh vị trí định kỳ, filter `Không có vị trí` |
| `components/navbar.jsx` | Top nav desktop tối giản + bottom tab mobile |
| `components/store-detail-modal.jsx` | Modal chi tiết + báo cáo + nút chuyển sang /map + loại cửa hàng phía trên tên + nút `Bổ sung` |
| `lib/authz.js` | Helpers quyền theo `role` để ẩn/hiện hành động đúng vai trò |

---

## Phụ Thuộc Ngoại Vi

| Service | Dùng cho | Biến env |
|---|---|---|
| Supabase | Database + Auth | `NEXT_PUBLIC_SUPABASE_URL`, `ANON_KEY` |
| ImageKit.io | CDN ảnh | `NEXT_PUBLIC_IMAGE_BASE_URL`, public/private key |
| Google Maps API | Location picker (create/edit form) | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` |
| OpenStreetMap | Tile bản đồ (/map) | Không cần key |

---

## Phạm Vi Địa Lý

6 huyện tại Hà Nội: **Hoài Đức, Đan Phượng, Phúc Thọ, Bắc Từ Liêm, Nam Từ Liêm, Quốc Oai**.
Danh sách xã/phường cố định trong `lib/constants.js`.

---

## 21 Điều Cần Biết Khi Code

1. **Không gọi Supabase trực tiếp để đọc stores** — luôn qua `getOrRefreshStores()`
2. **`image_url` là tên file**, không phải URL — full URL = `BASE_URL + image_url`
3. **Soft delete** — dùng `deleted_at`, không bao giờ `DELETE` query
4. **`active = true`** chỉ khi admin tạo hoặc admin duyệt
5. **Không có cột `name_search`** trong DB — không thêm field này khi insert
6. **Pages Router** — file đặt trong `pages/`, không phải `app/`
7. **TailwindCSS v4** — cú pháp `@import "tailwindcss"` trong globals.css
8. **Dark mode**: Ứng dụng chạy **Dark Mode duy nhất**. Không có Light Mode.
9. **MapTheme**: Trang bản đồ dùng bộ lọc tối (`.dark-map-filter`). Riêng các form nhập liệu (`create/edit`) dùng bản đồ **Sáng** (`dark={false}`) để nhìn lộ trình rõ hơn.
10. **Font tối thiểu `text-base` (16px)** — app cho người mắt kém, không dùng `text-xs`/`text-[11px]` cho thông tin quan trọng.
11. **Bản đồ quay theo hướng**: Cần gọi `requestCompassHeading()` TRƯỚC `await` trong hàm xử lý click/thao tác thì mới qua được quyền User Gesture của iOS/Safari.
12. **Trang `/` có bộ lọc chi tiết**: quận/xã là single-select; loại/có SĐT/có ảnh/không có vị trí là multi-select.
13. **Trang `/` tự làm mới GPS**: vào trang, sau mỗi 3 phút, và khi quay lại tab/trang.
14. **Trang `/map` có chấm xanh vị trí hiện tại** ngoài marker cửa hàng, và không hiển thị store không có tọa độ.
15. **`/store/create` bước 2 có nhánh `Lưu luôn`**: bắt buộc phone hợp lệ, cho phép lưu store chưa có vị trí, có confirm trước khi lưu.
16. **`/store/create` bước 1-2**: bước 1 đã lấy GPS để check trùng; kết quả này được dùng để prefill quận/huyện + xã/phường của cửa hàng gần nhất trong nền trước khi sang bước 2.
17. **Duplicate check**: store không có tọa độ vẫn có thể xuất hiện ở match toàn hệ thống nhưng không được có `distance` giả.
18. **Duplicate panel**: candidate còn thiếu dữ liệu có thể có nút `Bổ sung` để mở `/store/edit/[id]?mode=supplement`.
19. **`/store/edit/[id]?mode=supplement`**: luôn bắt đầu từ bước 1, khóa dữ liệu đã có, chỉ cho nhập phần thiếu; nếu store đã có vị trí thì flow chỉ còn 2 bước, nếu chưa có vị trí thì bước 3 sẽ tự lấy GPS một lần; người chưa đăng nhập gửi `store_report`, admin thì cập nhật trực tiếp.
20. **Layout desktop**: dùng `scrollbar-gutter: stable` để tránh xê dịch khi chuyển giữa trang có/không có scrollbar.
21. **`/store/import`**: dùng file mẫu CSV, parse ở client và preview theo từng dòng trước khi insert; không import thẳng file chưa qua kiểm tra.
22. **Bulk import**: chỉ insert các dòng `ready`; xong phải cập nhật cache local hoặc fallback `invalidateStoreCache()`, rồi dispatch `storevis:stores-changed`.
23. **Role hiện tại**: `guest`, `telesale`, `admin`; `telesale/admin` vào được `/account` và `/telesale/overview`, còn `admin` mới có các màn quản trị dữ liệu.
24. **Telesale queue**: chỉ lấy store `is_potential` có `phone`; ưu tiên riêng cho store đã gọi nhưng chưa cập nhật kết quả trong vòng 30 phút, dùng `last_call_result_at` để phân biệt.

---

## Convention & Naming

| Thành phần | Convention |
|---|---|
| Tên cửa hàng | Title Case tiếng Việt (`toTitleCaseVI()`) |
| Địa chỉ | Title Case (ward, district, address_detail) |
| File component | kebab-case `.jsx` |
| File page/lib/helper | kebab-case hoặc camelCase `.js` |
| Custom event | `storevis:stores-changed` |
| IDB database (cache) | `storevis_cache` |
| Editor config | `.editorconfig` (UTF-8, LF) |

---

## Guardrail Tiếng Việt

- Repo có `.editorconfig` để ép mặc định `UTF-8` và `LF`.
- Khi sửa file có tiếng Việt, ưu tiên patch nhỏ thay vì rewrite cả file.
- Không dùng cách ghi file dễ làm vỡ encoding nếu chưa kiểm soát rõ đầu ra.
- Không kết luận file hỏng chỉ vì terminal Windows hiển thị sai dấu; cần đối chiếu thêm bằng `git diff` hoặc UI thực tế.
- Hai màn admin dễ lộ lỗi tiếng Việt ra UI là:
  - `/store/verify`
  - `/store/reports`

---

## Telesale Minimal DB Update

Ban toi gian cho telesale su dung 6 cot tren `stores`:

- `is_potential`
- `last_called_at`
- `last_call_result`
- `last_call_result_at`
- `last_order_reported_at`
- `sales_note`

Màn telesale đang dùng route:

- `/telesale/overview`
- `/telesale/call/[id]`

Script SQL cap nhat moi truong duoc luu tai:

- `docs/sql/2026-04-01-add-store-telesale-columns.sql`
