# 🤖 AI Coding Rules - NPP Hà Công

Quy tắc bắt buộc khi sinh code cho project NPP Hà Công. Đọc file này trước khi code.

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

## 1b. Encoding & Vietnamese Safety

- Tất cả file source/docs có tiếng Việt phải giữ **UTF-8**.
- Ưu tiên `apply_patch` khi chỉ sửa một phần file có tiếng Việt.
- Tránh rewrite cả file bằng PowerShell `Set-Content`, `Out-File`, hoặc pipeline text nếu chưa kiểm soát rõ encoding đầu ra.
- Khi buộc phải tạo file mới, giữ literal tiếng Việt chuẩn trong source; không chấp nhận mojibake như `Ã`, `Ä`, `áº`, `á»`.
- Trước khi commit, chạy `npm run text:check:staged`. Khi cần quét toàn repo, chạy `npm run text:check`.
- Repo dùng hook `.githooks/pre-commit` để chặn commit nếu file staged còn dấu hiệu mojibake. Sau khi clone repo hoặc reset Git config cục bộ, chạy lại `npm run hooks:install`.
- `docs/ai-rules.md` là ngoại lệ duy nhất có thể chứa ví dụ mojibake để minh họa rule cấm. Không dùng file này làm bằng chứng rằng repo còn lỗi encoding.
- Sau khi sửa text tiếng Việt:
  1. kiểm tra lại `git diff`
  2. nếu là UI text, ưu tiên reload màn hình để xác nhận
  3. nếu terminal hiển thị sai dấu nhưng diff/source đúng, coi đó là vấn đề codepage terminal chứ không tự ý rewrite file lần nữa

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

### Cache versioning (bat buoc cho moi moi truong)

- Moi moi truong Supabase phai chay migration:
  - `docs/sql/2026-04-05-add-store-cache-version.sql`
- Neu migration da co:
  - uu tien check version tu `store_cache_versions`
  - chi fetch all stores khi version lech
- Neu migration chua co:
  - cho phep fallback tam thoi `count + max(updated_at)`

### updated_at rule (bat buoc)

- Moi thay doi du lieu tren `stores` phai cap nhat `updated_at` cung luc:
  - edit
  - supplement
  - soft delete
  - telesale updates

### Redirect + thong bao sau thao tac thanh cong

- Sau `create/edit/supplement/delete` thanh cong:
  - dieu huong ve `/`
  - hien thong bao top-slide thong nhat bang `Msg`
  - flash payload dung `sessionStorage['storevis:flash-message']`

**Ngoại lệ duy nhất cho export admin:**
```js
// `/store/export` được phép đọc trực tiếp Supabase để lấy đủ toàn bộ store
// nhưng bắt buộc:
// 1. filter deleted_at IS NULL
// 2. fetch theo trang (`range`) nếu số lượng store có thể lớn
const all = []
let from = 0
while (true) {
  const to = from + 999
  const { data } = await supabase
    .from('stores')
    .select('id,name,...')
    .is('deleted_at', null)
    .range(from, to)
  all.push(...(data || []))
  if (!data || data.length < 1000) break
  from += 1000
}
```

