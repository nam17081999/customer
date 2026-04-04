# ðŸ—ï¸ Kiáº¿n TrÃºc Há»‡ Thá»‘ng - StoreVis

## Tá»•ng Quan

**StoreVis** lÃ  á»©ng dá»¥ng web quáº£n lÃ½ vÃ  tra cá»©u cá»­a hÃ ng táº¡i HÃ  Ná»™i. Ba nhÃ³m ngÆ°á»i dÃ¹ng:
- **User thÆ°á»ng** (anonymous): tÃ¬m kiáº¿m, xem báº£n Ä‘á»“, thÃªm cá»­a hÃ ng chá» duyá»‡t, bÃ¡o cÃ¡o/bá»• sung dá»¯ liá»‡u
- **Telesale** (Ä‘Ã£ Ä‘Äƒng nháº­p): theo dÃµi danh sÃ¡ch cáº§n gá»i, cáº­p nháº­t káº¿t quáº£ gá»i
- **Admin** (Ä‘Ã£ Ä‘Äƒng nháº­p): lÃ m toÃ n bá»™ viá»‡c cá»§a telesale vÃ  quáº£n trá»‹ dá»¯ liá»‡u

---

## Stack CÃ´ng Nghá»‡

| Lá»›p | CÃ´ng nghá»‡ | PhiÃªn báº£n |
|---|---|---|
| Framework | Next.js Pages Router | ^15.x, Turbopack |
| UI | React | 19.x |
| Styling | TailwindCSS v4 | ^4.x |
| Database + Auth | Supabase (PostgreSQL) | ^2.54 |
| Image CDN | ImageKit.io | ^6.x |
| Map (trang báº£n Ä‘á»“) | MapLibre GL + OpenStreetMap | ^4.7 |
| Map (location picker) | Google Maps API | ^2.x |
| Virtual List | react-virtuoso | ^4.x |
| UI Primitives | Radix UI (Dialog, Slot) | ^1.x |
| Icons | lucide-react | ^0.539 |
| Node.js | â€” | 24.x |

---

## Cáº¥u TrÃºc ThÆ° Má»¥c

