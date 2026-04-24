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
- Gộp các logic trước đó được đánh dấu là "có thể đã sót" vào cùng chuẩn xử lý với màn create nếu thực chất không nên khác.
- Hợp nhất `create`, `edit`, `supplement` về cùng kiểu layout step-based như màn create hiện tại, nhưng vẫn giữ nguyên business branch cũ của từng flow.
- Chỉ dùng chung phần nào thực sự chung; không xóa khác biệt nghiệp vụ giữa create, edit, supplement.
- Tiếp tục bước 4 bằng cách tách orchestration/controller khỏi page:
  - tách `create` trước
  - tách `edit/supplement` sau
  - thêm test bù cho phần orchestration vừa tách
- Điều tra regression mới ở bước cuối màn create: người dùng không thể hoàn thành step vị trí trong một số điều kiện thực tế dù E2E vẫn pass.
- Audit lại toàn bộ test hiện có để xác nhận chúng thực sự chạy đúng, không pass giả, và chỉ ra khoảng hở coverage còn lại.

### In Scope
- `pages/store/create.js`.
- `e2e/store-create.spec.js`.
- toàn bộ script test/lint/e2e hiện có trong repo.
- các file test dưới `__tests__/` và `e2e/`.
- `pages/store/edit/[id].js`.
- `components/store/store-supplement-form.jsx` hoặc component layout thay thế.
- Helper flow dùng chung giữa create/edit/supplement.
- Hook/controller mới nếu cần để kéo side effects ra khỏi page.
- Test helper và test browser cần cập nhật theo phạm vi refactor này.
- Cập nhật lại `docs/current-work.md` theo task hiện tại.

### Out of Scope
- Không đổi rule nghiệp vụ của duplicate detection, create quick-save, supplement guest/admin, hay edit trực tiếp.
- Không refactor các flow khác như search, map, verify, reports, import/export ngoài phần helper/layout bị dùng chung bắt buộc phải chạm.
- Không gom logic khác nhau một cách cơ học nếu đó là khác biệt nghiệp vụ thật.
- Không thêm dependency mới ngoài phạm vi test/tooling đã có.
- Không mở rộng sửa map thật ngoài phạm vi cần thiết để khôi phục khả năng hoàn thành bước cuối của create.
- Không biến audit test thành refactor lớn ngoài phạm vi phát hiện vấn đề thật sự.

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

### Plan
- Investigate why store creation still cannot be completed from the final location step, reproduce it with browser-level checks, identify the exact break point, then add regression coverage for the real failing path.
- Fix repeated GPS bootstrap on location step by running auto-location only once per step entry, then cover it with regression checks for create/supplement and re-review edit path.
 - Lock ESLint away from generated artifacts (`test-results`, `playwright-report`, `coverage`) so repo-wide lint stays deterministic.
- Cập nhật working memory rồi mới sửa code.
- Tái hiện và chỉ ra vì sao E2E hiện tại không bắt được bug ở bước cuối create.
- Vá đúng nhánh UI khiến người dùng thật không còn đường hoàn thành bước cuối.
- Thêm browser test cho case bị bỏ sót hiện tại.
- Chạy lại toàn bộ test/lint/e2e hiện có.
- Rà cấu hình và mã test để phát hiện `skip/only`, mock quá mạnh, hay test double che mất đường logic thật.
- Báo rõ test nào đáng tin, test nào còn khoảng hở.
- Tách orchestration của `create` khỏi `pages/store/create.js` sang hook/controller riêng, chỉ để page giữ render + wiring UI.
- Tách orchestration của `edit/supplement` khỏi `pages/store/edit/[id].js` theo cùng hướng, giữ riêng business branch của edit và supplement.
- Giữ riêng các branch nghiệp vụ:
  - create duplicate gate + quick-save
  - supplement locks + guest report branch
  - edit direct update
- Cập nhật test helper/browser theo vùng orchestration bị ảnh hưởng.
- Verify theo checklist `Checklist chung`, `Create Flow`, `Edit / Supplement / Report`, `Stores Read / Cache`, `Map Flow`, `Tiếng Việt / UI Safety`.

### Progress
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

### Done
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

### Verification
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

### Open Questions
- Không có blocker mới; hướng hiện tại là thêm harness E2E hẹp thay vì phụ thuộc dịch vụ thật.

### Risks / Next
- The fixed mobile submit path is covered for create; edit/supplement currently use direct `onClick` mobile actions, so they were regression-checked via the shared E2E suite after the layout change and remain green.
- Regression coverage for the loop fix is still E2E-harness-based; it proves call counts for mocked geolocation, but not real browser GPS provider behavior.
- E2E is green, but it still runs with `window.__STOREVIS_E2E__` and mocked network writes, so it validates form orchestration better than backend integration.
- `pages/store/create.js` có text tiếng Việt hiển thị trực tiếp nên patch cần tránh làm hỏng UTF-8.
- Harness E2E hiện đã phủ `create`, `edit`, `supplement`, nhưng `reports`, `verify`, `search/map` vẫn chưa có browser coverage.
- Test network vẫn mock ở lớp Playwright; nếu payload/response Supabase thay đổi, cần cập nhật fixture response trong test.
- Browser test hiện đang dùng test double cho map picker; phù hợp để khóa business flow, nhưng chưa thay cho việc kiểm tra map thật ở vài smoke test thủ công.
- Controller đã được tách khỏi page, nhưng hiện chưa có unit-test mức hook vì repo chưa có harness React hook test; coverage orchestration đang dựa trên browser smoke + helper unit tests.
- Case geolocation "success ở bước 1 nhưng timeout ở bước vị trí" hiện mới được xác định bằng phân tích code/path coverage, chưa có browser test tái hiện đầy đủ vì harness E2E geolocation override đang là static.
