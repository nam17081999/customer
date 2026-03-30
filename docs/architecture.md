# 🏗️ Kiến Trúc Hệ Thống - StoreVis

## Tổng Quan

**StoreVis** là ứng dụng web quản lý và tra cứu cửa hàng tại Hà Nội. Hai nhóm người dùng:
- **User thường** (anonymous): tìm kiếm, xem bản đồ, thêm cửa hàng chờ duyệt
- **Admin** (đã đăng nhập): duyệt/xác thực, chỉnh sửa, xem dashboard

---

## Stack Công Nghệ

| Lớp | Công nghệ | Phiên bản |
|---|---|---|
| Framework | Next.js Pages Router | ^15.x, Turbopack |
| UI | React | 19.x |
| Styling | TailwindCSS v4 | ^4.x |
| Database + Auth | Supabase (PostgreSQL) | ^2.54 |
| Image CDN | ImageKit.io | ^6.x |
| Map (trang bản đồ) | MapLibre GL + OpenStreetMap | ^4.7 |
| Map (location picker) | Google Maps API | ^2.x |
| Virtual List | react-virtuoso | ^4.x |
| UI Primitives | Radix UI (Dialog, Slot) | ^1.x |
| Icons | lucide-react | ^0.539 |
| Node.js | — | 24.x |

---

## Cấu Trúc Thư Mục

```
customer/
├── .editorconfig           # UTF-8 + LF guardrail cho source/docs
├── app/                    # layout.js, globals.css (font-size 19px/21px)
├── pages/
│   ├── _app.js             # AuthProvider + Navbar + ErrorBoundary
│   ├── index.js            # Tìm kiếm (/)
│   ├── map.js              # Bản đồ MapLibre (/map)
│   ├── login.js            # Đăng nhập admin
│   ├── account.js          # Dashboard admin
│   └── store/
│       ├── create.js       # Form tạo store 3 bước
│       ├── import.js       # Nhập nhiều store từ file CSV + preview kiểm tra
│       ├── export.js       # Xuất CSV/VCF
│       ├── verify.js       # Duyệt store chờ xác thực
│       ├── reports.js      # Duyệt báo cáo cửa hàng
│       └── edit/[id].js    # Chỉnh sửa store
├── pages/api/
│   ├── upload-image.js     # POST/DELETE ảnh → ImageKit
│   ├── imagekit-auth.js    # GET auth token ImageKit
│   └── expand-maps-link.js # POST: mở rộng Google Maps shortlink
├── components/
│   ├── navbar.jsx          # Top nav (desktop) + bottom tab (mobile)
│   ├── search-store-card.jsx   # Card store trong danh sách tìm kiếm
│   ├── store-detail-modal.jsx  # Modal chi tiết + báo cáo + chuyển sang /map
│   ├── detail-store-card.jsx
│   ├── image-upload.jsx
│   ├── error-boundary.jsx
│   ├── map/                # location-picker, store-location-picker, google-location-picker
│   └── ui/                 # button, card, dialog, input, label, msg, toast, skeleton, full-page-loading
├── lib/
│   ├── supabaseClient.js   # Supabase client singleton
│   ├── AuthContext.js      # React Context: user, signIn, signOut
│   ├── storeCache.js       # 3-layer cache (memory → IDB → Supabase)
│   ├── imagekit.js         # SDK ImageKit server-side
│   ├── constants.js        # Hằng số, danh sách huyện/xã, loại cửa hàng
│   └── utils.js            # toTitleCaseVI, formatAddressParts, cn
└── helper/
    ├── distance.js         # haversineKm()
    ├── duplicateCheck.js   # Phát hiện store trùng tên
    ├── geolocation.js      # getBestPosition, requestCompassHeading
    ├── useGeolocation.js   # React hook geolocation
    ├── imageUtils.js       # getFullImageUrl, STORE_PLACEHOLDER_IMAGE
    ├── removeVietnameseTones.js
    └── validation.js       # isValidPhone, formatDistance, formatDate, v.v.
```

---

## Data Flow

```
[Supabase DB]
  ↕ fetch paginated (1000 rows), filter deleted_at IS NULL
[storeCache.js — 3 layers]
  1. In-memory (60s cooldown, promise dedup)
  2. IndexedDB storevis_cache
  3. Supabase (count + max updated_at check)
  ↕
[Pages: getOrRefreshStores()] → filter + sort client-side
  - Mặc định trang tìm kiếm: không có tiêu chí thì render 50 cửa hàng gần nhất
  - Trang `/` có bộ lọc chi tiết: quận/xã (single-select) + loại/độ lớn/chi tiết dữ liệu (multi-select)
  - `Chi tiết dữ liệu` trên `/`: hỗ trợ `Có số điện thoại`, `Có ảnh`, `Không có vị trí`
  - Vị trí người dùng ở `/` được refresh định kỳ mỗi 3 phút và khi quay lại tab/trang
  - Đồng bộ query của `/` lên URL phải có debounce + bỏ qua replace khi query không đổi để tránh flood navigation

[Admin export page: `/store/export`]
  - Không dùng cache public để xuất dữ liệu
  - Đọc trực tiếp Supabase với điều kiện `deleted_at IS NULL`
  - Fetch theo trang (`range`) để lấy đủ toàn bộ store cho CSV/VCF

[Admin import page: `/store/import`]
  - Đọc stores hiện có qua `getOrRefreshStores()` để kiểm tra nghi trùng trước khi nhập
  - Người dùng tải file mẫu `.csv`, điền đúng các cột chuẩn rồi tải lên lại
  - File import được parse và kiểm tra ngay trên client:
    - thiếu cột bắt buộc
    - sai loại cửa hàng / độ lớn cửa hàng
    - sai số điện thoại
    - tọa độ thiếu cặp hoặc không hợp lệ
    - trùng trong chính file
    - nghi trùng với hệ thống hiện có
  - Chỉ các dòng `ready` mới được insert; sau bulk import phải `invalidateStoreCache()` và dispatch `storevis:stores-changed`
```

