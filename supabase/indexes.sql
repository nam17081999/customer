-- ============================================================
-- Performance Indexes cho NPP Hà Công
-- Generated from code analysis of lib/, helper/, api/, pages/api/
-- ============================================================
-- Mọi index dùng CREATE INDEX IF NOT EXISTS (idempotent)
-- Môi trường test, không migration versioning
-- ============================================================

-- ============================================================
-- stores — Bảng chính, query nhiều nhất
-- ============================================================

-- 1. Soft-delete filter: mọi read query đều có .is('deleted_at', null)
CREATE INDEX IF NOT EXISTS idx_stores_deleted_at
  ON public.stores (deleted_at);

-- 2. Cache sync: .gt('updated_at', since) + .order('updated_at')
--    Partial index WHERE deleted_at IS NULL để index nhỏ hơn
CREATE INDEX IF NOT EXISTS idx_stores_updated_at_non_deleted
  ON public.stores (updated_at)
  WHERE deleted_at IS NULL;

-- 3. Map filter by district + ward (filterMapStoresByAreaSelection)
CREATE INDEX IF NOT EXISTS idx_stores_district_non_deleted
  ON public.stores (district)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_stores_ward_non_deleted
  ON public.stores (ward)
  WHERE deleted_at IS NULL;

-- 4. Map filter / search filter by store_type
CREATE INDEX IF NOT EXISTS idx_stores_store_type_non_deleted
  ON public.stores (store_type)
  WHERE deleted_at IS NULL;

-- 5. Telesale filter: active/inactive stores
CREATE INDEX IF NOT EXISTS idx_stores_active_non_deleted
  ON public.stores (active)
  WHERE deleted_at IS NULL;


-- ============================================================
-- store_edit_history — Lịch sử chỉnh sửa
-- ============================================================
-- Đã có idx_store_edit_history_store_id_created_at_desc (composite)

-- 6. FK index cho store_id (dùng trong .delete().in('store_id') cleanup)
CREATE INDEX IF NOT EXISTS idx_store_edit_history_store_id
  ON public.store_edit_history (store_id);


-- ============================================================
-- store_reports — Báo cáo người dùng
-- ============================================================

-- 7. Lọc theo status: .eq('status', 'pending') — pattern phổ biến nhất
CREATE INDEX IF NOT EXISTS idx_store_reports_status
  ON public.store_reports (status);

-- 8. FK index cho JOIN với stores: store:stores!inner(...)
CREATE INDEX IF NOT EXISTS idx_store_reports_store_id
  ON public.store_reports (store_id);

-- 9. Composite: status + created_at desc cho pending-sorted listing
CREATE INDEX IF NOT EXISTS idx_store_reports_status_created_at
  ON public.store_reports (status, created_at DESC);


-- ============================================================
-- product_stock — Tồn kho
-- ============================================================

-- 10. FK index (product_id là PK, index này redundant nhưng explicit)
CREATE INDEX IF NOT EXISTS idx_product_stock_product_id
  ON public.product_stock (product_id);


-- ============================================================
-- products — Hàng hóa
-- ============================================================
-- Đã có idx_products_sku_unique_active, idx_products_active_name

-- 11. Soft-delete filter: .is('deleted_at', null) trong listProductsWithStock
CREATE INDEX IF NOT EXISTS idx_products_deleted_at
  ON public.products (deleted_at);

-- 12. FK: created_by (auth.users) — dùng trong operator workflow
CREATE INDEX IF NOT EXISTS idx_products_created_by
  ON public.products (created_by);


-- ============================================================
-- sales_orders — Đơn bán
-- ============================================================
-- Đã có idx_sales_orders_code_unique, idx_sales_orders_customer_store_id,
-- idx_sales_orders_created_at_desc

-- 13. Status filter: .eq('status', 'active'), .in('status', statuses)
CREATE INDEX IF NOT EXISTS idx_sales_orders_status
  ON public.sales_orders (status);

-- 14. FK: created_by — dùng trong .eq('created_by', creatorId)
CREATE INDEX IF NOT EXISTS idx_sales_orders_created_by
  ON public.sales_orders (created_by);

-- 15. Composite: status + created_at cho báo cáo doanh số
CREATE INDEX IF NOT EXISTS idx_sales_orders_status_created_at
  ON public.sales_orders (status, created_at DESC);


-- ============================================================
-- sales_order_items — Dòng đơn bán
-- ============================================================
-- Đã có idx_sales_order_items_order_id, idx_sales_order_items_product_id


-- ============================================================
-- purchase_orders — Phiếu nhập
-- ============================================================
-- Đã có idx_purchase_orders_code_unique, idx_purchase_orders_created_at_desc

-- 16. FK: created_by
CREATE INDEX IF NOT EXISTS idx_purchase_orders_created_by
  ON public.purchase_orders (created_by);

-- 17. cancelled_at: dùng filter client-side !order.cancelled_at (is null)
CREATE INDEX IF NOT EXISTS idx_purchase_orders_cancelled_at
  ON public.purchase_orders (cancelled_at);


-- ============================================================
-- purchase_order_items — Dòng phiếu nhập
-- ============================================================
-- Đã có idx_purchase_order_items_order_id, idx_purchase_order_items_product_id


-- ============================================================
-- product_units — Đơn vị quy đổi
-- ============================================================
-- Đã có idx_product_units_product_unit_name_unique,
-- idx_product_units_one_base_unit_per_product

-- 18. FK index (dù đã có composite unique, thêm explicit cho JOIN)
CREATE INDEX IF NOT EXISTS idx_product_units_product_id
  ON public.product_units (product_id);


-- ============================================================
-- notification_log — Nhật ký thông báo (v1, legacy)
-- ============================================================
-- Đã có idx_notification_log_user


-- ============================================================
-- notification_feed — Feed thông báo (v2)
-- ============================================================
-- Đã có idx_notification_feed_time


-- ============================================================
-- notification_feed_reads — Trạng thái đọc feed
-- ============================================================
-- Đã có idx_feed_reads_user


-- ============================================================
-- stock_movements — Sổ cái kho
-- ============================================================
-- Đã có idx_stock_movements_product_created_at_desc, idx_stock_movements_source


-- ============================================================
-- operation_audit_events — Audit log
-- ============================================================
-- Đã có idx_operation_audit_events_created_at,
-- idx_operation_audit_events_type_created_at,
-- idx_operation_audit_events_request_once


-- ============================================================
-- inventory_reconciliation_runs — Kiểm kê
-- ============================================================

-- 19. Order by started_at desc trong listInventoryReconciliationRuns
CREATE INDEX IF NOT EXISTS idx_inventory_reconciliation_runs_started_at
  ON public.inventory_reconciliation_runs (started_at DESC);
