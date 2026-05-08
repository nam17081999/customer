# Location Flow Matrix

Tài liệu này là nguồn tham chiếu tập trung cho logic vị trí/GPS/bản đồ của 4 màn:
- `create`
- `edit`
- `supplement`
- `report` (đặc biệt là `mode=edit`)

Mục tiêu:
- mô tả **behavior hiện tại** của code
- chỉ ra phần nào đang dùng chung thật
- chỉ ra phần nào chỉ “na ná” nhau nhưng đã tách nhánh
- giúp review trước khi refactor hoặc sửa bug tiếp theo

---

## 1. Thành phần dùng chung hiện có

### Shared UI/component

- `components/map/store-location-picker.jsx`
  - wrapper map picker dùng lại ở create/edit/supplement/report
- `components/map/location-picker.jsx`
  - base map component
  - nếu mount mà `initialLat/initialLng` chưa có thì sẽ rơi về default center nội bộ

### Shared helper nhỏ

- `helper/geolocation.js`
  - `getBestPosition()`
  - `clearPositionCache()`
  - `getGeoErrorMessage()`
  - `requestCompassHeading()`
- `helper/storeLocationStep.js`
  - `hasLocationCoordinates()`
  - `buildLocationStepResetPatch()`
  - `getCreateLocationStepView()`
- `helper/useStepEntryEffect.js`
  - chạy side effect khi mới vào step

### Shared ở mức business/form

- Create, edit, supplement, report đều có cùng ý tưởng nghiệp vụ:
  - có thể lấy GPS hiện tại
  - có thể dán link Google Maps
  - có thể mở khóa map để chỉnh tay
  - có logic lưu/finalize tọa độ riêng theo từng flow

**Lưu ý quan trọng:**
- Hiện tại chưa có **một controller location dùng chung** cho cả 4 màn.
- Shared hiện nay chủ yếu là component map + vài helper nhỏ.
- Orchestration/state machine của từng màn vẫn tách riêng.

---

## 2. Màn create

### File chính

- `pages/store/create.js`
- `helper/useStoreCreateController.js`

### State location chính

- `pickedLat`, `pickedLng`
- `initialGPSLat`, `initialGPSLng`
- `userHasEditedMap`
- `mapEditable`
- `resolvingAddr`
- `geoBlocked`
- `heading`, `compassError`
- `mapsLink`, `mapsLinkLoading`, `mapsLinkError`

### Lifecycle hiện tại

1. User đi tới step 3.
2. Controller reset location state qua `buildLocationStepResetPatch()`.
3. Controller tự gọi GPS bootstrap một lần.
4. Nếu có tọa độ:
   - set `initialGPSLat/initialGPSLng`
   - set `pickedLat/pickedLng`
   - map dùng tọa độ này
5. Nếu không có tọa độ:
   - set `geoBlocked` hoặc để user bấm lại / dán link Maps

### Guard hiện tại

- Create đã có `getCreateLocationStepView()` để tránh mount map khi chưa có tọa độ thật mà chưa blocked.
- Khi đang bootstrap GPS hoặc sau bootstrap vẫn chưa có tọa độ, UI hiện placeholder thay vì map default center.

### Điểm cần preserve

- Telesale 2 bước không bị kéo vào step 3.
- Duplicate / validation cuối không bị ảnh hưởng bởi logic view-state của map.
- Final coordinate resolution vẫn theo ưu tiên:
  - map user chỉnh
  - GPS bootstrap
  - fallback GPS khi submit nếu cần

---

## 3. Màn edit

### File chính

- `pages/store/edit/[id].js`
- `helper/useStoreEditController.js`
- `components/store/store-supplement-form.jsx`

### Cấu trúc hiện tại

- `edit` và `supplement` dùng chung page/controller/form UI.
- Khác biệt chủ yếu nằm ở:
  - `mode`
  - `supplementLocks`
  - step count
  - action cuối (update trực tiếp hay tạo report)

### State location chính

- giống create ở nhiều biến:
  - `pickedLat`, `pickedLng`
  - `initialGPSLat`, `initialGPSLng`
  - `userHasEditedMap`
  - `mapEditable`
  - `resolvingAddr`
  - `geoBlocked`
  - `heading`, `compassError`
  - `mapsLink*`

### Behavior hiện tại của edit

- Nếu store đã có tọa độ, form edit hiển thị map từ dữ liệu store.
- Edit không có bootstrap-step riêng bằng `useStepEntryEffect()` như create.
- Khi user bấm `Lấy lại vị trí`, controller gọi GPS fresh (`skipCache: true`) rồi cập nhật state.

### Điểm cần preserve

- Edit luôn là admin flow.
- Validation step 1/2 và save cuối không bị lẫn với supplement.
- Update coordinates ở edit phải đi qua flow save hiện có, không bypass business rules.

---

## 4. Màn supplement

### File chính

- `pages/store/edit/[id].js?mode=supplement`
- `helper/useStoreEditController.js`
- `components/store/store-supplement-form.jsx`

### Rule nghiệp vụ hiện tại

- Luôn bắt đầu từ step 1.
- Field đã có dữ liệu bị khóa.
- Chỉ field thiếu mới được bổ sung.
- Nếu store chưa có vị trí thì có 3 bước.
- Nếu store đã có vị trí thì chỉ có 2 bước.

### Lifecycle location hiện tại

- Khi store chưa có vị trí, user vào step 3 bằng shared form flow.
- Controller có `handleStartLocationSetup()`:
  1. reset state qua `buildLocationStepResetPatch()`
  2. gọi GPS bootstrap một lần
  3. nếu được thì set `pickedLat/pickedLng`