**Admin import page vẫn phải đọc qua cache public để so trùng:**
```js
// `/store/import` dùng cache hiện có để preview nghi trùng
import { getOrRefreshStores } from '@/lib/storeCache'

const existingStores = await getOrRefreshStores()
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

```js
// Nhánh "Lưu luôn" ở bước 2 của `/store/create`
// bắt buộc có phone hợp lệ nhưng cho phép chưa có vị trí
await supabase.from('stores').insert([{
  name,
  ward,
  district,
  phone,                 // ← bắt buộc ở nhánh này
  latitude: null,
  longitude: null,
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
const dupes = mergeDuplicateCandidates(near, global, lat, lng)
```

```js
// `/store/import`: parse file mẫu CSV và preview trước khi insert
const rows = parseCsv(csvText)
const { headerMap, missingFields } = buildHeaderMap(rows[0])
if (missingFields.length > 0) {
  throw new Error('Thiếu cột bắt buộc trong file mẫu')
}

const previewRows = rows.slice(1).map((row) => ({
  status: 'ready',          // hoặc 'duplicate' / 'error'
  issues: [],
  duplicateMatches: [],
}))
```

```js
// Duplicate candidates chỉ được có distance khi store có tọa độ hợp lệ.
// Không dùng `isFinite(store.latitude)` trực tiếp vì `isFinite(null) === true`.
function parseCoordinate(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN
  if (typeof value !== 'string') return NaN
  const parsed = Number.parseFloat(value.trim().replace(/,/g, '.'))
  return Number.isFinite(parsed) ? parsed : NaN
}
```

```js
// Khi chưa nhập tiêu chí tìm kiếm:
// hiển thị toàn bộ cửa hàng, sort khoảng cách tăng dần
const defaultNearby = stores
  .slice()
  .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity))
```

```js
// Bộ lọc chi tiết trên `/`
// Quận/Huyện + Xã/Phường: single-select
// Loại cửa hàng + Có SĐT + Có ảnh + Không có vị trí: multi-select
const filtered = stores.filter((store) => {
  if (selectedDistrict && store.district !== selectedDistrict) return false
  if (selectedWard && store.ward !== selectedWard) return false
  if (selectedStoreTypes.length && !selectedStoreTypes.includes(store.store_type || '')) return false
  if (selectedFlags.includes('has_phone') && !String(store.phone || '').trim()) return false
  if (selectedFlags.includes('has_image') && !String(store.image_url || '').trim()) return false
  if (selectedFlags.includes('has_no_location')) {
    const hasCoords = Number.isFinite(parseCoordinate(store.latitude)) && Number.isFinite(parseCoordinate(store.longitude))
    if (hasCoords) return false
  }
  return true
})
```

```js
// Trang `/` phải chủ động làm mới vị trí
setInterval(refreshCurrentLocation, 3 * 60 * 1000)
window.addEventListener('focus', refreshCurrentLocation)
window.addEventListener('pageshow', refreshCurrentLocation)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') refreshCurrentLocation()
})
```

```js
// Đồng bộ state search/filter của `/` lên URL
// phải debounce và bỏ qua replace nếu query không đổi
const syncTimer = window.setTimeout(() => {
  router.replace({ pathname: router.pathname, query: nextQuery }, undefined, { shallow: true })
}, 250)
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
- `/map` có source/layer riêng cho vị trí người dùng (`user-location`) để hiển thị chấm xanh.
- `/map` phải lọc từ đầu để chỉ giữ các store có tọa độ hợp lệ; store không có vị trí không được đẩy vào marker source hay search suggestion.
- **Steps & Tags**: Sử dụng màu nền tối cố định (`bg-gray-800/90`, `bg-gray-900`), không dùng các class `bg-white` hay `bg-gray-100`.
- **Input**: font-size ≥ 16px (tránh iOS zoom), nền `bg-gray-900`, text `text-gray-100`.
- **Button height**: tối thiểu `h-10` (40px), prefer `h-11` (44px).
- **Màu text mặc định**: chính `text-gray-100`, phụ `text-gray-400`.
- **Desktop navbar**: giữ bố cục cũ (brand trái, nav phải), active state tối giản bằng chữ/icon sáng + underline mảnh; không dùng nền active quá nặng.
- **Admin mobile step 3**: phần dán Google Maps link hiển thị mặc định ngay dưới bản đồ, không dùng card wrapper riêng.
- **Search card phone link**: vùng click gọi điện chỉ ôm đúng số điện thoại, không stretch ra khoảng trống bên phải.

```js
// Duplicate panel ở `/store/create`
// nếu candidate chưa có vị trí thì card được phép truyền action phụ:
<SearchStoreCard
  compact
  compactActionLabel="Bổ sung"
  onCompactAction={(store) => router.push(`/store/edit/${store.id}?mode=supplement`)}
/>
```

```js
// Bulk import thật chỉ lấy các dòng đã pass preview
const readyRows = previewRows.filter((row) => row.status === 'ready')

for (const chunk of chunkArray(payloads, 100)) {
  const { error } = await supabase.from('stores').insert(chunk)
  if (error) throw error
}

await invalidateStoreCache()
window.dispatchEvent(new CustomEvent('storevis:stores-changed', {
  detail: { type: 'bulk-import', shouldRefetchAll: true },
}))
```

```js
// Trong `/store/edit/[id]?mode=supplement`
// luôn bắt đầu từ bước 1, khóa field đã có, và chỉ khi store thiếu tọa độ
// mới có bước 3 để bổ sung vị trí
if (isSupplementMode && currentStep === 3 && pickedLat == null && pickedLng == null) {
  handleGetLocation()
}

// Nếu chưa đăng nhập, supplement flow không update trực tiếp `stores`
await supabase.from('store_reports').insert([{
  store_id: id,
  report_type: 'edit',
  proposed_changes: updates,
  reporter_id: null,
}])
```

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