```
customer/
â”œâ”€â”€ .editorconfig           # UTF-8 + LF guardrail cho source/docs
â”œâ”€â”€ app/                    # layout.js, globals.css (font-size 19px/21px)
â”œâ”€â”€ pages/
â”‚   â”œâ”€â”€ _app.js             # AuthProvider + Navbar + ErrorBoundary
â”‚   â”œâ”€â”€ index.js            # TÃ¬m kiáº¿m (/)
â”‚   â”œâ”€â”€ map.js              # Báº£n Ä‘á»“ MapLibre (/map)
â”‚   â”œâ”€â”€ login.js            # ÄÄƒng nháº­p
â”‚   â”œâ”€â”€ account.js          # Dashboard tÃ i khoáº£n
â”‚   â”œâ”€â”€ telesale/
â”‚   â”‚   â”œâ”€â”€ overview.js     # Danh sÃ¡ch gá»i + tá»•ng quan telesale
â”‚   â”‚   â””â”€â”€ call/[id].js    # MÃ n chá»‘t káº¿t quáº£ gá»i
â”‚   â””â”€â”€ store/
â”‚       â”œâ”€â”€ create.js       # Form táº¡o store 3 bÆ°á»›c
â”‚       â”œâ”€â”€ import.js       # Nháº­p nhiá»u store tá»« file CSV + preview kiá»ƒm tra
â”‚       â”œâ”€â”€ export.js       # Xuáº¥t CSV/VCF
â”‚       â”œâ”€â”€ verify.js       # Duyá»‡t store chá» xÃ¡c thá»±c
â”‚       â”œâ”€â”€ reports.js      # Duyá»‡t bÃ¡o cÃ¡o cá»­a hÃ ng
â”‚       â””â”€â”€ edit/[id].js    # Chá»‰nh sá»­a store
â”œâ”€â”€ pages/api/
â”‚   â”œâ”€â”€ upload-image.js     # POST/DELETE áº£nh â†’ ImageKit
â”‚   â”œâ”€â”€ imagekit-auth.js    # GET auth token ImageKit
â”‚   â””â”€â”€ expand-maps-link.js # POST: má»Ÿ rá»™ng Google Maps shortlink
â”œâ”€â”€ components/
â”‚   â”œâ”€â”€ navbar.jsx          # Top nav (desktop) + bottom tab (mobile)
â”‚   â”œâ”€â”€ search-store-card.jsx   # Card store trong danh sÃ¡ch tÃ¬m kiáº¿m
â”‚   â”œâ”€â”€ store-detail-modal.jsx  # Modal chi tiáº¿t + bÃ¡o cÃ¡o + chuyá»ƒn sang /map
â”‚   â”œâ”€â”€ detail-store-card.jsx
â”‚   â”œâ”€â”€ image-upload.jsx
â”‚   â”œâ”€â”€ error-boundary.jsx
â”‚   â”œâ”€â”€ map/                # location-picker, store-location-picker, google-location-picker
â”‚   â””â”€â”€ ui/                 # button, card, dialog, input, label, msg, toast, skeleton, full-page-loading
â”œâ”€â”€ lib/
â”‚   â”œâ”€â”€ supabaseClient.js   # Supabase client singleton
â”‚   â”œâ”€â”€ AuthContext.js      # React Context: user, signIn, signOut, role
â”‚   â”œâ”€â”€ authz.js            # Helpers phÃ¢n quyá»n `admin` / `telesale`
â”‚   â”œâ”€â”€ storeCache.js       # 3-layer cache (memory â†’ IDB â†’ Supabase)
â”‚   â”œâ”€â”€ imagekit.js         # SDK ImageKit server-side
â”‚   â”œâ”€â”€ constants.js        # Háº±ng sá»‘, danh sÃ¡ch huyá»‡n/xÃ£, loáº¡i cá»­a hÃ ng
â”‚   â””â”€â”€ utils.js            # toTitleCaseVI, formatAddressParts, cn
â””â”€â”€ helper/
    â”œâ”€â”€ distance.js         # haversineKm()
    â”œâ”€â”€ duplicateCheck.js   # PhÃ¡t hiá»‡n store trÃ¹ng tÃªn
    â”œâ”€â”€ geolocation.js      # getBestPosition, requestCompassHeading
    â”œâ”€â”€ useGeolocation.js   # React hook geolocation
    â”œâ”€â”€ imageUtils.js       # getFullImageUrl, STORE_PLACEHOLDER_IMAGE
    â”œâ”€â”€ removeVietnameseTones.js
    â””â”€â”€ validation.js       # isValidPhone, formatDistance, formatDate, v.v.
```

---

## Data Flow