- Shared form `StoreSupplementForm` hiện đang mount `StoreLocationPicker` trực tiếp ở step 3.

### Divergence so với create

- Supplement hiện **chưa có view-state guard tương đương create**.
- Nghĩa là sau reset mà chưa có tọa độ ngay, map có thể vẫn mount và rơi về default center của base map.
- Đây là một trong những điểm dễ regression chéo màn nhất.

### Điểm cần preserve

- `mode=supplement` của guest/public không update trực tiếp `stores`.
- Chỉ admin mới update trực tiếp store trong supplement.
- Store đã có vị trí không được bật nhầm step 3.

---

## 5. Màn report

### File chính

- `components/store-report-form.jsx`
- `helper/useStoreReportFormController.js`

### State location chính

- `reportLat`, `reportLng`
- `mapEditable`
- `resolving`
- `mapsLink*`
- `currentStep`

### Behavior hiện tại

- Report dùng controller location riêng, không dùng shape state giống create/edit hoàn toàn.
- `handleGetLocation()` gọi GPS fresh và cập nhật `reportLat/reportLng`.
- `mode=edit` có step 3 location trong report form.
- Form report hiện mount map trực tiếp khi vào phần location.

### Divergence so với create/edit

- Không có `geoBlocked` state riêng cùng semantics như create/edit.
- Không dùng `buildLocationStepResetPatch()`.
- Không dùng `getCreateLocationStepView()`.
- Không cùng final-coordinate helper với create/edit.

### Điểm cần preserve

- `reason_only` report không sửa trực tiếp dữ liệu store.
- `edit` report chỉ tạo `store_reports`, không update store ngay.
- Validation “chưa thay đổi gì” vẫn phải hoạt động đúng khi có/không có thay đổi tọa độ.

---

## 6. Bảng so sánh nhanh

| Chủ đề | Create | Edit | Supplement | Report |
|---|---|---|---|---|
| Controller riêng | Có | Dùng chung với supplement | Dùng chung với edit | Có |
| Tự bootstrap GPS khi vào step location | Có | Không theo step-entry riêng | Có, qua action setup | Không theo step-entry riêng |
| Reset state trước bootstrap | Có | Có trong action lấy setup | Có | Không cùng helper reset |
| Guard tránh default center khi chưa có tọa độ | Có | Chưa tách riêng | Chưa có | Chưa có |
| Google Maps link flow | Có | Có | Có | Có |
| Shared final coordinate helper | Có | Có | Có | Không cùng helper |
| `geoBlocked` state | Có | Có | Có | Không cùng semantics |

---

## 7. Những điểm hiện tại dễ gây sửa lệch phiên bản

### 7.1 Shared UI nhưng duplicated orchestration

- Cùng dùng `StoreLocationPicker`, nhưng mỗi màn có controller/state khác nhau.
- Sửa ở UI map không đảm bảo sửa đúng behavior orchestration của 4 màn.

### 7.2 Cùng bài toán “bootstrap GPS” nhưng mỗi màn làm khác nhau

- Create và supplement/edit có flow reset rồi lấy GPS.
- Report chỉ lấy GPS theo controller riêng.
- Timeout, cache policy, blocked state, placeholder state chưa thống nhất thành một spec chung.

### 7.3 Maps link parsing chưa hợp nhất hoàn toàn

- Có màn dùng helper parse/resolve này.
- Có màn dùng nhánh expand short-link khác.
- Nếu chỉnh một nơi, nơi còn lại có thể lệch behavior.

### 7.4 View-state location chưa chuẩn hóa chung

- Create đã có helper `getCreateLocationStepView()`.
- Tên/helper hiện tại mới phản ánh create.
- Supplement/report chưa dùng cùng abstraction này.

---

## 8. Guardrails nếu sửa code sau này

Nếu tiếp tục sửa/refactor logic location, cần giữ rõ các rule sau:

1. **Phải tách rõ behavior hiện tại và behavior mục tiêu.**
2. **Không gộp bugfix + refactor + UX rewrite trong một phase.**
3. **Mọi change ở shared location phải verify ít nhất 4 flow:**
   - create
   - edit
   - supplement
   - report (`mode=edit`)
4. **Không dùng mỗi một màn làm đại diện cho toàn bộ location logic.**
5. **Nếu chuẩn hóa helper chung, helper phải mô tả được ít nhất:**
   - bootstrapping
   - ready
   - blocked
   - awaiting manual input
6. **Nếu hợp nhất GPS bootstrap policy, phải quyết định rõ:**
   - timeout
   - cache/skipCache
   - lúc nào reset state
   - lúc nào được mount map

---

## 9. Recommendation cho phase tiếp theo

Không thực hiện trong task docs này; chỉ là đề xuất để review:

### Phase 1 — chuẩn hóa view-state guard

- Mục tiêu: tránh default center sai UX ở supplement/report giống create.
- Cách làm: đổi `getCreateLocationStepView()` thành helper trung tính hơn rồi áp sang 3 flow có step location.

### Phase 2 — chuẩn hóa GPS bootstrap/get-location

- Mục tiêu: đồng bộ timeout, cache policy, blocked semantics.

### Phase 3 — chuẩn hóa maps-link resolution

- Mục tiêu: giảm duplicated parsing/expand behavior.

---

## 10. Tình trạng docs hiện tại sau khi có file này

### Đã có

- Rule rải rác trong:
  - `docs/architecture.md`
  - `docs/business-rules.md`
  - `docs/regression-checklist.md`
- Matrix/spec tập trung cho 4 flow location: **file này**

### Chưa có

- Một state machine chính thức cho shared location orchestration
- Một policy doc thống nhất cho timeout/cache/blocked/manual-fallback
- Một checklist test riêng cho regression của 4 flow location
