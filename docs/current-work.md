# Current Work

## Mục đích

File này là bộ nhớ làm việc ngắn hạn cho người và AI.

Chỉ ghi những gì cần để tiếp tục công việc an toàn ở phiên sau:
- đang làm gì
- được phép sửa gì
- phải giữ rule nào
- đã xác minh đến đâu
- còn rủi ro nào mở

Không dùng file này để viết tài liệu dài hay ghi lịch sử đầy đủ.

---

## Cách dùng cho mỗi task

Trước khi code:
- cập nhật `Goal`
- cập nhật `In Scope`
- cập nhật `Out of Scope`
- cập nhật `Must Preserve`
- ghi ngắn `Plan`

Trong khi làm:
- cập nhật `Progress` khi đã xong một mốc rõ ràng
- cập nhật `Open Questions` nếu phát hiện blocker hoặc điểm chưa chắc

Kết thúc task:
- cập nhật `Done`
- cập nhật `Verification`
- cập nhật `Risks / Next`

Nếu mở phiên AI mới:
1. Đọc `AGENTS.md`
2. Đọc `docs/current-work.md`
3. Đọc `docs/regression-checklist.md`
4. Đọc thêm các docs/contract liên quan đúng flow đang sửa

Quy ước bắt buộc:
- Không bắt đầu sửa code nếu `docs/current-work.md` chưa phản ánh đúng task hiện tại.
- Không kết luận xong task nếu chưa đi lại section phù hợp trong `docs/regression-checklist.md`.
- Nếu task đổi phạm vi hoặc phát hiện rule mới, cập nhật file này ngay trong phiên đó.
- Khi mở phiên AI mới, ưu tiên tin dữ liệu trong file này hơn chat history cũ.

---

## Template

```md
# Current Work

## Goal
- ...

## In Scope
- ...

## Out of Scope
- ...

## Must Preserve
- ...

## Plan
- ...

## Progress
- ...

## Done
- ...

## Verification
- ...

## Open Questions
- ...

## Risks / Next
- ...
```

---

## Current Snapshot

### Goal
- Tiếp tục bước 4 cho `map` theo đúng thứ tự: tăng test rồi tách thêm logic khỏi `pages/map.js`.
- Sau khi đã fix bug camera của `Dẫn đường`, tách tiếp cụm logic điều hướng/bám người dùng (GPS, heading, recenter, follow mode, timer refresh) ra helper/hook riêng.
- Giữ nguyên rule hiện tại: chế độ `Dẫn đường` phải ưu tiên bám vị trí người dùng và khóa kéo map.

### In Scope
- `pages/map.js`.
- Helper/hook mới cho logic điều hướng/bám người dùng của map.
- Unit test cho logic thuần mới được tách khỏi cụm navigation.
- Browser test map liên quan trực tiếp tới `Dẫn đường`, GPS, camera nếu cần.
- `docs/current-work.md` cho pha làm việc này.

### Out of Scope
- Không thay đổi UI/behavior nghiệp vụ của map ngoài bug dẫn đường vừa sửa và phần refactor/tăng test trực tiếp liên quan tới navigation của map.
- Không đổi `create/edit/supplement/report/search` nếu không bị logic map dùng chung bắt buộc.
- Không đổi rule route query của map (`storeId`, `lat`, `lng`).
- Không thêm dependency mới.
- Không tách toàn bộ MapLibre rendering layer khỏi page trong đợt này nếu không thật sự cần.

### Must Preserve
- Route dùng Pages Router trong `pages/`.
- Import nội bộ dùng alias `@/`.
- Đọc store công khai qua `getOrRefreshStores()`, không bypass cache.
- Soft delete qua `deleted_at`, không hard delete.
- `image_url` chỉ lưu tên file, không lưu full URL.
- Sau mutation phải cập nhật cache đúng rule:
  - create -> `appendStoreToCache(newStore)`
  - soft delete -> `removeStoreFromCache(id)`
  - edit / verify / report-apply -> ưu tiên merge local an toàn, nếu không thì `invalidateStoreCache()`
- Khi cần đồng bộ chéo trang/tab, broadcast `storevis:stores-changed`.
- Giữ đúng rule create/edit/supplement/report, không trộn `edit` report với `reason_only`.
- Giữ đúng search tiếng Việt: có dấu, không dấu, và tương đương phát âm.
- Giữ đúng hành vi `/map` với query `storeId`, `lat`, `lng` và validate tọa độ hợp lệ.
- Giữ UTF-8 sạch cho text tiếng Việt; ưu tiên patch nhỏ, không rewrite lớn nếu không cần.
- Giữ dark theme, chữ đủ lớn, touch target đủ lớn theo design system.
- Giữ cache create: `appendStoreToCache(newStore)`, flash message `storevis:flash-message`, redirect về `/`.
- Giữ nhánh quick-save của telesale/admin ở bước 2 và confirm dialog hiện có.
- Giữ đúng thứ tự create flow hiện tại:
  - bước 1 check trùng tên
  - bước 2 nhập thông tin
  - bước 3 chọn vị trí