```
[Supabase DB]
  â†• fetch paginated (1000 rows), filter deleted_at IS NULL
[storeCache.js â€” 3 layers]
  1. In-memory (60s cooldown, promise dedup)
  2. IndexedDB storevis_cache
  3. Supabase (count + max updated_at check)
  â†•
[Pages: getOrRefreshStores()] â†’ filter + sort client-side
  - Máº·c Ä‘á»‹nh trang tÃ¬m kiáº¿m: khÃ´ng cÃ³ tiÃªu chÃ­ thÃ¬ render toÃ n bá»™ cá»­a hÃ ng, sort gáº§n â†’ xa
  - Trang `/` cÃ³ bá»™ lá»c chi tiáº¿t: quáº­n/xÃ£ (single-select) + loáº¡i/chi tiáº¿t dá»¯ liá»‡u (multi-select)
  - `Chi tiáº¿t dá»¯ liá»‡u` trÃªn `/`: há»— trá»£ `CÃ³ sá»‘ Ä‘iá»‡n thoáº¡i`, `CÃ³ áº£nh`, `KhÃ´ng cÃ³ vá»‹ trÃ­`
  - Vá»‹ trÃ­ ngÆ°á»i dÃ¹ng á»Ÿ `/` Ä‘Æ°á»£c refresh Ä‘á»‹nh ká»³ má»—i 3 phÃºt vÃ  khi quay láº¡i tab/trang
  - Äá»“ng bá»™ query cá»§a `/` lÃªn URL pháº£i cÃ³ debounce + bá» qua replace khi query khÃ´ng Ä‘á»•i Ä‘á»ƒ trÃ¡nh flood navigation

[Telesale]
  - `/telesale/overview` chá»‰ láº¥y store cÃ³ `phone` vÃ  `is_potential = true`
  - Æ¯u tiÃªn gá»i sáº¯p theo:
    1. store chÆ°a gá»i
    2. store Ä‘Ã£ gá»i nhÆ°ng chÆ°a cáº­p nháº­t káº¿t quáº£ trong vÃ²ng 30 phÃºt
    3. `goi_lai_sau`
    4. `khong_nghe`
    5. `con_hang`
    6. `da_len_don`
  - `con_hang` chá»‰ quay láº¡i danh sÃ¡ch Æ°u tiÃªn khi káº¿t quáº£ Ä‘Ã³ Ä‘Ã£ quÃ¡ 2 ngÃ y
  - `da_len_don` chá»‰ quay láº¡i danh sÃ¡ch Æ°u tiÃªn khi Ä‘Ã£ quÃ¡ 3 ngÃ y
  - `last_call_result_at` dÃ¹ng Ä‘á»ƒ phÃ¢n biá»‡t cuá»™c gá»i Ä‘Ã£ Ä‘Æ°á»£c chá»‘t káº¿t quáº£ hay chÆ°a

[Admin export page: `/store/export`]
  - KhÃ´ng dÃ¹ng cache public Ä‘á»ƒ xuáº¥t dá»¯ liá»‡u
  - Äá»c trá»±c tiáº¿p Supabase vá»›i Ä‘iá»u kiá»‡n `deleted_at IS NULL`
  - Fetch theo trang (`range`) Ä‘á»ƒ láº¥y Ä‘á»§ toÃ n bá»™ store cho CSV/VCF

[Admin import page: `/store/import`]
  - Äá»c stores hiá»‡n cÃ³ qua `getOrRefreshStores()` Ä‘á»ƒ kiá»ƒm tra nghi trÃ¹ng trÆ°á»›c khi nháº­p
  - NgÆ°á»i dÃ¹ng táº£i file máº«u `.csv`, Ä‘iá»n Ä‘Ãºng cÃ¡c cá»™t chuáº©n rá»“i táº£i lÃªn láº¡i
  - File import Ä‘Æ°á»£c parse vÃ  kiá»ƒm tra ngay trÃªn client:
    - thiáº¿u cá»™t báº¯t buá»™c
    - sai loáº¡i cá»­a hÃ ng
    - sai sá»‘ Ä‘iá»‡n thoáº¡i
    - tá»a Ä‘á»™ thiáº¿u cáº·p hoáº·c khÃ´ng há»£p lá»‡
    - trÃ¹ng trong chÃ­nh file
    - nghi trÃ¹ng vá»›i há»‡ thá»‘ng hiá»‡n cÃ³
  - Náº¿u má»™t dÃ²ng nghi trÃ¹ng trong há»‡ thá»‘ng, UI cho chá»n:
    - `Táº¡o má»›i`
    - hoáº·c chá»n má»™t store nghi trÃ¹ng cá»¥ thá»ƒ rá»“i chá»n `Giá»¯ dá»¯ liá»‡u cÅ©` / `Láº¥y dá»¯ liá»‡u má»›i`
  - Khi update store nghi trÃ¹ng:
    - field chá»‰ cÃ³ á»Ÿ má»™t bÃªn thÃ¬ váº«n Ä‘Æ°á»£c giá»¯ láº¡i
    - field cÃ³ á»Ÿ cáº£ hai bÃªn thÃ¬ theo lá»±a chá»n `Giá»¯ dá»¯ liá»‡u cÅ©` / `Láº¥y dá»¯ liá»‡u má»›i`
  - Chá»‰ cÃ¡c dÃ²ng `ready` má»›i Ä‘Æ°á»£c xá»­ lÃ½; sau bulk import pháº£i cáº­p nháº­t cache local hoáº·c fallback `invalidateStoreCache()`, rá»“i dispatch `storevis:stores-changed`
```

