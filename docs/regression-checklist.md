# Regression Checklist

## Mục đích

Checklist này dùng để giảm kiểu lỗi:
- sửa tính năng này vỡ tính năng khác
- sửa đúng UI nhưng làm lệch rule nghiệp vụ
- task hoàn thành nhưng thiếu bước kiểm tra shared flow

Dùng checklist theo flow, không theo file.

Nguyên tắc:
- chỉ tick những mục thật sự đã kiểm
- nếu một mục không áp dụng, ghi rõ "không áp dụng"
- nếu sửa shared logic, phải kiểm cả flow liên quan

---

## Cách dùng

Trước khi code:
- xác định task chạm flow nào
- copy đúng section tương ứng vào `docs/current-work.md` nếu cần

Trước khi kết luận xong:
- đi lại checklist của flow chính
- đi nhanh checklist của flow liên đới
- ghi rõ phần nào đã verify, phần nào chưa

---

## Checklist chung cho mọi task

- Đã nêu rõ `Goal`, `In Scope`, `Out of Scope`.
- Đã đọc lại rule liên quan trong docs trước khi sửa.
- Không bypass convention hiện có của repo nếu chưa được yêu cầu.
- Không thêm refactor ngoài phạm vi task nhỏ.
- Không phá UTF-8 của text tiếng Việt.
- Nếu task là bug fix hoặc behavior change, đã thêm hoặc cập nhật test khi vùng đó test được.
- Đã chạy kiểm tra gần nhất với thay đổi:
  - `npm.cmd run lint`
  - `npm.cmd test`
  - kiểm tra thủ công flow liên quan nếu thay đổi UI/behavior
- Đã ghi `Verification` và `Risks` rõ trong báo cáo kết thúc task.

---

## Stores Read / Cache

Áp dụng khi đụng:
- `lib/storeCache.js`
- read path của search/map/import
- bất kỳ flow mutation nào có hậu quả đến cache

Checklist:
- Đọc store công khai vẫn đi qua `getOrRefreshStores()`.
- Không thêm query đọc trực tiếp `stores` cho public flow.
- Query admin đọc trực tiếp vẫn filter `deleted_at IS NULL`.
- Cache version / fallback không bị phá.
- Không cache dữ liệu soft-deleted.
- Sau mutation đã chọn đúng cache action:
  - create -> `appendStoreToCache(newStore)`
  - soft delete -> `removeStoreFromCache(id)`
  - edit / verify / report-apply -> merge local an toàn hoặc `invalidateStoreCache()`
- Nếu flow cần sync chéo trang/tab, đã phát `storevis:stores-changed`.
- Đã kiểm tra ít nhất một flow đọc dữ liệu sau mutation để chắc không stale.

---

## Create Flow

Áp dụng khi đụng:
- `pages/store/create.js`
- helper validate / duplicate / geolocation liên quan

Checklist:
- Vẫn giữ đúng thứ tự validate cuối và duplicate check.
- Bước 1 vẫn bắt buộc tên và chuẩn hóa Title Case VI.
- Bước 2 vẫn bắt buộc `district` + `ward`.
- `phone_secondary` không trùng `phone`.
- Nhánh telesale lưu ở bước 2 vẫn:
  - bắt buộc phone hợp lệ
  - cho phép chưa có vị trí
  - yêu cầu xác nhận trước khi lưu
  - tạo `is_potential = true` cho telesale
- Duplicate panel chỉ xuất hiện khi có candidate.
- Candidate thiếu dữ liệu vẫn có thể đi vào flow `Bổ sung` nếu rule hiện tại yêu cầu.
- Submit cuối vẫn không bypass rule business hiện có.
- Tạo xong vẫn redirect về `/`.
- Flash message vẫn dùng `sessionStorage['storevis:flash-message']`.
- Cache sau create vẫn được cập nhật đúng.

---

## Edit / Supplement / Report

Áp dụng khi đụng:
- `pages/store/edit/[id].js`
- `pages/store/reports.js`
- `components/store-detail-modal.jsx`
- logic report / supplement liên quan

Checklist:
- Admin edit vẫn bắt buộc `district` + `ward`.
- `mode=supplement` vẫn luôn bắt đầu từ bước 1.
- Field đã có dữ liệu vẫn bị khóa trong supplement.
- Store đã có vị trí vẫn đi flow 2 bước, không bật nhầm bước 3.
- Store chưa có vị trí vẫn tự lấy GPS khi vào bước 3.
- Guest/public trong supplement không update trực tiếp `stores`.
- Guest/public submit supplement/edit vẫn tạo `store_reports` với `report_type = 'edit'`.
- `reason_only` report không sửa trực tiếp dữ liệu store.
- Admin approve edit report mới được áp dụng `proposed_changes`.
- Sau apply edit/report vẫn cập nhật cache và sync event đúng.

---

## Search Flow

Áp dụng khi đụng:
- `pages/index.js`
- `helper/storeSearch.js`
- `helper/removeVietnameseTones.js`
- `helper/duplicateCheck.js` khi logic tìm gần giống được chia sẻ