- Giữ final duplicate gate bằng `findNearbySimilarStores` + `findGlobalExactNameMatches` + `mergeDuplicateCandidates`.
- Giữ supplement flow:
  - luôn bắt đầu từ bước 1
  - field đã có dữ liệu thì bị khóa
  - store đã có vị trí chỉ còn 2 bước
  - guest/public vẫn tạo `store_reports`, không update trực tiếp `stores`
- Giữ edit flow:
  - admin vẫn sửa trực tiếp store hiện có
  - vẫn bắt buộc `district` + `ward`
  - vẫn cập nhật cache local + sync event sau khi lưu
- Nếu có layout dùng chung thì chỉ đổi phần trình bày/chia bước; side effects, cache, auth branch, redirect, confirm dialog phải giữ đúng behavior cũ.
- Giữ fallback hoàn thành bước cuối create qua dán Google Maps link khi GPS không lấy được.
- Report edit vẫn bắt buộc `district` + `ward`, không cho submit nếu không có thay đổi.
- Report `reason_only` vẫn chỉ gửi lý do, không gửi `proposed_changes`.
- Admin approve edit report mới được cập nhật `stores`, cập nhật cache local và phát `storevis:stores-changed`.
- Admin approve reason-only chỉ cập nhật trạng thái report, không patch `stores`.
- Nút report trong detail modal vẫn đi vào flow report hiện tại `/store/report/[id]`.

### Plan
- Cập nhật working memory rồi mới sửa code.
- Viết thêm unit test cho logic thuần của cụm navigation/camera/heading.
- Tách helper thuần trước, rồi tách orchestration điều hướng/bám người dùng sang hook riêng.
- Nối lại `pages/map.js` với thay đổi tối thiểu, giữ nguyên behavior hiện tại.
- Verify theo checklist `Checklist chung`, `Map Flow`, `Stores Read / Cache`, `Tiếng Việt / UI Safety`.

### Progress
- Đã thêm helper thuần mới `helper/mapNavigation.js`, gom:
  - chuẩn hóa heading
  - tính delta heading ngắn nhất
  - smooth heading
  - hợp nhất heading hiện tại từ compass/GPS/heading cũ
  - kiểm tra vị trí người dùng hợp lệ
  - build camera payload về vị trí người dùng
  - quyết định có cần build route khi vừa bật follow
- Đã thêm unit test mới `__tests__/helper/mapNavigation.test.js` để khóa cụm logic thuần của navigation/camera.
- Đã tách orchestration điều hướng/bám người dùng ra `helper/useMapNavigationController.js`, gồm:
  - refresh GPS
  - recenter về người dùng
  - bật/tắt chế độ dẫn đường
  - khóa/mở dragPan theo follow mode
  - bám camera theo userLocation
  - timer refresh GPS mỗi 3 giây khi map mở
- `pages/map.js` hiện không còn tự giữ cụm logic GPS/heading/follow/camera lớn như trước; page chủ yếu còn wiring UI, search/filter, drag route, và MapLibre render.
- Đã bắt và sửa một regression trong quá trình tách:
  - callback `clearSelectedStore` truyền inline làm `refreshUserLocation` đổi identity
  - effect GPS/timer bị dựng lại nhiều lần
  - kết quả là test race-condition cũ tăng call count sai
  - đã fix bằng callback ổn định `useCallback`
- Đã chốt cụm nên tách tiếp khỏi `pages/map.js` sau đợt fix bug camera:
  - normalize/smooth heading
  - refresh GPS và hợp nhất heading
  - recenter về người dùng
  - bật/tắt chế độ dẫn đường
  - effect khóa kéo map, effect bám camera theo user, interval refresh GPS
- Đang thêm unit test cho logic thuần của cụm này trước khi kéo orchestration ra hook riêng.
- Đã thêm browser test hồi quy mới cho case:
  - bật `Dẫn đường` khi route plan đã có điểm dừng nhưng chưa có geometry
  - app vẫn build route thành công
  - camera không bị `fitBounds` toàn tuyến, chỉ giữ camera bám vị trí người dùng
- Đã vá orchestration route:
  - `buildRoute()` nhận option để bỏ qua `fitBounds` khi cần
  - nhánh bật `Dẫn đường` gọi `buildRoute({ skipFitBounds: true })`
  - nhánh nút `Vẽ` và các flow build route thường vẫn giữ `fitBounds` như cũ
- Đã thêm ghi nhận camera event trong test mode E2E để khóa regression chính xác ở mức hành vi camera.
- Đã xác định nhánh bug mới:
  - `toggleUserHeadingRotation()` bật `followUserHeading = true`, đưa camera về vị trí người dùng.
  - nếu lúc đó chưa có `routeGeojson`, hàm này gọi `buildRoute()`.
  - `buildRoute()` trong hook luôn `fitBounds` toàn tuyến sau khi API route trả về.
  - effect bám người dùng chỉ chạy lại khi `userLocation` đổi, nên nếu không có đợt GPS mới ngay sau đó thì camera bị kẹt ở trạng thái fit toàn tuyến dù đã ở mode dẫn đường.