**Sau mutation:**
- CREATE â†’ `appendStoreToCache(newStore)` hoáº·c `appendStoresToCache(newStores)`
- DELETE (soft) â†’ `removeStoreFromCache(id)`
- EDIT / verify / report-apply / telesale update â†’ `updateStoreInCache()` hoáº·c `updateStoresInCache()`
- Chá»‰ fallback sang `invalidateStoreCache()` khi khÃ´ng thá»ƒ merge local an toÃ n
- Custom event `storevis:stores-changed` Ä‘á»ƒ sync giá»¯a tabs

---

## Routing

| Route | MÃ´ táº£ | Auth |
|---|---|---|
| `/` | TÃ¬m kiáº¿m | Public |
| `/map` | Báº£n Ä‘á»“ MapLibre | Public |
| `/store/create` | Táº¡o cá»­a hÃ ng (3 bÆ°á»›c) | Public |
| `/telesale/overview` | Danh sÃ¡ch gá»i vÃ  tá»•ng quan telesale | Telesale/Admin |
| `/telesale/call/[id]` | MÃ n cáº­p nháº­t káº¿t quáº£ gá»i | Telesale/Admin |
| `/store/import` | Nháº­p nhiá»u cá»­a hÃ ng tá»« file máº«u CSV | Admin |
| `/store/export` | Xuáº¥t dá»¯ liá»‡u cá»­a hÃ ng | Admin |
| `/store/verify` | Duyá»‡t cá»­a hÃ ng chá» | Admin |
| `/store/reports` | Duyá»‡t bÃ¡o cÃ¡o cá»­a hÃ ng | Admin |
| `/store/edit/[id]` | Chá»‰nh sá»­a / bá»• sung | Admin, public trong `mode=supplement` |
| `/account` | Dashboard tÃ i khoáº£n | Telesale/Admin |
| `/login` | ÄÄƒng nháº­p | Public |

---

## API Routes

| Endpoint | Method | Chá»©c nÄƒng |
|---|---|---|
| `/api/upload-image` | POST | Upload áº£nh â†’ ImageKit (private key) |
| `/api/upload-image` | DELETE | XÃ³a áº£nh khá»i ImageKit |
| `/api/imagekit-auth` | GET | Token auth cho client-side |
| `/api/expand-maps-link` | POST | Má»Ÿ rá»™ng Google Maps short URL |

---

## Luá»“ng Báº£n Äá»“ CÃ´ng Khai

- Tá»« `StoreDetailModal`, ngÆ°á»i dÃ¹ng cÃ³ thá»ƒ báº¥m nÃºt **Báº£n Ä‘á»“**
- App chuyá»ƒn sang `/map?storeId=...&lat=...&lng=...`
- `/map` khá»Ÿi táº¡o báº£n Ä‘á»“ ngay theo `lat/lng` trong query Ä‘á»ƒ giáº£m Ä‘á»™ trá»… cáº£m nháº­n
- Sau khi danh sÃ¡ch store táº£i xong, marker tÆ°Æ¡ng á»©ng sáº½ Ä‘Æ°á»£c highlight
- KhÃ´ng tá»± má»Ÿ modal chi tiáº¿t khi Ä‘i theo luá»“ng nÃ y
- Trang `/map` cÃ³ nÃºt vá» vá»‹ trÃ­ GPS hiá»‡n táº¡i á»Ÿ gÃ³c pháº£i dÆ°á»›i
- Trang `/map` hiá»ƒn thá»‹ thÃªm source/layer riÃªng cho vá»‹ trÃ­ ngÆ°á»i dÃ¹ng (blue dot)
- Trang `/map` lá»c ngay tá»« lÃºc náº¡p dá»¯ liá»‡u: chá»‰ store cÃ³ tá»a Ä‘á»™ há»£p lá»‡ má»›i Ä‘Æ°á»£c Ä‘Æ°a vÃ o state hiá»ƒn thá»‹ báº£n Ä‘á»“

