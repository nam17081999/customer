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
├── app/                    # layout.js, globals.css (font-size 19px/21px)
├── pages/
│   ├── _app.js             # AuthProvider + Navbar + ErrorBoundary
│   ├── index.js            # Tìm kiếm (/)
│   ├── map.js              # Bản đồ MapLibre (/map)
│   ├── login.js            # Đăng nhập admin
│   ├── account.js          # Dashboard admin
│   └── store/
│       ├── create.js       # Form tạo store 3 bước
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
│   ├── store-detail-modal.jsx  # Modal chi tiết (controlled + uncontrolled)
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
│   ├── constants.js        # Hằng số, danh sách huyện/xã
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