- Đang thêm test để khóa đúng case này trước khi vá.
- Đã đối chiếu trace runtime mới báo với mã hiện tại của `pages/map.js`.
- Xác nhận file hiện tại không còn thứ tự gây TDZ:
  - `useMapRouteController(...)` đang khai báo `routeStops` ở khoảng dòng 218.
  - `renderedRouteStops` đang được tính ở khoảng dòng 248.
- Log terminal cho thấy đã từng có một lần compile/runtime của bản cũ nơi `renderedRouteStops` đứng trước `routeStops`, sau đó Turbopack full-reload và `/map` quay lại `200`.
- Điều này cho thấy lỗi mới báo nhiều khả năng đến từ snapshot build/hot-reload cũ thay vì state mã hiện tại trên đĩa; đang chạy verify tập trung để chốt lại.
- Đã thêm browser coverage mới cho search/home tại `e2e/store-search.spec.js`, khóa 4 nhánh người dùng thật:
  - load store public từ cache override và hiển thị danh sách
  - tìm kiếm tiếng Việt không dấu vẫn match tên có dấu
  - sync search/filter lên URL rồi khôi phục lại state từ route
  - mở detail modal từ search result vẫn hiển thị đúng thông tin cửa hàng
- Đã tách orchestration của màn `/` sang `helper/useHomeSearchController.js`, gom:
  - restore state từ route query
  - sync query ngược lại lên URL
  - geolocation bootstrap + refresh
  - load store công khai qua cache
  - sync `storevis:stores-changed`
  - build search results + filter state + scroll reset
- `pages/index.js` hiện chủ yếu còn render UI search/filter/list, không còn tự gánh toàn bộ side effect và search-state orchestration.
- Đã thêm smoke test browser cho đường đi search -> detail modal -> nút report -> route `/store/report/[id]`.
- Đã xóa toàn bộ khối report cũ khỏi `components/store-detail-modal.jsx`, gồm state/form submit cũ, map picker cũ, và import/helper không còn dùng.
- `store-detail-modal` hiện chỉ còn render chi tiết cửa hàng và điều hướng sang màn report riêng; không còn giữ implementation report thứ hai trong modal.
- Đã chốt đợt này chỉ còn một việc report flow chưa khóa bằng test: đường đi từ search -> detail modal -> nút report -> route `/store/report/[id]`.
- Đã đọc lại `components/store-detail-modal.jsx` và xác nhận khối report cũ hiện hoàn toàn là code chết:
  - user path thật chỉ `router.push('/store/report/[id]')`
  - state `reportOpen`, `reportMode`, `reportReasons`, `reportSubmitting`, `reportError`, `reportSuccess` không còn là đường dùng thật
  - khối form report/map picker trong modal là bản lặp cũ của màn route riêng
- Đã thêm browser coverage mới cho report flow tại `e2e/store-report.spec.js`, khóa 5 nhánh thực tế:
  - user gửi `edit` report với payload chuẩn hóa và tọa độ mới
  - user gửi `reason_only` report không kèm `proposed_changes`
  - chặn submit khi số điện thoại sai
  - chặn submit khi không có thay đổi
  - admin approve/reject đúng nhánh mutation
- Đã xác nhận bug UI thật ở admin reports: `DialogContent` mặc định nằm dưới overlay (`z-50` dưới `z-300`), khiến dialog xác nhận có thể hiện nhưng không click được; đã sửa z-index dùng chung ở primitive dialog.
- Đã tách logic thuần của report sang `helper/storeReportFlow.js`, gom:
  - normalize tọa độ
  - build `proposed_changes`
  - validate submit cho `edit` / `reason_only`
  - build payload `store_reports`
  - summary cho admin reports
- Đã tách controller của form report sang `helper/useStoreReportFormController.js`; `components/store-report-form.jsx` hiện chủ yếu còn render UI và bind state/handler.
- Đã tách orchestration admin reports sang `helper/useStoreReportsController.js`; `pages/store/reports.js` hiện chủ yếu còn render list/card/dialog.
- Đã thêm unit test cho helper report tại `__tests__/helper/storeReportFlow.test.js`.
- Đã xác nhận flow report hiện tại không còn submit trong modal chi tiết nữa; nút report trên `store-detail-modal` chuyển sang route riêng `/store/report/[id]`.
- Đã xác nhận `components/store-detail-modal.jsx` vẫn còn giữ nguyên cả một khối report state + submit logic cũ, tức đang có logic chết/lặp với `components/store-report-form.jsx`.
- Đã xác nhận `components/store-report-form.jsx` hiện là nơi user thật dùng để gửi report, nhưng đang tự giữ toàn bộ normalize/validate/build payload trong component.
- Đã xác nhận `pages/store/reports.js` vẫn đang tự gánh toàn bộ load pending reports, approve/reject, apply `proposed_changes`, cache sync và confirm dialog.
- Confirmed the mobile-save failure path with a browser regression test: the create action bar CTA was visually correct but functionally outside the form, so clicking it never triggered the final submit handler.
- Identified a second root cause on the create screen: the mobile final-step CTA is rendered outside the form by `StoreStepFormLayout`, so `type="submit"` on that button does not actually submit the form.
- New bug report under investigation: user still cannot finish saving from the create flow even after the GPS-loop fix, so the next step is to trace the final-step submit path end to end.
- Replaced the looping location-step bootstrap with a one-shot step-entry effect shared by create and supplement, and re-checked the regular edit flow to confirm it does not auto-fetch GPS on step entry.
- Identified root cause of repeated GPS fetch on create step 3: the step-entry effect depends on `resolvingAddr`, while the geolocation routine itself toggles `resolvingAddr`, creating a re-entry loop.
- Re-ran `npm.cmd run lint`: currently passes again, which suggests the earlier failure was artifact-related rather than a fixed code error.
- Đã đọc lại đầy đủ `AGENTS.md`, docs bắt buộc, `docs/current-work.md`, `docs/regression-checklist.md`, và các skill liên quan.
- Đã xác nhận commit đích `3400fd95d740af79b1e4910a8c1decad9dd42909` tồn tại và có thể đọc lại code cũ.
- Đã so sánh `pages/store/create.js` hiện tại với commit đích và kéo logic create flow chính quay về đúng nhịp cũ.
- Đã tách cụm logic thuần của create flow sang `helper/storeCreateFlow.js`, gồm:
  - parse Google Maps URL
  - suy ra quận/xã gần nhất từ GPS
  - build message lỗi trùng số điện thoại
  - validate dữ liệu bước 2
  - chọn tọa độ cuối trước khi submit
  - build payload insert create
  - build step config
  - quyết định mobile action bar
