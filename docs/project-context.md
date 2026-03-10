# 🗺️ Project Context - StoreVis

## Đây là gì?

**StoreVis** là ứng dụng web tra cứu và quản lý danh sách **cửa hàng** (tạp hóa, quán nước, quán ăn, v.v.) tại một số huyện ngoại thành Hà Nội.

**Mục tiêu chính:**
- Giúp người dùng tìm kiếm cửa hàng theo tên, quận, xã
- Hiển thị vị trí cửa hàng trên bản đồ
- Cho phép bất kỳ ai thêm cửa hàng mới (chờ admin duyệt)
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
Trang chủ (/) → Tìm kiếm theo tên/quận/xã
→ Click card → xem chi tiết (modal)
→ Báo cáo cửa hàng (từ modal)
→ Xem bản đồ (/map)
→ Thêm cửa hàng (/store/create) → chờ duyệt
```

### Admin (đã đăng nhập)
```
Đăng nhập (/login)
→ Dashboard (/account) → Duyệt stores (/store/verify)
→ Duyệt báo cáo cửa hàng (/store/reports)
→ Sửa store (/store/edit/[id])
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
| `pages/store/reports.js` | Admin duyệt báo cáo cửa hàng |
| `pages/map.js` | Bản đồ MapLibre, custom markers |
| `pages/index.js` | Tìm kiếm local với scoring |
| `components/store-detail-modal.jsx` | Modal chi tiết + báo cáo cửa hàng |

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

## 11 Điều Cần Biết Khi Code

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
