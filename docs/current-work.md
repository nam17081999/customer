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

### Task Type
- Bug Fix

### Goal
- Viết test trước rồi sửa 3 lỗi cache/UI đã phát hiện: local patch che update từ user khác, badge admin stale, event deduplicate không buộc refetch.

### In Scope
- `lib/storeCache.js`
- `components/layout/app-navbar.jsx`
- `pages/store/deduplicate.js`
- `helper/useStoreReportsController.js`
- Helper/test liên quan đến cache mutation, navbar sync, deduplicate event, report event.

### Out of Scope
- Không đổi business rule create/edit/delete/verify/report/import.
- Không refactor lớn page store/map/search ngoài phần cần để test hoặc sửa lỗi.
- Không sửa các thay đổi đang có sẵn ngoài scope: `e2e/store-map.spec.js`, import-flow files.
- Không thêm dependency mới.

### Must Preserve
- Public store reads vẫn đi qua `getOrRefreshStores()`.
- Soft delete vẫn dùng `deleted_at`, không hard delete.
- Store cache vẫn chỉ cache rows `deleted_at IS NULL`.
- Local cache mutation vẫn hỗ trợ UI cập nhật nhanh sau thao tác thành công.
- Vietnamese text trong UI/test không bị hỏng encoding.
- Event `storevis:stores-changed` vẫn đồng bộ được home/map/telesale khi cần.

### Required Verification
- Test mới phải fail trước khi sửa và pass sau khi sửa.
- Chạy test cache helper, navbar sync, deduplicate event, report event.
- Chạy lint cho file bị sửa nếu khả thi.
- Đối chiếu checklist: Stores Read / Cache, Store Create/Edit/Delete/Verify/Report, Import/Deduplicate, Tiếng Việt / UI Safety.

### Plan
- Thêm test tái hiện từng finding.
- Chạy test để xác nhận fail trước sửa.
- Sửa root cause tối thiểu.
- Chạy lại test và lint liên quan.
- Cập nhật Done/Verification/Risks trước khi báo cáo.

### Progress
- Đã viết test trước cho cache reconcile, navbar counts, deduplicate event, report event.
- Đã chạy test trước khi sửa và xác nhận fail đúng các behavior mong muốn.
- Đã sửa cache local mutation để giữ mốc sync cũ và buộc reconcile server.
- Đã thêm helper/event để navbar refresh counts khi stores/reports đổi.
- Đã sửa deduplicate event để yêu cầu refetch toàn bộ sau invalidate cache.

### Done
- `lib/storeCache.js`: local append/update/remove không đẩy `lastSyncedAt` vượt mốc server đã sync; cache được đánh dấu `needsServerReconcile` để lần đọc kế tiếp merge thay đổi server còn thiếu.
- `components/layout/app-navbar.jsx`: badge admin đọc qua `getOrRefreshStores()` và refresh khi có `storevis:stores-changed`, `storevis:reports-changed`, `pageshow`.
- `pages/store/deduplicate.js`: sau merge dispatch `shouldRefetchAll: true`.
- `helper/useStoreReportsController.js`: approve/reject report dispatch event report changed để navbar refresh.
- Đã thêm test helper cho các behavior mới.

### Verification
- Trước sửa: `npm.cmd test -- --run __tests__/helper/storeCache.test.js __tests__/helper/appNavbarCounts.test.js __tests__/helper/storeDeduplicateEvents.test.js` fail đúng kỳ vọng: helper mới chưa có và `lastSyncedAt` bị đẩy lên mốc local patch.
- Sau sửa: `npm.cmd test -- --run __tests__/helper/storeCache.test.js __tests__/helper/appNavbarCounts.test.js __tests__/helper/storeDeduplicateEvents.test.js __tests__/helper/storeReportEvents.test.js` passed 4 files / 13 tests.
- Lint: `npm.cmd run lint -- lib/storeCache.js components/layout/app-navbar.jsx pages/store/deduplicate.js helper/useStoreReportsController.js helper/appNavbarCounts.js helper/storeDeduplicateEvents.js helper/storeReportEvents.js __tests__/helper/storeCache.test.js __tests__/helper/appNavbarCounts.test.js __tests__/helper/storeDeduplicateEvents.test.js __tests__/helper/storeReportEvents.test.js` passed.
- `npm.cmd run text:check` passed: không phát hiện lỗi mã hóa trong repo.

### Open Questions
- Không có blocker.

### Risks / Next
- Chưa chạy E2E browser thực tế cho create/edit/delete/verify/report/deduplicate.
- Worktree vẫn có thay đổi cũ ngoài scope ở import/map; không tính vào task cache này.
- Checklist đã đối chiếu: Stores Read / Cache, Store Create/Edit/Delete/Verify/Report, Import/Deduplicate, Tiếng Việt / UI Safety.

