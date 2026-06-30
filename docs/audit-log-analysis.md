# Audit Log Analysis — NPP Hà Công

> Generated: 2026-06-13
> Scope: `~/Desktop/customer`

---

## 1. Các bảng log đã tồn tại

| Table | Schema | Mục đích | RLS |
|---|---|---|---|
| `store_edit_history` | `store_id, action_type, actor_user_id, actor_role, changes (jsonb), created_at` | Lịch sử sửa đổi store (từng field diff) | admin-only |
| `operation_audit_events` | `event_type, entity_type, entity_id, severity, request_id, actor_id, metadata (jsonb), created_at` | Audit log generic, có idempotency theo `(event_type, request_id)` | admin-only |
| `stock_movements` | `product_id, movement_type, source_table, source_id, quantity_base, cost_price_base, stock_after_base_qty, created_by, created_at` | Sổ cái tồn kho (append-only ledger) | — |
| `inventory_reconciliation_runs` | `run_type, status, checked_product_count, mismatch_count, repaired_count, started_by, started_at, finished_at, error_message` | Lưu lịch sử đối soát tồn kho | admin-only |
| `notification_log` (legacy) | `user_id, type, title, detail, read, created_at` | Thông báo user (đang migrate → notification_feed) | user-own |
| `notification_feed` | `id, type, title, detail, data, created_at` | Shared notification feed v2 | authenticated + service_role |
| `notification_feed_reads` | `feed_id, user_id, read_at` | per-user read tracking | user-own |
| `notification_preferences` | `user_id, type, enabled` | per-user toggle notification | user-own |

---

## 2. Actions đã được log

### 2.1. Qua `store_edit_history` (via `lib/storeEditHistory.js`)

| action_type | Source code | Trigger |
|---|---|---|
| `edit` | `helper/useStoreEditController.js:452` | Admin sửa store (edit page) |
| `supplement` | `helper/useStoreEditController.js:335` | Bổ sung thông tin store (admin/telesale) |
| `delete_soft` | `components/store-detail-modal.jsx:428` | Soft-delete store |
| `verify` | `pages/store/verify.js:196` | Xác thực (batch) store |
| `report_apply` | `helper/useStoreReportsController.js:165` | Duyệt báo cáo edit → apply changes |

**Helper functions:**
- `buildStoreDiff(before, after)` — compute diff object `{ field: { from, to } }`
- `logStoreEditHistory({ storeId, actionType, actorUserId, actorRole, changes })` — single insert
- `logStoreEditHistoryBatch(rows)` — batch insert với chunk fallback

### 2.2. Qua `operation_audit_events` (via DB RPC `log_operation_audit_event`)

| event_type | entity_type | Source code | Trigger |
|---|---|---|---|
| `product_import` | `import` | `supabase/migrations/20260526020000_import_audit_operations.sql:212` (trong RPC `import_products_from_preview`) | Import hàng hoá từ preview |

Gọi client-side: `api/inventory/inventory-client.js:650` → `importProductsFromPreview()` → `supabase.rpc('import_products_from_preview', ...)`

### 2.3. Qua `stock_movements` (append-only ledger)

| movement_type | source_table | Trigger |
|---|---|---|
| `purchase` | `purchase_order_items` | Tạo phiếu nhập → trigger `apply_purchase_order_item_stock()` |
| `sale` | `sales_order_items` | Tạo đơn bán → trigger `apply_sales_order_item_stock()` |
| `adjustment` | `stock_adjustment_items` | Tạo phiếu điều chỉnh tồn → trigger `apply_stock_adjustment_item()` |
| `purchase_cancel` | `purchase_order_items` | Huỷ phiếu nhập → RPC `cancel_purchase_order_and_remove_stock()` |
| `sale_cancel` | `sales_order_items` | Huỷ đơn bán → RPC `cancel_sales_order_and_restore_stock()` |

> `stock_movements` là ledger kế toán — ghi số lượng tồn thay đổi, **không phải audit log hành chính** (ai làm gì, lúc nào, metadata).

### 2.4. Qua `inventory_reconciliation_runs`

