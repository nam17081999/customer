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
- Feature

### Goal
- Tinh chỉnh modal chi tiết: bỏ đường kẻ ngăn giữa header và thông tin, đồng thời bao quanh khối thông tin cửa hàng bằng một đường viền rõ hơn.

### Why
- Giao diện cần liền mạch hơn giữa header và nội dung, nhưng phần thông tin vẫn cần có viền gom nhóm để dễ đọc.

### In Scope
- `components/store-detail-modal.jsx`
- Border dưới header modal chi tiết.
- Border bao quanh danh sách thông tin cửa hàng.

### Out of Scope
- Không đổi layout/action khác ngoài hai chỉnh sửa viền.
- Không đổi luồng quản lý admin: bổ sung, chỉnh sửa, lịch sử, báo cáo, xóa mềm.
- Không đổi route `/map` nội bộ, cache, database, create/edit/report/verify logic.
- Không thêm dependency mới.

### Must Preserve
- Giữ link Google Maps chỉ hiện khi cửa hàng có tọa độ hợp lệ.
- Giữ link gọi điện dùng số điện thoại hiện có và không làm hỏng tiếng Việt trong UI.
- Giữ nút bản đồ nội bộ `/map?storeId=...&lat=...&lng=...` nếu đang cần cho flow điều hướng trong app.
- Giữ các action admin/tuyến/báo cáo hoạt động đúng, chỉ đổi cách trình bày.
- Giữ kích thước nút đủ dễ bấm và tương phản theo dark theme, không dùng text quá nhỏ cho thông tin chính.

### Required Verification
- Chạy lint cho file bị sửa nếu khả thi.
- Chạy kiểm tra text/encoding nếu có command sẵn.
- Đối chiếu checklist: Tiếng Việt / UI Safety, Map Flow, Verify / Delete / Admin Actions.

### Plan
- Bỏ class border dưới header sticky.
- Thêm border cho wrapper danh sách thông tin cửa hàng.
- Chạy verification liên quan và cập nhật kết quả.

### Progress
- Đã bỏ border dưới header sticky.
- Đã thêm border bao quanh danh sách thông tin cửa hàng.

### Done
- `components/store-detail-modal.jsx`: header modal không còn đường kẻ ngăn với phần thông tin.
- `components/store-detail-modal.jsx`: danh sách thông tin cửa hàng được bao quanh bởi `border border-gray-800`.

### Verification
- `npm.cmd run lint -- components/store-detail-modal.jsx` passed.
- `npm.cmd run text:check` passed: không phát hiện lỗi mã hóa trong repo.
- Đối chiếu checklist: Tiếng Việt / UI Safety không đổi text/cỡ chữ chính; Map Flow và Admin Actions không đổi logic/nút hành động.

### Open Questions
- Không có blocker; giả định vẫn giữ nút bản đồ nội bộ và nút tuyến vì khác mục đích với GG Maps/gọi điện.

### Risks / Next
- Chưa chạy browser smoke test thực tế; nên mở modal để xác nhận khoảng cách giữa header và khối thông tin nhìn cân đối.

