-- Dữ liệu kiểm thử orders/inventory cho môi trường dev.
-- Mục tiêu: ~30 sản phẩm nước giải khát phổ biến + 200 đơn hàng trải theo nhiều mốc thời gian.
-- Safe to re-run: xóa lại đúng dữ liệu seed cũ theo marker `HC-TST-*` và `DHHC*`.

begin;

-- Cleanup dữ liệu seed cũ trước khi tạo lại.
delete from public.stock_movements
where source_table = 'sales_order_items'
  and source_id in (
    select soi.id
    from public.sales_order_items soi
    join public.sales_orders so on so.id = soi.sales_order_id
    where so.code like 'DHHC%'
  );

delete from public.sales_order_items
where sales_order_id in (
  select id
  from public.sales_orders
  where code like 'DHHC%'
);

delete from public.sales_orders
where code like 'DHHC%';

delete from public.product_units
where product_id in (
  select id
  from public.products
  where sku like 'HC-TST-%'
);

delete from public.product_stock
where product_id in (
  select id
  from public.products
  where sku like 'HC-TST-%'
);

delete from public.products
where sku like 'HC-TST-%';

create temporary table tmp_seed_products (
  seed_no integer primary key,
  name text not null,
  sku text not null,
  category text not null,
  base_unit_name text not null,
  default_sale_price numeric(14, 2) not null,
  default_purchase_price numeric(14, 2) not null,
  min_stock_base_qty numeric(18, 3) not null,
  pack_unit_name text null,
  pack_conversion integer null,
  case_unit_name text null,
  case_conversion integer null
) on commit drop;