| run_type | Source | Trigger |
|---|---|---|
| `check` | RPC `run_inventory_reconciliation_check()` | Bấm "Chạy đối soát" ở admin/operations |
| `repair` | RPC `repair_product_stock_from_ledger()` | Repair từ UI |

---

## 3. Actions chưa được log

### 3.1. Store operations

| Action | Source file | Ghi chú |
|---|---|---|
| **Tạo cửa hàng** | `helper/useStoreCreateController.js` | Không log gì sau khi insert store |
| **Import cửa hàng hàng loạt** | `pages/store/import.js`, `helper/storeImportFlow.js` | Không log gì sau khi batch insert |
| **Từ chối báo cáo (reject report)** | `helper/useStoreReportsController.js` | Chỉ update trạng thái report, ko log |
| **Tạo báo cáo từ người dùng** | `pages/store/report/[id]/edit.js` | Ko log (chỉ insert store_reports) |

### 3.2. Order/inventory operations

| Action | Source file | Ghi chú |
|---|---|---|
| **Tạo đơn bán hàng** | `api/inventory/inventory-client.js:312` via RPC `create_sales_order_with_items` | Stock movement có, audit event ko |
| **Huỷ đơn bán hàng** | `api/inventory/inventory-client.js:318` via RPC `cancel_sales_order_and_restore_stock` | Stock movement có, audit event ko |
| **Tạo phiếu nhập hàng** | `api/inventory/inventory-client.js:302` via RPC `create_purchase_order_with_items` | Stock movement có, audit event ko |
| **Huỷ phiếu nhập hàng** | `api/inventory/inventory-client.js:324` via RPC `cancel_purchase_order_and_remove_stock` | Stock movement có, audit event ko |
| **Tạo sản phẩm (hàng hoá)** | `api/inventory/inventory-client.js` `createProductWithUnits()` | Ko log |
| **Sửa sản phẩm** | `pages/inventory/products/[id].js` | Ko log |
| **Xoá sản phẩm (nếu có)** | — | Ko log |
| **Điều chỉnh tồn kho** | `pages/inventory/stock.js` (tạo `stock_adjustments`) | Stock movement có, audit event ko |
| **Đánh dấu đã in đơn** | `api/inventory/inventory-client.js:717` `markOrdersPrinted()` | Ko log |

### 3.3. System/Admin operations

| Action | Source file | Ghi chú |
|---|---|---|
| **Đổi role user** | `pages/api/admin/users/[id]/role.js` | RPC `set_auth_user_role` — ko log |
| **Xoá user** (nếu có) | — | Ko log |
| **Login/logout** | — | Ko log (thường xử lý bởi Supabase Auth) |
| **Chạy repair tồn kho** | `api/inventory/inventory-client.js:615` `repairProductStockFromLedger` | Đã có reconciliation_runs, nhưng ko ghi audit event riêng |

### 3.4. Tổng hợp số lượng

| Loại | Có log | Chưa log | Tổng |
|---|---|---|---|
| Store mutations | 5 action types | 3 | 8 |
| Order/inventory | 0 event types | 8 | 8 |
| Hàng hoá (product) | 1 (import) | 3 | 4 |
| Admin/System | 0 | 3 | 3 |
| **Tổng** | **6** | **17** | **23** |

---

## 4. Đề xuất giải pháp

### 4.1. Dùng `operation_audit_events` làm audit log chính

`operation_audit_events` đã có đủ cấu trúc cho mọi loại sự kiện:
- `event_type` — tên action (vd: `sales_order_created`, `purchase_order_cancelled`)
- `entity_type` — loại đối tượng (vd: `sales_order`, `purchase_order`, `product`)
- `entity_id` — ID đối tượng
- `actor_id` — người thực hiện
- `metadata` — JSON linh hoạt (payload, summary, v.v.)
- `request_id` — idempotency cho retry-safe

Không cần tạo bảng mới.

### 4.2. Cơ chế ghi log

**Option A: PostgreSQL trigger (khuyến nghị)**

Viết trigger function `log_operation_to_audit()` gọi `log_operation_audit_event()` sau INSERT/UPDATE/DELETE trên các bảng chính (`sales_orders`, `purchase_orders`, `products`, `stores`, v.v.).