---

## Luá»“ng Bá»• Sung Dá»¯ Liá»‡u

- Náº¿u store cÃ²n thiáº¿u dá»¯ liá»‡u quan trá»ng (`store_type`, `address_detail`, `ward`, `district`, `phone`, `image_url`, hoáº·c vá»‹ trÃ­):
  - `StoreDetailModal` hiá»ƒn thá»‹ nÃºt **Bá»• sung**
  - duplicate panel á»Ÿ bÆ°á»›c 1 cá»§a `/store/create` cÅ©ng cÃ³ thá»ƒ hiá»ƒn thá»‹ nÃºt **Bá»• sung**
- NÃºt nÃ y Ä‘iá»u hÆ°á»›ng sang `/store/edit/[id]?mode=supplement`
- á»ž cháº¿ Ä‘á»™ `supplement`:
  - luÃ´n báº¯t Ä‘áº§u tá»« **bÆ°á»›c 1**
  - dá»¯ liá»‡u Ä‘Ã£ cÃ³ sáºµn bá»‹ khÃ³a, khÃ´ng cho chá»‰nh sá»­a
  - chá»‰ cho nháº­p pháº§n cÃ²n thiáº¿u
  - náº¿u store chÆ°a cÃ³ vá»‹ trÃ­ thÃ¬ flow cÃ³ **3 bÆ°á»›c**
  - náº¿u store Ä‘Ã£ cÃ³ vá»‹ trÃ­ thÃ¬ flow chá»‰ cÃ²n **2 bÆ°á»›c**, bÆ°á»›c 2 hoÃ n thÃ nh luÃ´n
  - khi vÃ o bÆ°á»›c 3 cá»§a store chÆ°a cÃ³ vá»‹ trÃ­, trang sáº½ tá»± gá»i GPS má»™t láº§n
  - admin Ä‘Ã£ Ä‘Äƒng nháº­p cÃ³ thá»ƒ cáº­p nháº­t trá»±c tiáº¿p `stores`
  - ngÆ°á»i chÆ°a Ä‘Äƒng nháº­p váº«n má»Ÿ Ä‘Æ°á»£c supplement flow nhÆ°ng submit sáº½ táº¡o `store_reports` Ä‘á»ƒ admin duyá»‡t

---

## Create Flow Má»Ÿ Rá»™ng

- á»ž bÆ°á»›c 2 cá»§a `/store/create` cÃ³ thÃªm nhÃ¡nh **LÆ°u luÃ´n**
- NhÃ¡nh nÃ y dÃ¹ng cho store chÆ°a cÃ³ vá»‹ trÃ­:
  - váº«n báº¯t buá»™c `quáº­n/huyá»‡n`, `xÃ£/phÆ°á»ng`
  - báº¯t buá»™c thÃªm `sá»‘ Ä‘iá»‡n thoáº¡i` há»£p lá»‡
  - yÃªu cáº§u xÃ¡c nháº­n trÆ°á»›c khi lÆ°u vÃ¬ store sáº½ khÃ´ng cÃ³ `latitude/longitude`