insert into tmp_seed_products (
  seed_no,
  name,
  sku,
  category,
  base_unit_name,
  default_sale_price,
  default_purchase_price,
  min_stock_base_qty,
  pack_unit_name,
  pack_conversion,
  case_unit_name,
  case_conversion
)
values
  (1, 'Coca-Cola lon 330ml', 'HC-TST-COCA330L', 'Nước ngọt', 'lon', 10000, 7200, 120, 'lốc 6 lon', 6, 'thùng 24 lon', 24),
  (2, 'Coca-Cola chai 390ml', 'HC-TST-COCA390C', 'Nước ngọt', 'chai', 10000, 7100, 120, 'lốc 6 chai', 6, 'thùng 24 chai', 24),
  (3, 'Coca-Cola chai 1.5L', 'HC-TST-COCA1500', 'Nước ngọt', 'chai', 22000, 16500, 60, null, null, 'thùng 12 chai', 12),
  (4, 'Pepsi lon 330ml', 'HC-TST-PEPSI330L', 'Nước ngọt', 'lon', 9500, 6900, 120, 'lốc 6 lon', 6, 'thùng 24 lon', 24),
  (5, 'Pepsi chai 390ml', 'HC-TST-PEPSI390C', 'Nước ngọt', 'chai', 9500, 6800, 120, 'lốc 6 chai', 6, 'thùng 24 chai', 24),
  (6, 'Pepsi chai 1.5L', 'HC-TST-PEPSI1500', 'Nước ngọt', 'chai', 21000, 15800, 60, null, null, 'thùng 12 chai', 12),
  (7, '7 Up lon 330ml', 'HC-TST-7UP330L', 'Nước ngọt', 'lon', 9500, 6800, 120, 'lốc 6 lon', 6, 'thùng 24 lon', 24),
  (8, '7 Up chai 390ml', 'HC-TST-7UP390C', 'Nước ngọt', 'chai', 9500, 6750, 120, 'lốc 6 chai', 6, 'thùng 24 chai', 24),
  (9, 'Mirinda cam lon 330ml', 'HC-TST-MIRCAM330', 'Nước ngọt', 'lon', 9500, 6900, 120, 'lốc 6 lon', 6, 'thùng 24 lon', 24),
  (10, 'Mirinda cam chai 390ml', 'HC-TST-MIRCAM390', 'Nước ngọt', 'chai', 9500, 6800, 120, 'lốc 6 chai', 6, 'thùng 24 chai', 24),
  (11, 'Mirinda xá xị lon 330ml', 'HC-TST-MIRSARS330', 'Nước ngọt', 'lon', 9500, 6900, 120, 'lốc 6 lon', 6, 'thùng 24 lon', 24),
  (12, 'Sprite lon 330ml', 'HC-TST-SPRITE330', 'Nước ngọt', 'lon', 10000, 7200, 120, 'lốc 6 lon', 6, 'thùng 24 lon', 24),
  (13, 'Sprite chai 390ml', 'HC-TST-SPRITE390', 'Nước ngọt', 'chai', 10000, 7100, 120, 'lốc 6 chai', 6, 'thùng 24 chai', 24),
  (14, 'Fanta cam lon 330ml', 'HC-TST-FANTA330', 'Nước ngọt', 'lon', 9500, 6950, 120, 'lốc 6 lon', 6, 'thùng 24 lon', 24),
  (15, 'Sting đỏ lon 330ml', 'HC-TST-STINGRED', 'Nước tăng lực', 'lon', 11000, 8000, 96, 'lốc 6 lon', 6, 'thùng 24 lon', 24),
  (16, 'Sting vàng lon 330ml', 'HC-TST-STINGGOLD', 'Nước tăng lực', 'lon', 11000, 8000, 96, 'lốc 6 lon', 6, 'thùng 24 lon', 24),
  (17, 'Number 1 chai 330ml', 'HC-TST-NO1330', 'Nước tăng lực', 'chai', 10000, 7300, 96, 'lốc 6 chai', 6, 'thùng 24 chai', 24),
  (18, 'Warrior dâu lon 330ml', 'HC-TST-WARD330', 'Nước tăng lực', 'lon', 12000, 8800, 96, 'lốc 6 lon', 6, 'thùng 24 lon', 24),
  (19, 'Warrior nho lon 330ml', 'HC-TST-WARG330', 'Nước tăng lực', 'lon', 12000, 8800, 96, 'lốc 6 lon', 6, 'thùng 24 lon', 24),
  (20, 'Red Bull lon 250ml', 'HC-TST-REDBULL250', 'Nước tăng lực', 'lon', 14000, 10500, 72, 'lốc 4 lon', 4, 'thùng 24 lon', 24),
  (21, 'Revive muối khoáng 390ml', 'HC-TST-REVIVE390', 'Nước bù khoáng', 'chai', 10000, 7300, 96, 'lốc 6 chai', 6, 'thùng 24 chai', 24),
  (22, 'Revive chanh muối 500ml', 'HC-TST-REVIVE500', 'Nước bù khoáng', 'chai', 11000, 8100, 96, 'lốc 6 chai', 6, 'thùng 24 chai', 24),
  (23, 'Aquafina 500ml', 'HC-TST-AQUAFINA500', 'Nước khoáng', 'chai', 7000, 5000, 144, 'lốc 6 chai', 6, 'thùng 24 chai', 24),
  (24, 'Lavie 500ml', 'HC-TST-LAVIE500', 'Nước khoáng', 'chai', 7000, 4900, 144, 'lốc 6 chai', 6, 'thùng 24 chai', 24),
  (25, 'Pocari Sweat 500ml', 'HC-TST-POCARI500', 'Nước bù khoáng', 'chai', 14000, 10300, 96, 'lốc 6 chai', 6, 'thùng 24 chai', 24),
  (26, 'Trà Xanh Không Độ 455ml', 'HC-TST-KHONGDO455', 'Trà đóng chai', 'chai', 10000, 7300, 96, 'lốc 6 chai', 6, 'thùng 24 chai', 24),
  (27, 'Trà Ô Long Tea Plus 455ml', 'HC-TST-TEAPLUS455', 'Trà đóng chai', 'chai', 12000, 8900, 96, 'lốc 6 chai', 6, 'thùng 24 chai', 24),
  (28, 'C2 chanh 360ml', 'HC-TST-C2360', 'Trà đóng chai', 'chai', 9000, 6400, 96, 'lốc 6 chai', 6, 'thùng 24 chai', 24),
  (29, 'Dr Thanh 350ml', 'HC-TST-DRTHANH350', 'Trà đóng chai', 'chai', 9000, 6500, 96, 'lốc 6 chai', 6, 'thùng 24 chai', 24),
  (30, 'Fuze Tea chanh sả 450ml', 'HC-TST-FUZETEA450', 'Trà đóng chai', 'chai', 11000, 8000, 96, 'lốc 6 chai', 6, 'thùng 24 chai', 24);

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
  note,
  created_at,
  updated_at
)
select
  gen_random_uuid(),
  seed.name,
  seed.sku,
  seed.category,
  seed.base_unit_name,
  seed.default_sale_price,
  seed.default_purchase_price,
  seed.min_stock_base_qty,
  true,
  'Dữ liệu kiểm thử orders/inventory 2026-05',
  now() - make_interval(days => 45 - seed.seed_no),
  now() - make_interval(days => 5 - (seed.seed_no % 5))
