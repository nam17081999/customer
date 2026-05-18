-- Mock order/inventory seed data for test environments.
-- Safe to re-run: fixed UUIDs + ON CONFLICT guards.

insert into public.stores (
  id,
  name,
  store_type,
  address_detail,
  ward,
  district,
  phone,
  active,
  created_at,
  updated_at,
  deleted_at
)
values (
  '11111111-1111-4111-8111-111111111111',
  'MOCK Tạp Hóa Hà Công',
  'Tạp hóa',
  'Số 1 Đường Test',
  'Đức Thượng',
  'Hoài Đức',
  '0900000001',
  true,
  now(),
  now(),
  null
)
on conflict (id) do update
set
  name = excluded.name,
  store_type = excluded.store_type,
  address_detail = excluded.address_detail,
  ward = excluded.ward,
  district = excluded.district,
  phone = excluded.phone,
  active = excluded.active,
  updated_at = now(),
  deleted_at = null;

insert into public.products (
  id,
  name,
  sku,
  category,
  base_unit_name,
  default_sale_price,
  default_purchase_price,
  min_stock_base_qty,
  active,
  note
)
values
  (
    '22222222-2222-4222-8222-222222222201',
    'MOCK Nước Lavie 500ml',
    'MOCK-LAVIE500',
    'Nước',
    'chai',
    6000,
    3500,
    24,
    true,
    'Dữ liệu test order/inventory'
  ),
  (
    '22222222-2222-4222-8222-222222222202',
    'MOCK Bia Hà Nội Lon',
    'MOCK-BIAHN',
    'Bia',
    'lon',
    12000,
    8000,
    24,
    true,
    'Dữ liệu test order/inventory'
  ),
  (
    '22222222-2222-4222-8222-222222222203',
    'MOCK Mì Hảo Hảo Tôm Chua Cay',
    'MOCK-HAOHAO',
    'Mì',
    'gói',
    5000,
    3300,
    30,
    true,
    'Dữ liệu test order/inventory'
  )
on conflict (id) do update
set
  name = excluded.name,
  sku = excluded.sku,
  category = excluded.category,
  base_unit_name = excluded.base_unit_name,
  default_sale_price = excluded.default_sale_price,
  default_purchase_price = excluded.default_purchase_price,
  min_stock_base_qty = excluded.min_stock_base_qty,
  active = excluded.active,
  note = excluded.note;

insert into public.product_units (
  id,
  product_id,
  unit_name,
  conversion_to_base_qty,
  default_sale_price,
  default_purchase_price,
  is_base_unit,
  active
)
values
  ('33333333-3333-4333-8333-333333333301', '22222222-2222-4222-8222-222222222201', 'chai', 1, 6000, 3500, true, true),
  ('33333333-3333-4333-8333-333333333302', '22222222-2222-4222-8222-222222222201', 'thùng 24', 24, 138000, 84000, false, true),
  ('33333333-3333-4333-8333-333333333303', '22222222-2222-4222-8222-222222222202', 'lon', 1, 12000, 8000, true, true),
  ('33333333-3333-4333-8333-333333333304', '22222222-2222-4222-8222-222222222202', 'thùng 24', 24, 270000, 192000, false, true),
  ('33333333-3333-4333-8333-333333333305', '22222222-2222-4222-8222-222222222203', 'gói', 1, 5000, 3300, true, true),
  ('33333333-3333-4333-8333-333333333306', '22222222-2222-4222-8222-222222222203', 'thùng 30', 30, 145000, 99000, false, true)
on conflict (id) do update
set
  unit_name = excluded.unit_name,
  conversion_to_base_qty = excluded.conversion_to_base_qty,
  default_sale_price = excluded.default_sale_price,
  default_purchase_price = excluded.default_purchase_price,
  is_base_unit = excluded.is_base_unit,
  active = excluded.active;

insert into public.product_stock (product_id)
values
  ('22222222-2222-4222-8222-222222222201'),
  ('22222222-2222-4222-8222-222222222202'),
  ('22222222-2222-4222-8222-222222222203')
on conflict (product_id) do nothing;

insert into public.purchase_orders (
  id,
  code,
  supplier_name,
  note
)
values (
  '44444444-4444-4444-8444-444444444401',
  'MOCK-PN-001',
  'MOCK Nhà Cung Cấp Test',
  'Phiếu nhập mock tự động'
)
on conflict (id) do nothing;

insert into public.purchase_order_items (
  id,
  purchase_order_id,
  product_id,
  product_unit_id,
  quantity,
  conversion_to_base_qty,
  unit_cost,
  note
)
values
  ('55555555-5555-4555-8555-555555555501', '44444444-4444-4444-8444-444444444401', '22222222-2222-4222-8222-222222222201', '33333333-3333-4333-8333-333333333302', 10, 24, 84000, 'Nhập mock Lavie'),
  ('55555555-5555-4555-8555-555555555502', '44444444-4444-4444-8444-444444444401', '22222222-2222-4222-8222-222222222202', '33333333-3333-4333-8333-333333333304', 5, 24, 192000, 'Nhập mock bia'),
  ('55555555-5555-4555-8555-555555555503', '44444444-4444-4444-8444-444444444401', '22222222-2222-4222-8222-222222222203', '33333333-3333-4333-8333-333333333306', 8, 30, 99000, 'Nhập mock mì')
on conflict (id) do nothing;

insert into public.sales_orders (
  id,
  code,
  customer_store_id,
  note,
  discount_amount
)
values (
  '66666666-6666-4666-8666-666666666601',
  'MOCK-DH-001',
  '11111111-1111-4111-8111-111111111111',
  'Đơn bán mock tự động',
  10000
)
on conflict (id) do nothing;

insert into public.sales_order_items (
  id,
  sales_order_id,
  product_id,
  product_unit_id,
  quantity,
  conversion_to_base_qty,
  unit_price,
  note
)
values
  ('77777777-7777-4777-8777-777777777701', '66666666-6666-4666-8666-666666666601', '22222222-2222-4222-8222-222222222201', '33333333-3333-4333-8333-333333333302', 2, 24, 138000, 'Bán mock Lavie'),
  ('77777777-7777-4777-8777-777777777702', '66666666-6666-4666-8666-666666666601', '22222222-2222-4222-8222-222222222203', '33333333-3333-4333-8333-333333333306', 1, 30, 145000, 'Bán mock mì')
on conflict (id) do nothing;
