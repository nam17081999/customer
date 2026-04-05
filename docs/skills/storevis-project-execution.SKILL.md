---
name: storevis-project-execution
description: Dùng khi build/fix/refactor NPP Hà Công để bám đúng kiến trúc, business rules, cache flow, map flow, image flow, và accessibility.
---

# NPP Hà Công Project Execution

Skill này dùng để AI làm việc đúng “luật dự án”, giảm lỗi ngầm và tránh sửa sai flow nghiệp vụ.

## Khi nào dùng

- Thêm tính năng mới cho NPP Hà Công.
- Sửa bug ở search, create/edit store, map, verify/reports.
- Refactor nhỏ và vừa trong codebase hiện tại.

## 6 file phải đọc trước khi code

- `docs/ai-rules.md`
- `docs/architecture.md`
- `docs/business-rules.md`
- `docs/database.md`
- `docs/design-system.md`
- `docs/project-context.md`

## Quy tắc bất biến

- Trang mới đặt trong `pages/`, không tự chuyển route mới sang `app/`.
- Đọc danh sách `stores` qua `getOrRefreshStores()` từ `lib/storeCache.js`.
- Không hard delete stores, chỉ soft delete bằng `deleted_at`.
- `image_url` lưu filename, không lưu full URL.
- File có tiếng Việt phải được giữ UTF-8. Không dùng cách ghi file dễ làm vỡ encoding nếu không thật sự cần.
- Sau mutation phải sync cache đúng hàm:
- CREATE: `appendStoreToCache(newStore)`.
- DELETE mềm: `removeStoreFromCache(id)` và khi cần `invalidateStoreCache()`.
- EDIT/VERIFY/REPORT apply: `invalidateStoreCache()`.
- Khi cần đồng bộ liên trang, dispatch event `storevis:stores-changed`.

## Guardrail riêng cho tiếng Việt

- Ưu tiên `apply_patch` hoặc editor ghi UTF-8 ổn định khi sửa file có tiếng Việt.
- Tránh dùng PowerShell `Set-Content` / `Out-File` để ghi lại cả file trừ khi đã kiểm soát rõ encoding đầu ra.
- Không tin hoàn toàn vào hiển thị của terminal Windows khi đọc file tiếng Việt; terminal có thể sai codepage dù source vẫn đúng.
- Khi sửa text tiếng Việt, phải kiểm tra lại bằng `git diff` và ưu tiên xác nhận trên UI/browser nếu có thể.
- Nếu chỉ cần sửa vài chuỗi, không rewrite toàn file.

## Flow triển khai chuẩn

1. Phân loại task: `bugfix`, `feature`, hoặc `refactor`.
2. Xác định rõ phạm vi file/route và dữ liệu bị ảnh hưởng.
3. Chốt expected behavior trước khi sửa.
4. Sửa tối thiểu để đạt mục tiêu, không trộn cleanup ngoài scope.
5. Verify theo đúng flow bị tác động.
6. Báo cáo kết quả theo output contract.

## Guardrails theo domain NPP Hà Công

- Search:
- Giữ hỗ trợ tiếng Việt có dấu/không dấu.
- Nếu không có tiêu chí tìm kiếm thì hiển thị 50 cửa hàng gần nhất theo rule docs.
- Create/Edit:
- Chuẩn hóa dữ liệu tiếng Việt theo rule hiện có (name/address).
- Kiểm tra duplicate đúng helper hiện tại.
- Map:
- Validate lat/lng đúng miền hợp lệ.
- Luồng từ modal sang `/map` giữ `storeId + lat + lng`.
- Report/Verify:
- Không trộn logic “sửa dữ liệu” và “chỉ báo cáo lý do”.
- Áp dụng duyệt xong phải đồng bộ cache + UI.

## Design & Accessibility bắt buộc

- Không dùng text quá nhỏ cho thông tin quan trọng (`text-xs`, `text-[11px]`).
- Font nội dung chính tối thiểu theo design system.
- Nút hành động chính đảm bảo kích thước bấm đủ lớn.
- Giữ tương phản cao theo bảng màu hiện tại.

## Verification minimum

- Chạy `npm run lint` khi thay đổi logic/component.
- Smoke test tay flow vừa sửa.
- Nếu đụng cache/DB/map, liệt kê rõ case đã kiểm.

## Output contract khi trả kết quả

- Đã sửa gì và lý do.
- File nào đã thay đổi.
- Đã verify bằng cách nào.
- Rủi ro còn lại hoặc phần chưa verify được.