from tmp_seed_products seed;

create temporary table tmp_seed_product_map
on commit drop
as
select
  seed.seed_no,
  seed.name,
  seed.sku,
  seed.category,
  seed.base_unit_name,
  seed.default_sale_price,
  seed.default_purchase_price,
  seed.min_stock_base_qty,
  seed.pack_unit_name,
  seed.pack_conversion,
  seed.case_unit_name,
  seed.case_conversion,
  product.id as product_id
from tmp_seed_products seed
join public.products product on product.sku = seed.sku;

insert into public.product_units (
  id,
  product_id,
  unit_name,
  conversion_to_base_qty,
  default_sale_price,
  default_purchase_price,
  is_base_unit,
  active,
  created_at,
  updated_at
)
select
  gen_random_uuid(),
  product_id,
  base_unit_name,
  1,
  default_sale_price,
  default_purchase_price,
  true,
  true,
  now() - make_interval(days => 30 - seed_no),
  now() - make_interval(days => seed_no % 3)
from tmp_seed_product_map;

insert into public.product_units (
  id,
  product_id,
  unit_name,
  conversion_to_base_qty,
  default_sale_price,
  default_purchase_price,
  is_base_unit,
  active,
  created_at,
  updated_at
)
select
  gen_random_uuid(),
  product_id,
  pack_unit_name,
  pack_conversion,
  default_sale_price * pack_conversion,
  default_purchase_price * pack_conversion,
  false,
  true,
  now() - make_interval(days => 25 - seed_no),
  now() - make_interval(days => seed_no % 4)
from tmp_seed_product_map
where pack_unit_name is not null
  and pack_conversion is not null;

insert into public.product_units (
  id,
  product_id,
  unit_name,
  conversion_to_base_qty,
  default_sale_price,
  default_purchase_price,
  is_base_unit,
  active,
  created_at,
  updated_at
)
select
  gen_random_uuid(),
  product_id,
  case_unit_name,
  case_conversion,
  default_sale_price * case_conversion,
  default_purchase_price * case_conversion,
  false,
  true,
  now() - make_interval(days => 20 - seed_no),
  now() - make_interval(days => seed_no % 5)
from tmp_seed_product_map
where case_unit_name is not null
  and case_conversion is not null;

insert into public.product_stock (
  product_id,
  on_hand_base_qty,
  avg_cost_per_base_unit,
  last_purchase_price,
  updated_at
)
select
  product_id,
  3200 + (seed_no * 85),
  default_purchase_price,
  default_purchase_price,
  now() - make_interval(days => seed_no % 7)
from tmp_seed_product_map;

create temporary table tmp_seed_customer_stores
on commit drop
as
select
  id,
  row_number() over (order by coalesce(updated_at, created_at) desc, name asc, id asc) as store_no
from public.stores
where deleted_at is null
  and active = true
  and nullif(btrim(coalesce(name, '')), '') is not null;

create temporary table tmp_seed_units
on commit drop
as
select
  product.seed_no,
  product.product_id,
  base_unit.id as base_unit_id,
  base_unit.conversion_to_base_qty as base_conversion,
  base_unit.default_sale_price as base_price,
  pack_unit.id as pack_unit_id,
  pack_unit.conversion_to_base_qty as pack_conversion,
  pack_unit.default_sale_price as pack_price,
  case_unit.id as case_unit_id,
  case_unit.conversion_to_base_qty as case_conversion,
  case_unit.default_sale_price as case_price
from tmp_seed_product_map product
join public.product_units base_unit
  on base_unit.product_id = product.product_id
 and base_unit.is_base_unit = true
left join public.product_units pack_unit
  on pack_unit.product_id = product.product_id
 and pack_unit.unit_name = product.pack_unit_name
left join public.product_units case_unit
  on case_unit.product_id = product.product_id
 and case_unit.unit_name = product.case_unit_name;

do $$
declare
  store_total integer;
  order_no integer;
  line_no integer;
  item_count integer;
  selected_store_id uuid;
  order_id uuid;
  order_time timestamptz;
  order_subtotal numeric(14, 2);
  discount_value numeric(14, 2);
  chosen record;
  unit_id uuid;
  unit_conversion numeric(18, 6);
  unit_price numeric(14, 2);
  quantity_value numeric(18, 3);
  order_note text;
  line_note text;