Ưu điểm:
- Không sửa code frontend — trigger chạy server-side
- Không thể bypass (kể cả gọi RPC trực tiếp)
- Idempotent nhờ `request_id` (nếu có)

Nhược điểm:
- Cần migration mới
- Trigger khó debug hơn code client

**Option B: Gọi RPC từ client (dễ triển khai ngay)**

Thêm dòng `supabase.rpc('log_operation_audit_event', ...)` vào các hàm client đã tồn tại:
- `createSalesOrder()` → thêm log event `sales_order_created`
- `cancelSalesOrder()` → thêm log event `sales_order_cancelled`
- `createPurchaseOrder()` → thêm log event `purchase_order_created`
- `cancelPurchaseOrder()` → thêm log event `purchase_order_cancelled`
- `createProductWithUnits()` → thêm log event `product_created`
- `createStore` (useStoreCreateController) → thêm log event `store_created`
- `importStoresFromFile` (storeImportFlow) → thêm log event `store_import_batch`
- `handleReject` (useStoreReportsController) → thêm log event `report_rejected`

Ưu điểm:
- Không cần migration
- Dễ thêm/bớt

Nhược điểm:
- Có thể bị skip nếu client crash sau khi action thành công
- Cần sửa nhiều file

**Option C: Hybrid — trigger cho write, client gọi cho read/print**

- Trigger cho `sales_orders`, `purchase_orders`, `products`, `stores` INSERT/UPDATE/DELETE
- Client gọi thêm cho các action "mềm" (in đơn, reject report)

### 4.3. Mapping event types đề xuất

| Action | event_type | entity_type | entity_id | severity |
|---|---|---|---|---|
| Tạo đơn bán | `sales_order_created` | `sales_order` | order.id | info |
| Huỷ đơn bán | `sales_order_cancelled` | `sales_order` | order.id | warning |
| Tạo phiếu nhập | `purchase_order_created` | `purchase_order` | po.id | info |
| Huỷ phiếu nhập | `purchase_order_cancelled` | `purchase_order` | po.id | warning |
| Tạo sản phẩm | `product_created` | `product` | product.id | info |
| Sửa sản phẩm | `product_updated` | `product` | product.id | info |
| Sửa tồn kho | `stock_adjusted` | `product` | product.id | info |
| Tạo cửa hàng | `store_created` | `store` | store.id | info |
| Import cửa hàng | `store_import_batch` | `store` | null | info |
| Từ chối báo cáo | `report_rejected` | `store_report` | report.id | info |
| In đơn | `order_printed` | `sales_order` | order.id | info |
| Đổi role | `user_role_changed` | `auth_user` | user.id | warning |
| Repair tồn kho | `stock_repair_executed` | `system` | null | warning |

### 4.4. Lộ trình triển khai

**P0 (cần ngay — mất dữ liệu audit):**
1. Tạo đơn bán → `sales_order_created`
2. Huỷ đơn bán → `sales_order_cancelled`
3. Tạo phiếu nhập → `purchase_order_created`
4. Huỷ phiếu nhập → `purchase_order_cancelled`

**P1 (quan trọng — thiếu hụt tracking):**
5. Tạo cửa hàng → `store_created`
6. Import cửa hàng → `store_import_batch`
7. Từ chối báo cáo → `report_rejected`
8. Điều chỉnh tồn kho → `stock_adjusted`

**P2 (nice to have):**
9. Tạo/sửa sản phẩm → `product_created` / `product_updated`
10. In đơn → `order_printed`
11. Đổi role user → `user_role_changed`
12. Login/logout → `user_login` / `user_logout`

### 4.5. Lưu ý

- `operation_audit_events` hiện yêu cầu admin permission (`is_admin_user()`) để insert. Nếu muốn telesale cũng log (vd tạo đơn), cần mở policy hoặc dùng `security definer` function mới.
- `stock_movements` là ledger kế toán — không nên xem là audit log hành chính. Audit log cần ghi rõ actor, action, metadata.
- `store_edit_history` là bảng chuyên biệt cho store mutations — nên giữ nguyên, không merge vào `operation_audit_events`.
- Khi ghi log từ trigger, cần pass `actor_id` (vd từ `current_setting('app.current_user_id')` hoặc `auth.uid()`).