- Đã nối lại `pages/store/create.js` sang helper mới với thay đổi tối thiểu, vẫn giữ side effect ở page như fetch GPS, duplicate gate cuối, gọi Supabase, cache append, flash message, confirm dialog, redirect.
- Đã thêm test bảo vệ cho helper create flow tại `__tests__/helper/storeCreateFlow.test.js`.
- Đã rà lại code sau refactor để chắc helper chỉ giữ logic thuần, chưa kéo side effect ra ngoài page.
- Đã kiểm tra repo hiện chưa có Playwright/Cypress config và chưa có script E2E trong `package.json`.
- Đã rà các dependency chính của create flow cho browser test: `AuthContext`, `storeCache`, `duplicateCheck`, `geolocation`, `StoreLocationPicker`.
- Đã thêm Playwright vào repo và cấu hình `playwright.config.js` để tự chạy app local trước khi test.
- Đã thêm test harness hẹp dựa trên `window.__STOREVIS_E2E__` cho các dependency trực tiếp của create flow:
  - auth role
  - stores cache
  - geolocation / compass
  - map picker test double
- Đã giữ mock insert store ở lớp browser test bằng network interception thay vì cấy sâu thêm logic test vào production flow.
- Đã viết 3 browser tests cho create flow:
  - create đầy đủ qua bước vị trí
  - cảnh báo nghi trùng ở bước 1 và vẫn tạo tiếp
  - quick-save ở bước 2 cho telesale
- Đã chạy Playwright thật trên Chromium và xử lý 1 lỗi fixture ban đầu gây match trùng giả ở case non-duplicate.
- Đã rà lại `pages/store/edit/[id].js`, `components/store/store-supplement-form.jsx`, `helper/storeEditFlow.js`.
- Đã xác nhận `supplement` đang có step-layout riêng còn `edit` vẫn là form dài riêng, nên mục tiêu hợp nhất layout cần đi qua một shared component.
- Đã xác nhận các điểm lệch nên ưu tiên đồng bộ theo `create`:
  - `edit` còn parse Google Maps URL inline
  - `edit` dùng `getCachedStores()` cho duplicate phone thay vì đường đọc như create
  - `getFinalCoordinates` và message duplicate phone đang bị nhân bản
  - `buildEditUpdates` chưa title-case `address_detail`, `ward`, `district` như create/supplement
- Đã tạo helper dùng chung `helper/storeFormShared.js` để gom:
  - parse Google Maps URL
  - chọn tọa độ cuối cho form
  - message trùng số điện thoại
- Đã chuyển `helper/storeEditFlow.js` sang dùng helper chung và đồng bộ `buildEditUpdates()` theo rule title-case của create/supplement.
- Đã chuyển `pages/store/edit/[id].js` sang step-based layout 3 bước cho edit, và giữ supplement dùng cùng layout/component step.
- Đã thêm `components/store/store-step-form-layout.jsx` để `create` và `edit/supplement` dùng cùng khung layout.
- Đã cập nhật browser E2E cho `edit` và `supplement`.
- Đã xác nhận sau đợt trước `pages/store/create.js` và `pages/store/edit/[id].js` vẫn còn chứa khá nhiều side effect/controller logic; đây là phần còn lại của bước 4 cần làm tiếp.
- Đã tách orchestration của `create` sang `helper/useStoreCreateController.js` và giữ `pages/store/create.js` chủ yếu còn render + wiring UI.
- Đã tách orchestration của `edit/supplement` sang `helper/useStoreEditController.js` và giữ `pages/store/edit/[id].js` chủ yếu còn render + wiring UI.
- Đã chạy lại verify sau đợt tách orchestration:
  - `npm.cmd run lint`
  - `npm.cmd test`
  - `npm.cmd run text:check`
  - `npm.cmd run test:e2e -- e2e/store-create.spec.js e2e/store-edit.spec.js`