begin
  select count(*) into store_total from tmp_seed_customer_stores;

  if store_total = 0 then
    raise exception 'Không có store active để tạo dữ liệu orders seed.';
  end if;

  for order_no in 1..200 loop
    select id into selected_store_id
    from tmp_seed_customer_stores
    where store_no = ((order_no - 1) % store_total) + 1;

    order_time := date_trunc(
      'minute',
      now()
        - make_interval(days => ((order_no * 3) % 210))
        - make_interval(hours => ((order_no * 7) % 24))
        - make_interval(mins => ((order_no * 11) % 60))
    );

    order_note := case order_no % 10
      when 0 then 'Khách lấy thêm nước đá và ống hút.'
      when 1 then 'Giao đầu buổi sáng cho quán.'
      when 2 then 'Khách dặn xếp riêng nước khoáng.'
      when 3 then 'Đơn bán cho cửa hàng gần chợ.'
      when 4 then 'Khách lấy đủ bill theo đơn.'
      when 5 then 'Giao cùng tuyến với đơn lân cận.'
      when 6 then 'Khách ưu tiên các chai lạnh sẵn.'
      when 7 then 'Bổ sung thêm hàng bán buổi chiều.'
      when 8 then null
      else 'Đơn chốt lại sau cuộc gọi xác nhận.'
    end;

    insert into public.sales_orders (
      code,
      customer_store_id,
      status,
      note,
      discount_amount,
      created_at
    )
    values (
      format('DHHC%1$s-%2$s', to_char(current_date, 'YYMM'), lpad(order_no::text, 4, '0')),
      selected_store_id,
      'active',
      order_note,
      0,
      order_time
    )
    returning id into order_id;

    item_count := 1 + (order_no % 4);

    for line_no in 1..item_count loop
      select * into chosen
      from tmp_seed_units
      where seed_no = (((order_no * 3) + (line_no * 7)) % 30) + 1;

      if (order_no + line_no) % 3 = 0 and chosen.case_unit_id is not null then
        unit_id := chosen.case_unit_id;
        unit_conversion := chosen.case_conversion;
        unit_price := chosen.case_price;
        quantity_value := 1 + ((order_no + line_no) % 4);
        line_note := 'Bán theo thùng';
      elsif (order_no + line_no) % 3 = 1 and chosen.pack_unit_id is not null then
        unit_id := chosen.pack_unit_id;
        unit_conversion := chosen.pack_conversion;
        unit_price := chosen.pack_price;
        quantity_value := 1 + ((order_no + line_no * 2) % 5);
        line_note := 'Bán theo lốc';
      else
        unit_id := chosen.base_unit_id;
        unit_conversion := chosen.base_conversion;
        unit_price := chosen.base_price;
        quantity_value := 4 + ((order_no + line_no * 3) % 18);
        line_note := case when quantity_value >= 10 then 'Bán lẻ số lượng nhiều' else null end;
      end if;

      insert into public.sales_order_items (
        sales_order_id,
        product_id,
        product_unit_id,
        quantity,
        conversion_to_base_qty,
        unit_price,
        note,
        created_at
      )
      values (
        order_id,
        chosen.product_id,
        unit_id,
        quantity_value,
        unit_conversion,
        unit_price,
        line_note,
        order_time
      );
    end loop;

    select so.subtotal_amount into order_subtotal
    from public.sales_orders so
    where id = order_id;

    discount_value := case
      when order_no % 6 = 0 then least(order_subtotal * 0.08, 20000)
      when order_no % 5 = 0 then least(order_subtotal * 0.05, 12000)
      when order_no % 4 = 0 then least(order_subtotal * 0.03, 8000)
      else 0
    end;

    update public.sales_orders
    set
      discount_amount = discount_value,
      total_amount = order_subtotal - discount_value,
      gross_profit_amount = order_subtotal - discount_value - total_cost_amount
    where id = order_id;
  end loop;
end $$;

update public.stock_movements movement
set created_at = item.created_at,
    note = coalesce(movement.note, item.note, 'Dữ liệu kiểm thử orders/inventory 2026-05')
from public.sales_order_items item
join public.sales_orders order_row on order_row.id = item.sales_order_id
where movement.source_table = 'sales_order_items'
  and movement.source_id = item.id
  and order_row.code like 'DHHC%';

commit;