**Sau mutation:**
- CREATE → `appendStoreToCache(newStore)`
- DELETE (soft) → `removeStoreFromCache(id)` + `invalidateStoreCache()`
- EDIT → `invalidateStoreCache()`
- Custom event `storevis:stores-changed` để sync giữa tabs

---

## Routing

| Route | Mô tả | Auth |
|---|---|---|
| `/` | Tìm kiếm | Public |
| `/map` | Bản đồ MapLibre | Public |
| `/store/create` | Tạo cửa hàng (3 bước) | Public |
| `/store/import` | Nhập nhiều cửa hàng từ file mẫu CSV | Admin |
| `/store/export` | Xuất dữ liệu cửa hàng | Admin |
| `/store/verify` | Duyệt cửa hàng chờ | Admin |
| `/store/reports` | Duyệt báo cáo cửa hàng | Admin |
| `/store/edit/[id]` | Chỉnh sửa | Admin |
| `/account` | Dashboard | Admin |
| `/login` | Đăng nhập | Public |

---

## API Routes

| Endpoint | Method | Chức năng |
|---|---|---|
| `/api/upload-image` | POST | Upload ảnh → ImageKit (private key) |
| `/api/upload-image` | DELETE | Xóa ảnh khỏi ImageKit |
| `/api/imagekit-auth` | GET | Token auth cho client-side |
| `/api/expand-maps-link` | POST | Mở rộng Google Maps short URL |

---

## Luồng Bản Đồ Công Khai

- Từ `StoreDetailModal`, người dùng có thể bấm nút **Bản đồ**
- App chuyển sang `/map?storeId=...&lat=...&lng=...`
- `/map` khởi tạo bản đồ ngay theo `lat/lng` trong query để giảm độ trễ cảm nhận
- Sau khi danh sách store tải xong, marker tương ứng sẽ được highlight
- Không tự mở modal chi tiết khi đi theo luồng này
- Trang `/map` có nút về vị trí GPS hiện tại ở góc phải dưới
- Trang `/map` hiển thị thêm source/layer riêng cho vị trí người dùng (blue dot)
- Trang `/map` lọc ngay từ lúc nạp dữ liệu: chỉ store có tọa độ hợp lệ mới được đưa vào state hiển thị bản đồ

---

## Luồng Bổ Sung Dữ Liệu

- Nếu store còn thiếu dữ liệu quan trọng (`store_type`, `store_size`, `address_detail`, `ward`, `district`, `phone`, `image_url`, hoặc vị trí):
  - `StoreDetailModal` hiển thị nút **Bổ sung**
  - duplicate panel ở bước 1 của `/store/create` cũng có thể hiển thị nút **Bổ sung**
- Nút này điều hướng sang `/store/edit/[id]?mode=supplement`
- Ở chế độ `supplement`:
  - luôn bắt đầu từ **bước 1**
  - dữ liệu đã có sẵn bị khóa, không cho chỉnh sửa
  - chỉ cho nhập phần còn thiếu
  - nếu store chưa có vị trí thì flow có **3 bước**
  - nếu store đã có vị trí thì flow chỉ còn **2 bước**, bước 2 hoàn thành luôn
  - khi vào bước 3 của store chưa có vị trí, trang sẽ tự gọi GPS một lần
  - admin đã đăng nhập có thể cập nhật trực tiếp `stores`
  - người chưa đăng nhập vẫn mở được supplement flow nhưng submit sẽ tạo `store_reports` để admin duyệt

---

## Create Flow Mở Rộng

- Ở bước 2 của `/store/create` có thêm nhánh **Lưu luôn**
- Nhánh này dùng cho store chưa có vị trí:
  - vẫn bắt buộc `quận/huyện`, `xã/phường`
  - bắt buộc thêm `số điện thoại` hợp lệ
  - yêu cầu xác nhận trước khi lưu vì store sẽ không có `latitude/longitude`
- Trong duplicate panel của bước 1:
  - candidate còn thiếu dữ liệu có thể hiện nút **Bổ sung**
  - nút này chuyển sang `/store/edit/[id]?mode=supplement`

---

## Biến Môi Trường

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY=
IMAGEKIT_PRIVATE_KEY=           # Server-side only!
NEXT_PUBLIC_IMAGE_BASE_URL=     # https://ik.imagekit.io/customer69/
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
```

---

## Lưu Ý Bảo Mật

- `IMAGEKIT_PRIVATE_KEY` chỉ ở server (pages/api)
- **⚠️ Cần verify RLS Supabase** để user thường không UPDATE/DELETE
- Soft delete: dùng `deleted_at`, không DELETE SQL

---

## Encoding & Admin Dialogs

- Source/docs có tiếng Việt phải được giữ ở `UTF-8`; repo dùng `.editorconfig` để giảm lỗi encoding giữa editor/tool khác nhau.
- Khi sửa text tiếng Việt, ưu tiên patch cục bộ thay vì rewrite cả file.
- Các dialog xác nhận ở màn admin phải dùng đúng primitive accessibility của Radix:
  - `DialogTitle`
  - `DialogDescription`
- Rule này áp dụng rõ cho:
  - `/store/verify`
  - `/store/reports`