- Đang bổ sung thêm browser coverage cho orchestration mới tách, ưu tiên các nhánh controller chưa được khóa trước đó:
  - supplement 2 bước khi store đã có tọa độ
  - redirect guard khi guest mở màn edit thường
- Đã bổ sung thêm 2 browser tests cho orchestration `edit/supplement`:
  - supplement 2 bước khi store đã có tọa độ, không render step location và không gửi lại lat/lng
  - guest mở màn edit thường bị redirect sang login
- Đã xác nhận khoảng hở chính của test create hiện tại:
  - E2E luôn bật `window.__STOREVIS_E2E__`, nên `StoreLocationPicker` thật không chạy
  - geolocation trong test luôn trả về success tĩnh, không mô phỏng được case bước 1 qua nhưng bước vị trí lỗi
  - viewport mặc định là desktop, nên path mobile ở bước vị trí chưa từng được kiểm tra
- Đã vá màn create để mobile step vị trí luôn hiện fallback dán Google Maps, không chỉ riêng admin.
- Đã thêm browser test cho path mobile bị bỏ sót: guest mobile vẫn thấy fallback Google Maps ở bước vị trí.
- Đã xác nhận root cause của bug `Dẫn đường` trên `map`:
  - `toggleUserHeadingRotation()` lấy snapshot `userLocation` cũ trước khi chờ promise GPS
  - `refreshUserLocation()` trước đó trả `null` ngay nếu đang có request GPS chạy dở
  - khi người dùng bấm bật dẫn đường đúng lúc request GPS đầu trang còn đang chạy, màn hình có thể không lấy được vị trí để bám theo dù GPS sau đó vẫn trả về
- Đã tách rule lọc khu vực của `map` sang `helper/mapFilter.js` và khóa bằng unit test.
- Đã bổ sung browser coverage mới cho `map` tại `e2e/store-map.spec.js`, gồm:
  - rule quận/huyện và xã/phường mới trên sidebar
  - case bật `Dẫn đường` khi lần lấy GPS đầu trang còn đang chạy dở
- Đã mở rộng harness E2E geolocation bằng `delayMs` để tái hiện đúng race condition của màn `map`.
- Đã ổn định lại 1 test search E2E cũ bằng cách chờ URL sync bằng polling thay vì phụ thuộc event điều hướng debounce của `router.replace`.

### Done
- Hoàn tất test-first cho search/home bằng browser tests sát hành vi thật ở trang `/`.
- Hoàn tất tách controller/orchestration của `pages/index.js` sang `helper/useHomeSearchController.js` để page mỏng hơn và dễ kiểm soát regression hơn.
- Hoàn tất smoke test browser cho nút report trong detail modal, khóa đúng đường người dùng thật từ trang tìm kiếm sang route report riêng.
- Hoàn tất dọn code chết ở `components/store-detail-modal.jsx`; modal không còn giữ một implementation report thứ hai bị lệch với flow thật.
- Hoàn tất test-first cho report flow bằng browser tests đủ sát hành vi thật, không chỉ mock unit-level.
- Hoàn tất fix validation bị thiếu ở report form:
  - số điện thoại sai không còn submit được
  - case không có thay đổi không còn lọt qua
- Hoàn tất fix bug click dialog confirm ở admin reports bằng cách nâng `DialogContent` lên trên overlay ở primitive dùng chung.
- Hoàn tất tách logic report sang helper/controller:
  - `helper/storeReportFlow.js`
  - `helper/useStoreReportFormController.js`
  - `helper/useStoreReportsController.js`
- Hoàn tất làm mỏng `components/store-report-form.jsx` và `pages/store/reports.js` theo hướng render + wiring UI.
- Fixed the mobile final-step save path by moving the shared mobile action bar inside `StoreStepFormLayout`'s form, so submit-capable CTAs now participate in the real form submit flow.
- Fixed repeated GPS fetching and map reload on the location step by introducing a shared one-shot step-entry hook and applying it to create/supplement; regular edit was verified to stay at zero auto-GPS calls on step entry.
- Locked ESLint config to ignore generated artifacts from Next/Playwright/coverage so full-repo lint no longer depends on transient folders.
- Khôi phục logic create flow theo commit `3400fd95d740af79b1e4910a8c1decad9dd42909` ở phạm vi `pages/store/create.js`.
- Đưa duplicate check chính quay lại bước 1 bằng GPS + so sánh gần đây/toàn hệ thống.
- Đưa create flow quay lại step indicator + 3 bước (`Tên` -> `Thông tin` -> `Vị trí`).
- Bỏ duplicate step riêng ở giữa bước 2 và bước vị trí.
- Khôi phục final duplicate gate dùng `findNearbySimilarStores` + `findGlobalExactNameMatches` + `mergeDuplicateCandidates` trước khi insert.
- Hoàn tất tách logic thuần của create flow sang `helper/storeCreateFlow.js`.
- Hoàn tất thêm test hồi quy cho helper create flow trong `__tests__/helper/storeCreateFlow.test.js`.
- Hoàn tất hạ tầng browser E2E tối thiểu cho repo bằng Playwright.
- Hoàn tất test harness hẹp để browser test create flow ổn định mà không phụ thuộc Supabase/GPS/Google Maps thật.
- Hoàn tất 3 browser tests trực tiếp cho create flow.
- Hoàn tất gộp shared helper giữa create/edit/supplement tại `helper/storeFormShared.js`.
- Hoàn tất đồng bộ các logic "có thể đã sót" của edit theo create ở các điểm:
  - parse Google Maps URL
  - final coordinate resolution
  - duplicate phone message
  - title-case cho `address_detail`, `ward`, `district`
  - dùng `getOrRefreshStores()` cho read path check số điện thoại / load store hiện tại
