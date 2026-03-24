# 🤖 AI Coding Rules - StoreVis

Quy tắc bắt buộc khi sinh code cho project StoreVis. Đọc file này trước khi code.

---

## 1. Import & Paths

- Dùng **alias `@/`** cho tất cả import nội bộ
  ```js
  import { supabase } from '@/lib/supabaseClient'
  import { getOrRefreshStores } from '@/lib/storeCache'
  import { Button } from '@/components/ui/button'
  ```
- **Không** dùng relative path `../../`
- **Pages Router** — page mới đặt trong `pages/`, không phải `app/`
- Dynamic import với `{ ssr: false }` cho MapLibre, canvas, browser-only code

---

## 2. Đọc Stores — Bắt Buộc Qua Cache

```js
// ✅ ĐÚNG
import { getOrRefreshStores } from '@/lib/storeCache'
const stores = await getOrRefreshStores()

// ❌ SAI — vi phạm, bypass cache, không có soft-delete filter
const { data } = await supabase.from('stores').select('*')
```

**Sau mutation:**
```js
await appendStoreToCache(newStore)      // sau CREATE
await removeStoreFromCache(storeId)     // sau soft-delete
await invalidateStoreCache()            // sau EDIT
```

---

## 3. Insert/Update Store

### INSERT đúng
```js
await supabase.from('stores').insert([{
  name: toTitleCaseVI(name.trim()),   // ← Title Case bắt buộc
  store_type: selectedStoreType || 'Tạp hóa', // ← mặc định Cửa hàng
  address_detail, ward, district,      // ← cũng Title Case
  active: Boolean(isAdmin),
  note, phone,
  image_url: imageFilename,            // ← chỉ tên file, không phải URL
  latitude, longitude,
  // ← KHÔNG có name_search (cột không tồn tại trong DB)
}]).select()
```

### Soft Delete đúng
```js
// ✅ ĐÚNG
await supabase.from('stores')
  .update({ deleted_at: new Date().toISOString() })
  .eq('id', id)

// ❌ SAI
await supabase.from('stores').delete().eq('id', id)
```

### Query đọc trực tiếp (admin pages) — luôn filter deleted_at
```js
await supabase.from('stores')
  .select('id, name, ward, district, ...')
  .is('deleted_at', null)   // ← bắt buộc
  .eq('active', false)
```

---

## 4. Image

- `image_url` trong DB = **tên file** (ví dụ: `1716000000_abc.jpg`)
- Full URL: `process.env.NEXT_PUBLIC_IMAGE_BASE_URL + image_url`
- Helper: `getFullImageUrl(image_url)` trong `@/helper/imageUtils`
- Upload: POST multipart/form-data tới `/api/upload-image`
- Nén ảnh bằng `browser-image-compression` trước upload

---

## 5. Địa Lý

```js
import { DISTRICT_WARD_SUGGESTIONS, DISTRICT_SUGGESTIONS } from '@/lib/constants'
import { haversineKm } from '@/helper/distance'
import { getBestPosition, requestCompassHeading } from '@/helper/geolocation'

// Lấy GPS
const { coords, error } = await getBestPosition({ maxWaitTime: 2000, desiredAccuracy: 15 })

// Yêu cầu lấy hướng la bàn (Compass / Heading):
// BẮT BUỘC gọi `requestCompassHeading()` bên trong synchronous block của event trigger (onClick, thao tác người dùng) TRƯỚC các hàm `await` để lấy được quyền hệ thống trên iOS/Safari (User Gesture). Không gọi trong `useEffect`.
// Khi cập nhật state heading để quay bản đồ, nên công thêm 1 số rất nhỏ (vd: +0.000001) nếu state cũ trùng lặp để ép React trigger re-render:
//   setHeading((prev) => prev === h ? h + 0.000001 : h)
```
- Validate lat ∈ [-90,90], lng ∈ [-180,180]
- Không hardcode tên huyện/xã

---

## 6. Tìm Kiếm & Trùng Tên

```js
import removeVietnameseTones from '@/helper/removeVietnameseTones'
import { findNearbySimilarStores, findGlobalExactNameMatches, mergeDuplicateCandidates } from '@/helper/duplicateCheck'

const [near, global] = await Promise.all([
  findNearbySimilarStores(lat, lng, name),
  findGlobalExactNameMatches(name),
])
const dupes = mergeDuplicateCandidates(near, global)
```

```js
// Khi chưa nhập tiêu chí tìm kiếm (q rỗng + chưa chọn quận/xã):
// hiển thị 50 cửa hàng gần nhất, sort khoảng cách tăng dần
const defaultNearby = stores
  .slice()
  .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity))
  .slice(0, 50)
```

---

## 7. Auth

```js
import { useAuth } from '@/lib/AuthContext'
const { user, loading } = useAuth()
const isAdmin = Boolean(user)

// Redirect nếu chưa đăng nhập
if (!user) router.replace('/login?from=/account')
```

---

## 8. Styling — Quy Tắc Font

```
✅ text-base (16px+)  — thông tin thường
✅ text-sm            — text phụ tối thiểu
❌ text-xs            — không dùng cho thông tin quan trọng
❌ text-[11px]        — không dùng
```

- **Dark mode**: Ứng dụng dùng **Dark Mode duy nhất**. Không dùng `dark:` prefix.
- **Button**: Variant `default` bắt buộc là màu trắng (`bg-gray-50 text-gray-900`) để nổi bật.
- **Bản đồ**: 
  - Trang hiển thị chung (`/map`): Dùng bộ lọc tối (`.dark-map-filter`).
  - Trang nhập liệu (`create/edit`): Dùng chế độ **Sáng** (`dark={false}`) để nạp tọa độ chính xác.
- **Steps & Tags**: Sử dụng màu nền tối cố định (`bg-gray-800/90`, `bg-gray-900`), không dùng các class `bg-white` hay `bg-gray-100`.
- **Input**: font-size ≥ 16px (tránh iOS zoom), nền `bg-gray-900`, text `text-gray-100`.
- **Button height**: tối thiểu `h-10` (40px), prefer `h-11` (44px).
- **Màu text mặc định**: chính `text-gray-100`, phụ `text-gray-400`.

---

## 9. Custom Events & Sync

```js
// Sau khi thay đổi store data — broadcast để các page khác update
window.dispatchEvent(new CustomEvent('storevis:stores-changed', {
  detail: { id: storeId, shouldRefetchAll: true }
}))

// Lắng nghe trong pages
window.addEventListener('storevis:stores-changed', handler)
```

---

## 10. Performance

- **Virtual list**: dùng `react-virtuoso` cho danh sách dài
- **Dynamic import**: MapLibre, location pickers → `dynamic(() => import(...), { ssr: false })`
- **useMemo**: filter/sort nặng
- **useCallback**: handlers truyền vào child component
- **Promise dedup**: `getOrRefreshStores()` tự xử lý
- Server-side: private key ImageKit chỉ trong `pages/api/`

---

## 11. Giao Diện Cho Người Mắt Kém (Accessibility)

- **Bắt buộc**: Dùng các biến màu có độ tương phản cao.
- **Bắt buộc**: Font size nội dung ≥ 16px (`text-base`).
- **Bắt buộc**: Các nút bấm quan trọng cao tối thiểu 44px (`h-11`).
- **Bắt buộc**: Checkbox/Switch phải đủ lớn (`h-5 w-5`).
