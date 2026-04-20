---
title: Lưu lịch sử chỉnh sửa cửa hàng (admin-only)
date: 2026-04-20
status: draft
---

## Mục tiêu

Thêm tính năng **lưu trữ lịch sử chỉnh sửa** cho từng cửa hàng.

- Chỉ **admin** được xem và sử dụng.
- Trong `StoreDetailModal` (modal chi tiết), có nút **Lịch sử chỉnh sửa**.
- Bấm nút sẽ mở trang lịch sử của đúng cửa hàng đó.

## Phạm vi (in-scope)

- Lưu lịch sử theo kiểu **Diff (A)**: chỉ lưu các field thay đổi kèm `from/to`.
- Ghi log cho các hành động mutate dữ liệu store ở UI admin hiện có:
  - Chỉnh sửa store (admin) ở `/store/edit/[id]`
  - Bổ sung dữ liệu (admin) ở `/store/edit/[id]?mode=supplement`
  - Xác thực store (admin) ở `/store/verify` (verify-many)
  - Duyệt báo cáo edit (admin) ở `/store/reports` (apply proposed_changes)
  - Xóa mềm (admin) từ `StoreDetailModal`

## Ngoài phạm vi (out-of-scope)

- Diff tự động cho mọi thay đổi từ ngoài app (SQL trực tiếp, scripts, v.v.)
- Hiển thị lịch sử cho telesale/guest
- Khôi phục (rollback) theo lịch sử

## Ràng buộc kiến trúc

- Routing dùng **Pages Router** (`pages/`).
- Import nội bộ dùng alias `@/`.
- Không làm thay đổi hành vi search, cache stores hiện có ngoài việc thêm “ghi log” sau mutation.
- Tiếng Việt trong UI và docs phải giữ UTF-8 sạch.

## Điều kiện tiên quyết (trước khi migrate)

- **Kiểu `stores.id`**: cần xác nhận rõ môi trường đang dùng `uuid` (thường gặp trên Supabase) hay `bigint`.
  - Migration tạo `store_edit_history.store_id` **phải cùng kiểu** với `stores.id`.
- **RLS role helper**: dự án đã chuẩn hóa quyền admin qua `public.is_admin_user()` trong `docs/sql/2026-04-06-auth-roles-and-rls.sql`.
  - Policy của `store_edit_history` phải **tái sử dụng** helper này, không tự invent predicate khác.

## Thiết kế dữ liệu

### Bảng mới: `store_edit_history`

Mục tiêu: truy vấn nhanh theo `store_id`, hiển thị danh sách thay đổi dễ đọc.

Các cột đề xuất:

- `id uuid primary key default gen_random_uuid()`
- `store_id` (FK → `stores.id`, kiểu phải khớp với `stores.id`)
- `action_type text not null`
  - Giá trị dự kiến: `edit`, `supplement`, `verify`, `report_apply`, `delete_soft`
- `actor_user_id uuid null` (FK → `auth.users.id`)
- `actor_role text not null default 'admin'`
- `changes jsonb not null`
  - Shape:
    - `{ "<fieldKey>": { "from": <any>, "to": <any> }, ... }`
  - Chỉ chứa field thật sự thay đổi; không lưu field không đổi.
- `created_at timestamptz not null default now()`

Constraint đề xuất:

- `CHECK (jsonb_typeof(changes) = 'object')`

Index đề xuất:

- `create index on store_edit_history(store_id, created_at desc)`

### Quy tắc ghi log

- Chỉ ghi khi mutation **thành công**.
- Chỉ ghi khi diff **không rỗng**.
- Diff lấy từ:
  - `before`: store hiện tại (từ cache state hiện có trong UI)
  - `after`: object updates (hoặc state sau update) được app gửi lên DB
- Chuẩn hóa:
  - `updated_at` luôn được cập nhật trong `stores` theo rule dự án (đã có sẵn).
  - `deleted_at` khi xóa mềm: `from = null`, `to = <timestamp>`
  - Text nullable: coi `''` và `null` là tương đương để tránh log nhiễu.
  - `latitude/longitude`: làm tròn trước khi so sánh (VD: 6 chữ số thập phân) để tránh sai khác do floating.
  - Không log field UI-only (VD: `distance`).
  - Với `report_apply`: chỉ log khi `store_reports.report_type = 'edit'` (vì `reason_only` không mutate `stores`).
  - Với `supplement`: chỉ log khi nhánh **admin** update trực tiếp `stores` (guest/signed-out tạo `store_reports` thì không log ở đây).

## UI/UX

### Nút trong `StoreDetailModal`

- Chỉ hiển thị khi `isAdmin`.
- Label: **Lịch sử chỉnh sửa**
- Click:
  - Điều hướng sang `pages/store/history/[id].js` (route: `/store/history/:id`)
  - Preserve `from` query để quay lại đúng trang.

### Trang lịch sử `/store/history/[id]`

- Admin-only guard giống các trang admin khác:
  - Chưa đăng nhập → redirect `/login?from=...`
  - Không phải admin → redirect `/account`
- Tải lịch sử:
  - Query `store_edit_history` filter theo `store_id`
  - Order `created_at desc`
  - Phân trang: mặc định lấy 50 item đầu, dùng `.range(from, to)`; có nút “Tải thêm”.
- Hiển thị:
  - Header: “Lịch sử chỉnh sửa”
  - Subheader: tên cửa hàng (lấy từ cache stores theo `id`)
  - Mỗi item:
    - thời gian (`created_at`)
    - nhãn action (VD: “Chỉnh sửa”, “Bổ sung”, “Xác thực”, “Duyệt báo cáo”, “Xóa mềm”)
    - danh sách field thay đổi: `Tên: A → B`, `SĐT: ...`, `Vĩ độ/Kinh độ: ...`
- Empty state: “Chưa có lịch sử chỉnh sửa cho cửa hàng này.”

## Bảo mật / RLS

Yêu cầu: chỉ admin được đọc/ghi `store_edit_history`.

- Enable RLS
- Policies:
  - `select`: admin only (authenticated + `public.is_admin_user()`)
  - `insert`: admin only (authenticated + `public.is_admin_user()`)
  - `update/delete`: không cần (hoặc admin only nếu muốn)

Lưu ý: policy nên tái sử dụng `public.is_admin_user()` theo chuẩn của `docs/sql/2026-04-06-auth-roles-and-rls.sql`.

## Tích hợp code (điểm ghi log)

Tạo helper dùng chung:

- `lib/storeEditHistory.js`
  - `buildStoreDiff(beforeStore, afterPartial)` → `changes`
  - `logStoreEditHistory({ storeId, actionType, actorUserId, changes })`

Hook vào các flow:

- `pages/store/edit/[id].js`
  - `executeEditSave()` → log action `edit`
  - `executeSaveSupplement()` (admin branch) → log action `supplement`
- `pages/store/verify.js`
  - `verifyStores(ids)` → log cho từng store, action `verify` (tối ưu: batch insert)
- `pages/store/reports.js`
  - `handleApproveEdit(report)` → log action `report_apply`
- `components/store-detail-modal.jsx`
  - `handleDelete()` → log action `delete_soft`

## Kiểm chứng (definition of done)

- Admin thấy nút **Lịch sử chỉnh sửa** trong modal chi tiết.
- Trang `/store/history/[id]`:
  - chỉ admin vào được
  - hiển thị đúng danh sách theo `store_id`
- Thực hiện 1 thay đổi (VD: đổi `note`) rồi thấy lịch sử ghi đúng `from/to`.
- `npm run lint` pass.