- Hoàn tất đưa màn edit sang cùng layout step-based với create/supplement.
- Hoàn tất dùng chung component step form cho `edit` và `supplement`, vẫn giữ riêng branch:
  - edit direct update
  - supplement lock field
  - guest supplement tạo `store_reports`
- Hoàn tất thêm browser smoke test cho:
  - admin edit flow
  - guest supplement flow
- Hoàn tất tách controller/orchestration của `create` và `edit/supplement` ra khỏi page để page mỏng hơn, dễ đọc hơn.
- Hoàn tất test bù cho orchestration mới tách ở nhánh `edit/supplement`:
  - supplement 2 bước khi store đã có tọa độ
  - redirect guard khi guest vào `edit` không đúng quyền
- Hoàn tất điều tra vì sao test create vẫn pass dù user không hoàn thành được bước cuối:
  - suite cũ không cover mobile path
  - suite cũ không cover geolocation failure ở step vị trí
  - suite cũ bypass map picker thật bằng test double
- Hoàn tất vá fallback UI ở bước cuối create để người dùng mobile vẫn có đường hoàn thành qua Google Maps link.
- Hoàn tất fix màn `map` để bật `Dẫn đường` vẫn bám được vị trí người dùng ngay cả khi request GPS trước đó còn đang chạy dở.
- Hoàn tất đổi rule lọc khu vực trên `map`:
  - chọn quận/huyện mà chưa chọn xã trong quận đó thì hiện toàn bộ quận/huyện
  - nếu đã chọn xã trong quận đó thì chỉ hiện các xã đã chọn
- Hoàn tất thêm test hồi quy cho `map` ở cả mức unit và browser.
- Hoàn tất ổn định lại full E2E suite sau khi phát hiện 1 case `search` bị flaky do chờ `waitForURL`.
- Hoàn tất xác minh lỗi runtime `Cannot access 'routeStops' before initialization` trên `/map`:
  - đối chiếu trace lỗi với mã hiện tại
  - xác nhận mã hiện tại đã ở đúng thứ tự khai báo
  - xác nhận `/map` render lại bình thường qua browser test hiện tại
  - chốt đây là lỗi phát sinh từ snapshot compile/hot-reload cũ trong lúc Turbopack đang refresh, không phải do thứ tự mã hiện tại đang còn sai trên file
- Hoàn tất fix bug camera của `/map` khi bật `Dẫn đường` lúc chưa có tuyến vẽ sẵn:
  - route vẫn được build để có geometry thật
  - camera không còn bị `fitBounds` sang toàn tuyến trong lúc đang vào chế độ bám người dùng
  - sau khi thoát dẫn đường, route panel vẫn hiển thị summary như cũ
- Hoàn tất thêm test và tách tiếp logic navigation của `map`:
  - thêm unit test cho helper navigation mới
  - tách helper thuần `mapNavigation.js`
  - tách hook orchestration `useMapNavigationController.js`
  - nối lại `pages/map.js` với behavior cũ và giữ xanh các test map hiện có

### Verification
- Đã verify lại sau khi tách logic search/home:
  - `npm.cmd run test:e2e -- e2e/store-search.spec.js`
  - `npm.cmd test -- __tests__/helper/homeSearch.test.js __tests__/helper/storeSearch.test.js`
  - `npx.cmd eslint pages/index.js helper/useHomeSearchController.js e2e/store-search.spec.js --ext .js,.jsx --quiet`
  - `npm.cmd run lint`
  - `npm.cmd test`
  - `npm.cmd run text:check`
  - `npm.cmd run test:e2e -- e2e/store-create.spec.js e2e/store-edit.spec.js e2e/store-report.spec.js e2e/store-search.spec.js`
- Kết quả mới nhất:
  - search E2E: `4 passed (4)`
  - helper search tests: `2 passed (2)` files, `50 passed (50)` tests
  - `npm.cmd run lint`: pass
  - `npm.cmd test`: `10 passed (10)` files, `206 passed (206)` tests
  - `npm.cmd run text:check`: không phát hiện lỗi mã hóa trong repo
  - combined E2E create/edit/report/search: `19 passed (19)`
- Checklist đã đi lại thêm:
  - `Search Flow`
- Đã verify lại sau khi xóa report logic cũ khỏi detail modal:
  - `npm.cmd run lint`
  - `npm.cmd test`
  - `npm.cmd run text:check`
  - `npm.cmd run test:e2e -- e2e/store-report.spec.js`
  - `npm.cmd run test:e2e -- e2e/store-create.spec.js e2e/store-edit.spec.js e2e/store-report.spec.js`