Checklist:
- Search tiếng Việt có dấu / không dấu vẫn đúng.
- Tương đương phát âm vẫn không bị phá.
- Khi không nhập tiêu chí tìm kiếm, trang `/` vẫn hiển thị toàn bộ store.
- Sort mặc định gần -> xa vẫn còn đúng.
- Filter `district` và `ward` vẫn là single-select.
- Filter `store_type` và cờ dữ liệu vẫn là multi-select.
- Filter `Không có vị trí` vẫn kiểm tọa độ hợp lệ đúng cách.
- Đồng bộ state search/filter lên URL vẫn có debounce.
- Không spam `router.replace` khi query không đổi.
- Quay lại tab/search trước đó vẫn giữ đúng route gần nhất nếu task đụng phần persistence.

---

## Duplicate Detection

Áp dụng khi đụng:
- `helper/duplicateCheck.js`
- create/import/supplement/report flow có dùng duplicate logic

Checklist:
- `certain duplicate` vẫn ưu tiên trùng số điện thoại.
- `possible duplicate` vẫn theo cùng quận + cùng/xã lân cận + trùng từ có nghĩa.
- Không dùng bán kính để quyết định trùng.
- `address_detail` chỉ là tín hiệu phụ, không biến thành điều kiện bắt buộc nếu chưa có yêu cầu mới.
- Sort kết quả vẫn ưu tiên `certain` trước.
- Candidate không có tọa độ không bị coi là có distance hợp lệ.
- Đã kiểm với mẫu tiếng Việt có dấu và không dấu.

---

## Map Flow

Áp dụng khi đụng:
- `pages/map.js`
- components map picker
- helper geolocation / coordinate

Checklist:
- `/map` vẫn nhận và dùng đúng query `storeId`, `lat`, `lng`.
- Tọa độ vẫn được validate trong khoảng hợp lệ.
- Logic xử lý lat/lng đảo chiều không bị phá.
- Chỉ store có tọa độ hợp lệ mới được render marker hoặc xuất hiện trong suggestion của `/map`.
- Blue dot vị trí người dùng vẫn hiển thị.
- Nút quay về vị trí hiện tại vẫn hoạt động.
- Nếu có chế độ hướng, map vẫn giữ đúng behavior bật/tắt.
- Map picker trong form vẫn hỗ trợ lấy vị trí và hiển thị store lân cận.
- Giới hạn render store lân cận tối đa vẫn còn đúng nếu task chạm vùng đó.

---

## Verify / Delete / Admin Actions

Áp dụng khi đụng:
- `pages/store/verify.js`
- `pages/store/reports.js`
- các action admin liên quan mutation store

Checklist:
- Verify chỉ đổi `active`, không làm lệch field khác.
- Delete vẫn là soft delete qua `deleted_at`.
- Sau verify/delete/report-apply vẫn cập nhật cache đúng.
- Dialog xác nhận admin vẫn có title và description rõ ràng.
- Hành vi sync chéo trang/tab vẫn còn.

---

## Import / Export

Áp dụng khi đụng:
- `pages/store/import.js`
- `pages/store/export.js`
- export contacts/data liên quan

Checklist:
- Import vẫn dùng cache public hiện có để so trùng.
- Preview import vẫn chặn thiếu cột bắt buộc.
- Chỉ dòng `ready` mới được xử lý bulk import.
- Rule merge khi chọn store nghi trùng vẫn giữ nguyên.
- Bulk import xong vẫn cập nhật cache hoặc invalidate an toàn và phát event sync.
- Export admin đọc trực tiếp Supabase vẫn filter `deleted_at IS NULL`.
- Export dữ liệu lớn vẫn fetch theo trang nếu task chạm query export.

---

## Telesale

Áp dụng khi đụng:
- `pages/telesale/overview.js`
- `pages/telesale/call/[id].js`
- helper telesale liên quan

Checklist:
- Chỉ store `is_potential = true` và có phone mới vào queue telesale.
- Mapping kết quả gọi cũ/mới vẫn tương thích khi hiển thị.
- Ưu tiên queue vẫn đúng thứ tự business hiện tại.
- Các cột telesale cập nhật đúng nhóm field được phép.
- Sau update telesale, `updated_at` vẫn được cập nhật cùng lúc nếu flow đó chạm DB payload.

---

## Tiếng Việt / UI Safety

Áp dụng khi đụng text hiển thị hoặc file có tiếng Việt

Checklist:
- Text tiếng Việt trong source vẫn đúng dấu.
- Không rewrite file lớn nếu chỉ cần sửa ít dòng.
- Nếu sửa UI copy quan trọng, đã kiểm lại diff hoặc render thực tế.
- Font size và contrast vẫn theo design system.
- Không đưa text quan trọng xuống `text-xs` hoặc cỡ quá nhỏ.

---

## Mẫu báo cáo kết thúc task

```md
Goal
- ...

What changed
- ...

Files touched
- ...

Verification done
- ...

Risks or unverified parts
- ...
```
