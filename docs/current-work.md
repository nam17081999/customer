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
- Review / Regression Check

### Goal
- Rà test và tài liệu để xác nhận đã phản ánh các thay đổi modal chi tiết gần đây; cập nhật phần còn thiếu nếu có.

### Why
- Modal chi tiết đã đổi UI/action nhiều lần; test hoặc tài liệu cũ có thể không còn khớp behavior hiện tại.

### In Scope
- `components/store-detail-modal.jsx`
- Test/e2e liên quan modal chi tiết, edit/supplement/report/map nếu có.
- Docs liên quan UI modal, admin/non-admin action, telesale hiển thị trong modal.

### Out of Scope
- Không đổi behavior modal trừ khi phát hiện test/docs yêu cầu fix nhỏ để khớp behavior vừa chốt.
- Không thêm dependency mới.
- Không đổi luồng quản lý admin: bổ sung, chỉnh sửa, lịch sử, báo cáo, xóa mềm.
- Không đổi route `/map` nội bộ, cache, database, create/edit/report/verify logic.
- Không thêm dependency mới.

### Must Preserve
- Giữ link Google Maps chỉ hiện khi cửa hàng có tọa độ hợp lệ.
- Giữ link gọi điện dùng số điện thoại hiện có và không làm hỏng tiếng Việt trong UI.
- Giữ nút bản đồ nội bộ `/map?storeId=...&lat=...&lng=...` nếu đang cần cho flow điều hướng trong app.
- Giữ các action tuyến/báo cáo/xóa hoạt động đúng.
- Admin vẫn vào `/store/edit/[id]`; non-admin bổ sung vẫn vào `/store/edit/[id]?mode=supplement`.
- Giữ kích thước nút đủ dễ bấm và tương phản theo dark theme, không dùng text quá nhỏ cho thông tin chính.

### Required Verification
- Rà grep/search test và docs liên quan modal/action.
- Nếu cập nhật test/docs, chạy test/lint phù hợp và `text:check`.
- Đối chiếu checklist: Edit / Supplement / Report, Map Flow, Telesale, Tiếng Việt / UI Safety, Verify / Delete / Admin Actions.

### Plan
- Tìm test/e2e đang chạm modal chi tiết hoặc button `Bổ sung`/`Sửa`.
- Tìm docs nhắc tới modal chi tiết, telesale, action admin/non-admin.
- Cập nhật test/docs tối thiểu nếu phát hiện thiếu/sai.
- Chạy verification liên quan và cập nhật kết quả.

### Progress
- Đã rà e2e/docs liên quan modal chi tiết, action `Bổ sung`/`Sửa`, report route và supplement flow.
- Đã phát hiện e2e `store-report` còn dùng label modal cũ `Báo cáo cửa hàng` và thiếu coverage role action mới.
- Đã phát hiện docs `architecture`, `business-rules`, `project-context` còn mô tả `Bổ sung` trong modal theo điều kiện thiếu dữ liệu cũ.

### Done
- `e2e/store-report.spec.js`: cập nhật test report modal dùng nút `Báo cáo` hiện tại.
- `e2e/store-report.spec.js`: thêm coverage guest thấy `Bổ sung`, không thấy `Sửa`, và click đi tới `mode=supplement`.
- `e2e/store-report.spec.js`: thêm coverage admin thấy `Sửa`, không thấy `Bổ sung`, và click đi tới `/store/edit/[id]`.
- `docs/architecture.md`, `docs/business-rules.md`, `docs/project-context.md`: cập nhật mô tả modal action theo role hiện tại.

### Verification
- `npm.cmd run lint -- components/store-detail-modal.jsx e2e/store-report.spec.js` passed.
- `npm.cmd run text:check` passed: không phát hiện lỗi mã hóa trong repo.
- `npx.cmd playwright test e2e/store-report.spec.js --grep "nút báo cáo|guest thấy|admin thấy"` passed 3 tests.
- Đối chiếu checklist: Edit / Supplement / Report, Map Flow, Telesale, Tiếng Việt / UI Safety, Verify / Delete / Admin Actions.

### Open Questions
- Không có blocker; giả định vẫn giữ nút bản đồ nội bộ và nút tuyến vì khác mục đích với GG Maps/gọi điện.

### Risks / Next
- Chưa chạy toàn bộ e2e suite; chỉ chạy 3 case modal/report liên quan trực tiếp.