- Kết quả mới nhất:
  - `npm.cmd run lint`: pass
  - `npm.cmd test`: `10 passed (10)` files, `206 passed (206)` tests
  - `npm.cmd run text:check`: không phát hiện lỗi mã hóa trong repo
  - `npm.cmd run test:e2e -- e2e/store-report.spec.js`: `6 passed (6)`
  - `npm.cmd run test:e2e -- e2e/store-create.spec.js e2e/store-edit.spec.js e2e/store-report.spec.js`: `15 passed (15)`
- Checklist đã đi lại:
  - `Checklist chung`
  - `Edit / Supplement / Report`
  - `Stores Read / Cache`
  - `Tiếng Việt / UI Safety`
- Đã chạy mới sau đợt tách logic report:
  - `npm.cmd run lint`
  - `npm.cmd test`
  - `npm.cmd run text:check`
  - `npm.cmd run test:e2e -- e2e/store-create.spec.js e2e/store-edit.spec.js e2e/store-report.spec.js`
- Kết quả mới:
  - `npm.cmd run lint`: pass
  - `npm.cmd test`: `10 passed (10)` files, `206 passed (206)` tests
  - `npm.cmd run text:check`: không phát hiện lỗi mã hóa
  - `npm.cmd run test:e2e -- e2e/store-create.spec.js e2e/store-edit.spec.js e2e/store-report.spec.js`: `14 passed (14)`
- Verified the mobile final-step save fix with:
  - `npm.cmd run test:e2e -- e2e/store-create.spec.js`
  - `npm.cmd run lint`
  - `npm.cmd test`
  - `npm.cmd run text:check`
  - `npm.cmd run test:e2e -- e2e/store-create.spec.js e2e/store-edit.spec.js`
- Verified the geolocation loop fix with:
  - `npm.cmd run lint`
  - `npm.cmd test`
  - `npm.cmd run text:check`
  - `npm.cmd run test:e2e -- e2e/store-create.spec.js e2e/store-edit.spec.js`
- Re-ran full checks after tightening ESLint ignores:
  - `npm.cmd run lint`
  - `npm.cmd test`
  - `npm.cmd run text:check`
  - `npm.cmd run test:e2e`
  - `npm.cmd run lint` (again after Playwright regenerated `test-results`)
- Đã chạy:
  - `npm.cmd run lint`
  - `npm.cmd test`
  - `npm.cmd run text:check`
  - `npm.cmd run test:e2e -- e2e/store-create.spec.js`
  - `npm.cmd run test:e2e -- e2e/store-create.spec.js e2e/store-edit.spec.js`
  - `npm.cmd run lint -- --quiet e2e/store-edit.spec.js`
  - `npm.cmd run test:e2e -- e2e/store-edit.spec.js`
  - `npx.cmd eslint pages/store/create.js e2e/store-create.spec.js --ext .js,.jsx --quiet`
  - `npm.cmd run test:e2e -- e2e/store-create.spec.js`
- Kết quả gần nhất:
  - `npm.cmd test`: `9 passed (9)` files, `196 passed (196)` tests
  - `npm.cmd run test:e2e -- e2e/store-edit.spec.js`: `4 passed (4)`
  - `npm.cmd run test:e2e -- e2e/store-create.spec.js`: `4 passed (4)`
  - `npm.cmd run test:e2e -- e2e/store-create.spec.js e2e/store-edit.spec.js`: `8 passed (8)`
  - `npm.cmd run text:check`: không phát hiện lỗi mã hóa trong repo
- Đã chạy mới cho đợt fix `map`:
  - `npx.cmd eslint pages/map.js helper/mapFilter.js __tests__/helper/mapFilter.test.js helper/geolocation.js lib/e2e-test-mode.js e2e/store-map.spec.js e2e/store-search.spec.js --ext .js,.jsx --quiet`
  - `npm.cmd test -- __tests__/helper/mapFilter.test.js`
  - `npm.cmd run lint`
  - `npm.cmd test`
  - `npm.cmd run text:check`
  - `npm.cmd run test:e2e -- e2e/store-map.spec.js`
  - `npm.cmd run test:e2e -- e2e/store-search.spec.js --grep "search và filter sync lên URL rồi khôi phục lại state từ route"`
  - `npm.cmd run test:e2e`
- Kết quả mới nhất:
  - map helper test: `1 passed (1)` file, `5 passed (5)` tests
  - `npm.cmd run lint`: pass
  - `npm.cmd test`: `11 passed (11)` files, `211 passed (211)` tests
  - `npm.cmd run text:check`: không phát hiện lỗi mã hóa trong repo
  - `npm.cmd run test:e2e -- e2e/store-map.spec.js`: `2 passed (2)`
  - full `npm.cmd run test:e2e`: `21 passed (21)`
- Checklist đã đi lại thêm:
  - `Checklist chung`
  - `Map Flow`
  - `Stores Read / Cache`
  - `Tiếng Việt / UI Safety`