- Khi bÆ°á»›c 1 Ä‘Ã£ cÃ³ GPS Ä‘á»ƒ kiá»ƒm tra trÃ¹ng, app sáº½ prefetch quáº­n/huyá»‡n + xÃ£/phÆ°á»ng cá»§a store gáº§n nháº¥t trong ná»n, báº¥t ká»ƒ káº¿t quáº£ trÃ¹ng hay khÃ´ng trÃ¹ng, Ä‘á»ƒ bÆ°á»›c 2 cÃ³ thá»ƒ hiá»ƒn thá»‹ ngay náº¿u 2 field cÃ²n trá»‘ng
- Trong duplicate panel cá»§a bÆ°á»›c 1:
  - candidate cÃ²n thiáº¿u dá»¯ liá»‡u cÃ³ thá»ƒ hiá»‡n nÃºt **Bá»• sung**
  - nÃºt nÃ y chuyá»ƒn sang `/store/edit/[id]?mode=supplement`

---

## Biáº¿n MÃ´i TrÆ°á»ng

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY=
IMAGEKIT_PRIVATE_KEY=           # Server-side only!
NEXT_PUBLIC_IMAGE_BASE_URL=     # https://ik.imagekit.io/customer69/
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
```

---

## LÆ°u Ã Báº£o Máº­t

- `IMAGEKIT_PRIVATE_KEY` chá»‰ á»Ÿ server (pages/api)
- **âš ï¸ Cáº§n verify RLS Supabase** Ä‘á»ƒ user thÆ°á»ng khÃ´ng UPDATE/DELETE
- Soft delete: dÃ¹ng `deleted_at`, khÃ´ng DELETE SQL

---

## Encoding & Admin Dialogs

- Source/docs cÃ³ tiáº¿ng Viá»‡t pháº£i Ä‘Æ°á»£c giá»¯ á»Ÿ `UTF-8`; repo dÃ¹ng `.editorconfig` Ä‘á»ƒ giáº£m lá»—i encoding giá»¯a editor/tool khÃ¡c nhau.
- Khi sá»­a text tiáº¿ng Viá»‡t, Æ°u tiÃªn patch cá»¥c bá»™ thay vÃ¬ rewrite cáº£ file.
- CÃ¡c dialog xÃ¡c nháº­n á»Ÿ mÃ n admin pháº£i dÃ¹ng Ä‘Ãºng primitive accessibility cá»§a Radix:
  - `DialogTitle`
  - `DialogDescription`
- Rule nÃ y Ã¡p dá»¥ng rÃµ cho:
  - `/store/verify`
  - `/store/reports`

---

## Search State Persistence

- Trang `/` đồng bộ trạng thái tìm kiếm lên URL qua query params: `q`, `district`, `ward`, `types`, `flags`.
- Khi người dùng rời trang rồi bấm lại tab `Tìm kiếm`, navbar đọc `sessionStorage['storevis:last-search-route']` để quay lại đúng URL tìm kiếm gần nhất thay vì quay về `/` rỗng.
- Trên trang `/`, khi người dùng đổi text tìm kiếm hoặc đổi bộ lọc, danh sách kết quả sẽ tự cuộn về đầu bằng `react-virtuoso` để tránh giữ nguyên vị trí cuộn cũ.
- Logic này chỉ áp dụng khi tiêu chí tìm kiếm thay đổi, không tự cuộn lại khi dữ liệu store đồng bộ nền.

## Vietnamese Text Guardrail For Recent Search/Navbar Changes

- Các nhãn mới ở `pages/index.js` và `components/navbar.jsx` phải được lưu trực tiếp bằng UTF-8 sạch.
- Các chuỗi vừa thêm cần giữ đúng tiếng Việt hiển thị, gồm: `Tìm kiếm`, `Lọc`, `Mở bộ lọc chi tiết`, `Xóa lọc`, `Thu gọn`, `Không tìm thấy cửa hàng`, `Hết kết quả`, `Người dùng`.
- Khi sửa lại các khu vực này, ưu tiên patch cục bộ và tránh rewrite lớn nếu không cần thiết để giảm rủi ro lỗi mã hóa.