- Đã chạy thêm để xác minh lỗi runtime `/map` sau báo lỗi:
  - `npm.cmd run lint -- --quiet pages/map.js helper/useMapRouteController.js helper/mapRoute.js helper/mapFilter.js e2e/store-map.spec.js __tests__/helper/mapRoute.test.js __tests__/helper/mapFilter.test.js`
  - `npm.cmd test -- __tests__/helper/mapRoute.test.js __tests__/helper/mapFilter.test.js`
  - `npm.cmd run test:e2e -- e2e/store-map.spec.js`
- Kết quả mới nhất:
  - lint phần `map`: pass
  - unit test `mapRoute` + `mapFilter`: `2 passed (2)` files, `14 passed (14)` tests
  - browser test `map`: `6 passed (6)`
- Đã chạy thêm cho bug `Dẫn đường` + camera:
  - `npm.cmd run test:e2e -- e2e/store-map.spec.js --grep "bật dẫn đường khi chưa có tuyến vẽ sẵn"`
  - `npx.cmd eslint pages/map.js helper/useMapRouteController.js lib/e2e-test-mode.js e2e/store-map.spec.js --ext .js,.jsx --quiet`
  - `npm.cmd run test:e2e -- e2e/store-map.spec.js`
  - `npm.cmd run lint`
- Kết quả mới nhất:
  - test mới bug `Dẫn đường`: `1 passed (1)`
  - full browser test `map`: `7 passed (7)`
  - targeted eslint: pass
  - full `npm.cmd run lint`: pass
- Đã chạy thêm sau đợt tách logic navigation:
  - `npm.cmd test -- __tests__/helper/mapNavigation.test.js __tests__/helper/mapRoute.test.js __tests__/helper/mapFilter.test.js`
  - `npx.cmd eslint pages/map.js helper/useMapNavigationController.js helper/mapNavigation.js helper/useMapRouteController.js lib/e2e-test-mode.js e2e/store-map.spec.js __tests__/helper/mapNavigation.test.js --ext .js,.jsx --quiet`
  - `npm.cmd run test:e2e -- e2e/store-map.spec.js`
  - `npm.cmd run lint`
- Kết quả mới nhất:
  - helper tests navigation/route/filter: `3 passed (3)` files, `20 passed (20)` tests
  - full browser test `map`: `7 passed (7)`
  - full `npm.cmd run lint`: pass

### Open Questions
- Không có blocker mới; hướng hiện tại là thêm harness E2E hẹp thay vì phụ thuộc dịch vụ thật.

### Risks / Next
- `pages/map.js` vẫn là màn nặng nhất còn lại; hiện đã có browser coverage cho 2 nhánh dễ vỡ mới fix, nhưng vẫn chưa phủ hết các nhánh route panel, marker interaction, search suggestion, và route optimize/build lỗi.
- `pages/store/verify.js` cũng chưa có browser coverage dù có nhánh admin mutation và sync cache, nên nên đi sau search/map.
- Report flow đã sạch hơn ở `store-detail-modal`, nhưng `pages/store/report/[id].js` hiện vẫn phụ thuộc controller + helper mới mà chưa có hook-level unit test; coverage cho orchestration vẫn chủ yếu dựa vào browser smoke và helper unit tests.
- The fixed mobile submit path is covered for create; edit/supplement currently use direct `onClick` mobile actions, so they were regression-checked via the shared E2E suite after the layout change and remain green.
- Regression coverage for the loop fix is still E2E-harness-based; it proves call counts for mocked geolocation, but not real browser GPS provider behavior.
- E2E is green, but it still runs with `window.__STOREVIS_E2E__` and mocked network writes, so it validates form orchestration better than backend integration.
- `pages/store/create.js` có text tiếng Việt hiển thị trực tiếp nên patch cần tránh làm hỏng UTF-8.
- Harness E2E hiện đã phủ `create`, `edit`, `supplement`, `report`, `search`, `map`; `verify`, `import/export` vẫn chưa có browser coverage.
- Test network vẫn mock ở lớp Playwright; nếu payload/response Supabase thay đổi, cần cập nhật fixture response trong test.
- Browser test hiện đang dùng test double cho map picker; phù hợp để khóa business flow, nhưng chưa thay cho việc kiểm tra map thật ở vài smoke test thủ công.
- Controller đã được tách khỏi page, nhưng hiện chưa có unit-test mức hook vì repo chưa có harness React hook test; coverage orchestration đang dựa trên browser smoke + helper unit tests.
- Case geolocation "success ở bước 1 nhưng timeout ở bước vị trí" hiện mới được xác định bằng phân tích code/path coverage, chưa có browser test tái hiện đầy đủ vì harness E2E geolocation override đang là static.
- Nếu dev server còn giữ snapshot cũ của Turbopack, người dùng vẫn có thể gặp lại stack trace cũ cho đến khi full reload hoặc restart server; đây là rủi ro môi trường dev, không phải do thứ tự khai báo hiện còn sai trong file hiện tại.
- Camera regression mới được khóa ở test mode bằng camera events tự ghi nhận từ code gọi `easeTo` / `fitBounds`; điều này đủ để chặn bug orchestration hiện tại nhưng chưa thay thế hoàn toàn cho smoke test thủ công với MapLibre thật.
- `pages/map.js` vẫn còn 2 cụm lớn chưa tách tiếp:
  - search/suggestion/filter panel
  - drag-and-drop route list / auto-scroll
