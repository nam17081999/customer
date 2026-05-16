-- Order + inventory MVP schema - admin only
-- Date: 2026-05-12
--
-- Prerequisites:
-- - Run `docs/sql/2026-04-06-auth-roles-and-rls.sql` first (provides `public.is_admin_user()`).
--
-- IMPORTANT:
-- - This file assumes `public.stores.id` is UUID (common Supabase default).
-- - If your environment uses BIGINT for `stores.id`, change
--   `sales_orders.customer_store_id uuid` below to `bigint` before applying.
--
-- Design:
-- - `stores` is reused as customers.
-- - `auth.users` is reused as actors (`created_by`).
-- - Stock is stored in each product's base unit, usually the smallest unit
--   that can be sold/exported (bottle, can, pack, item).
-- - Purchase orders add stock immediately.
-- - Sales orders remove stock immediately.
-- - Product prices and unit conversions are snapshotted on order items.

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sku text null,
  category text null,
  base_unit_name text not null,
  default_sale_price numeric(14, 2) not null default 0,
  default_purchase_price numeric(14, 2) null,
  min_stock_base_qty numeric(18, 3) not null default 0,
  active boolean not null default true,
  note text null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint products_name_not_blank check (length(btrim(name)) > 0),
  constraint products_base_unit_not_blank check (length(btrim(base_unit_name)) > 0),
  constraint products_default_sale_price_nonnegative check (default_sale_price >= 0),
  constraint products_default_purchase_price_nonnegative check (
    default_purchase_price is null or default_purchase_price >= 0
  ),
  constraint products_min_stock_nonnegative check (min_stock_base_qty >= 0)
);

create unique index if not exists idx_products_sku_unique_active
  on public.products (sku)
  where sku is not null and deleted_at is null;

create index if not exists idx_products_active_name
  on public.products (active, name)
  where deleted_at is null;

create table if not exists public.product_units (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  unit_name text not null,
  conversion_to_base_qty numeric(18, 6) not null,
  default_sale_price numeric(14, 2) null,
  default_purchase_price numeric(14, 2) null,
  is_base_unit boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_units_unit_name_not_blank check (length(btrim(unit_name)) > 0),
  constraint product_units_conversion_positive check (conversion_to_base_qty > 0),
  constraint product_units_base_unit_conversion_is_one check (
    is_base_unit = false or conversion_to_base_qty = 1
  ),
  constraint product_units_default_sale_price_nonnegative check (
    default_sale_price is null or default_sale_price >= 0
  ),
  constraint product_units_default_purchase_price_nonnegative check (
    default_purchase_price is null or default_purchase_price >= 0
  )
);

create unique index if not exists idx_product_units_product_unit_name_unique
  on public.product_units (product_id, lower(unit_name));

create unique index if not exists idx_product_units_one_base_unit_per_product
  on public.product_units (product_id)
  where is_base_unit = true;

create table if not exists public.product_stock (
  product_id uuid primary key references public.products(id) on delete cascade,
  on_hand_base_qty numeric(18, 3) not null default 0,
  avg_cost_per_base_unit numeric(14, 4) not null default 0,
  last_purchase_price numeric(14, 4) null,
  updated_at timestamptz not null default now(),
  constraint product_stock_on_hand_nonnegative check (on_hand_base_qty >= 0),
  constraint product_stock_avg_cost_nonnegative check (avg_cost_per_base_unit >= 0),
  constraint product_stock_last_purchase_nonnegative check (
    last_purchase_price is null or last_purchase_price >= 0
  )
);

create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  supplier_name text null,
  note text null,
  total_amount numeric(14, 2) not null default 0,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz null,
  constraint purchase_orders_code_not_blank check (length(btrim(code)) > 0),
  constraint purchase_orders_total_nonnegative check (total_amount >= 0)
);

create unique index if not exists idx_purchase_orders_code_unique
  on public.purchase_orders (code);

create index if not exists idx_purchase_orders_created_at_desc
  on public.purchase_orders (created_at desc);

create table if not exists public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  product_unit_id uuid not null references public.product_units(id) on delete restrict,
  quantity numeric(18, 3) not null,
  conversion_to_base_qty numeric(18, 6) not null,
  quantity_base numeric(18, 3) generated always as (quantity * conversion_to_base_qty) stored,
  unit_cost numeric(14, 2) not null,
  unit_cost_base numeric(14, 4) generated always as (unit_cost / conversion_to_base_qty) stored,
  line_total numeric(14, 2) generated always as (quantity * unit_cost) stored,
  note text null,
  created_at timestamptz not null default now(),
  constraint purchase_order_items_quantity_positive check (quantity > 0),
  constraint purchase_order_items_conversion_positive check (conversion_to_base_qty > 0),
  constraint purchase_order_items_unit_cost_nonnegative check (unit_cost >= 0)
);

create index if not exists idx_purchase_order_items_order_id
  on public.purchase_order_items (purchase_order_id);

create index if not exists idx_purchase_order_items_product_id
  on public.purchase_order_items (product_id);

create table if not exists public.sales_orders (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  customer_store_id uuid not null references public.stores(id) on delete restrict,
  status text not null default 'active',
  note text null,
  subtotal_amount numeric(14, 2) not null default 0,
  discount_amount numeric(14, 2) not null default 0,
  total_amount numeric(14, 2) not null default 0,
  total_cost_amount numeric(14, 2) not null default 0,
  gross_profit_amount numeric(14, 2) not null default 0,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz null,
  constraint sales_orders_code_not_blank check (length(btrim(code)) > 0),
  constraint sales_orders_status_allowed check (status in ('active', 'cancelled')),
  constraint sales_orders_discount_nonnegative check (discount_amount >= 0),
  constraint sales_orders_subtotal_nonnegative check (subtotal_amount >= 0),
  constraint sales_orders_total_nonnegative check (total_amount >= 0),
  constraint sales_orders_total_cost_nonnegative check (total_cost_amount >= 0)
);

create unique index if not exists idx_sales_orders_code_unique
  on public.sales_orders (code);

create index if not exists idx_sales_orders_customer_store_id
  on public.sales_orders (customer_store_id);

create index if not exists idx_sales_orders_created_at_desc
  on public.sales_orders (created_at desc);

create table if not exists public.sales_order_items (
  id uuid primary key default gen_random_uuid(),
  sales_order_id uuid not null references public.sales_orders(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  product_unit_id uuid not null references public.product_units(id) on delete restrict,
  quantity numeric(18, 3) not null,
  conversion_to_base_qty numeric(18, 6) not null,
  quantity_base numeric(18, 3) generated always as (quantity * conversion_to_base_qty) stored,
  unit_price numeric(14, 2) not null,
  unit_price_base numeric(14, 4) generated always as (unit_price / conversion_to_base_qty) stored,
  cost_price_base numeric(14, 4) not null,
  line_total numeric(14, 2) generated always as (quantity * unit_price) stored,
  line_cost_total numeric(14, 2) generated always as ((quantity * conversion_to_base_qty) * cost_price_base) stored,
  line_profit numeric(14, 2) generated always as (
    (quantity * unit_price) - ((quantity * conversion_to_base_qty) * cost_price_base)
  ) stored,
  note text null,
  created_at timestamptz not null default now(),
  constraint sales_order_items_quantity_positive check (quantity > 0),
  constraint sales_order_items_conversion_positive check (conversion_to_base_qty > 0),
  constraint sales_order_items_unit_price_nonnegative check (unit_price >= 0),
  constraint sales_order_items_cost_price_nonnegative check (cost_price_base >= 0)
);

create index if not exists idx_sales_order_items_order_id
  on public.sales_order_items (sales_order_id);

create index if not exists idx_sales_order_items_product_id
  on public.sales_order_items (product_id);

create table if not exists public.stock_adjustments (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  reason text not null,
  note text null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint stock_adjustments_code_not_blank check (length(btrim(code)) > 0),
  constraint stock_adjustments_reason_not_blank check (length(btrim(reason)) > 0)
);

create unique index if not exists idx_stock_adjustments_code_unique
  on public.stock_adjustments (code);

create table if not exists public.stock_adjustment_items (
  id uuid primary key default gen_random_uuid(),
  stock_adjustment_id uuid not null references public.stock_adjustments(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity_base_delta numeric(18, 3) not null,
  cost_price_base numeric(14, 4) not null default 0,
  note text null,
  created_at timestamptz not null default now(),
  constraint stock_adjustment_items_delta_nonzero check (quantity_base_delta <> 0),
  constraint stock_adjustment_items_cost_nonnegative check (cost_price_base >= 0)
);

create index if not exists idx_stock_adjustment_items_adjustment_id
  on public.stock_adjustment_items (stock_adjustment_id);

create index if not exists idx_stock_adjustment_items_product_id
  on public.stock_adjustment_items (product_id);

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  movement_type text not null,
  source_table text not null,
  source_id uuid not null,
  quantity_base numeric(18, 3) not null,
  cost_price_base numeric(14, 4) not null default 0,
  stock_after_base_qty numeric(18, 3) not null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  note text null,
  constraint stock_movements_type_allowed check (
    movement_type in ('purchase', 'sale', 'adjustment', 'purchase_cancel', 'sale_cancel')
  ),
  constraint stock_movements_source_not_blank check (length(btrim(source_table)) > 0),
  constraint stock_movements_quantity_nonzero check (quantity_base <> 0),
  constraint stock_movements_cost_nonnegative check (cost_price_base >= 0),
  constraint stock_movements_stock_after_nonnegative check (stock_after_base_qty >= 0)
);

create index if not exists idx_stock_movements_product_created_at_desc
  on public.stock_movements (product_id, created_at desc);

create index if not exists idx_stock_movements_source
  on public.stock_movements (source_table, source_id);

create or replace function public.touch_order_inventory_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_products_touch_updated_at on public.products;
create trigger trg_products_touch_updated_at
before update on public.products
for each row
execute function public.touch_order_inventory_updated_at();

drop trigger if exists trg_product_units_touch_updated_at on public.product_units;
create trigger trg_product_units_touch_updated_at
before update on public.product_units
for each row
execute function public.touch_order_inventory_updated_at();

create or replace function public.fill_order_item_unit_snapshot()
returns trigger
language plpgsql
as $$
declare
  unit_conversion numeric(18, 6);
begin
  select pu.conversion_to_base_qty
    into unit_conversion
  from public.product_units pu
  where pu.id = new.product_unit_id
    and pu.product_id = new.product_id
    and pu.active = true;

  if unit_conversion is null then
    raise exception 'Invalid product unit % for product %', new.product_unit_id, new.product_id;
  end if;

  if new.conversion_to_base_qty is null then
    new.conversion_to_base_qty = unit_conversion;
  end if;

  if new.conversion_to_base_qty <= 0 then
    raise exception 'conversion_to_base_qty must be positive';
  end if;

  return new;
end;
$$;

create or replace function public.apply_purchase_order_item_stock()
returns trigger
language plpgsql
as $$
declare
  current_on_hand numeric(18, 3);
  current_avg_cost numeric(14, 4);
  next_on_hand numeric(18, 3);
  next_avg_cost numeric(14, 4);
  actor_id uuid;
begin
  insert into public.product_stock (product_id)
  values (new.product_id)
  on conflict (product_id) do nothing;

  select on_hand_base_qty, avg_cost_per_base_unit
    into current_on_hand, current_avg_cost
  from public.product_stock
  where product_id = new.product_id
  for update;

  next_on_hand = current_on_hand + new.quantity_base;
  next_avg_cost = case
    when next_on_hand = 0 then 0
    else ((current_on_hand * current_avg_cost) + new.line_total) / next_on_hand
  end;

  update public.product_stock
  set
    on_hand_base_qty = next_on_hand,
    avg_cost_per_base_unit = next_avg_cost,
    last_purchase_price = new.unit_cost_base,
    updated_at = now()
  where product_id = new.product_id;

  select created_by into actor_id
  from public.purchase_orders
  where id = new.purchase_order_id;

  insert into public.stock_movements (
    product_id,
    movement_type,
    source_table,
    source_id,
    quantity_base,
    cost_price_base,
    stock_after_base_qty,
    created_by,
    note
  )
  values (
    new.product_id,
    'purchase',
    'purchase_order_items',
    new.id,
    new.quantity_base,
    new.unit_cost_base,
    next_on_hand,
    actor_id,
    new.note
  );

  update public.purchase_orders
  set total_amount = total_amount + new.line_total
  where id = new.purchase_order_id;

  return new;
end;
$$;

create or replace function public.fill_sales_order_item_cost()
returns trigger
language plpgsql
as $$
declare
  unit_conversion numeric(18, 6);
  current_on_hand numeric(18, 3);
  current_avg_cost numeric(14, 4);
  requested_base_qty numeric(18, 3);
begin
  select pu.conversion_to_base_qty
    into unit_conversion
  from public.product_units pu
  where pu.id = new.product_unit_id
    and pu.product_id = new.product_id
    and pu.active = true;

  if unit_conversion is null then
    raise exception 'Invalid product unit % for product %', new.product_unit_id, new.product_id;
  end if;

  if new.conversion_to_base_qty is null then
    new.conversion_to_base_qty = unit_conversion;
  end if;

  requested_base_qty = new.quantity * new.conversion_to_base_qty;

  select on_hand_base_qty, avg_cost_per_base_unit
    into current_on_hand, current_avg_cost
  from public.product_stock
  where product_id = new.product_id
  for update;

  if current_on_hand is null then
    raise exception 'Product % has no stock row', new.product_id;
  end if;

  if current_on_hand < requested_base_qty then
    raise exception 'Insufficient stock for product %. On hand: %, requested: %',
      new.product_id, current_on_hand, requested_base_qty;
  end if;

  if new.cost_price_base is null then
    new.cost_price_base = current_avg_cost;
  end if;

  return new;
end;
$$;

create or replace function public.apply_sales_order_item_stock()
returns trigger
language plpgsql
as $$
declare
  next_on_hand numeric(18, 3);
  actor_id uuid;
begin
  update public.product_stock
  set
    on_hand_base_qty = on_hand_base_qty - new.quantity_base,
    updated_at = now()
  where product_id = new.product_id
    and on_hand_base_qty >= new.quantity_base
  returning on_hand_base_qty into next_on_hand;

  if next_on_hand is null then
    raise exception 'Insufficient stock for product %', new.product_id;
  end if;

  select created_by into actor_id
  from public.sales_orders
  where id = new.sales_order_id;

  insert into public.stock_movements (
    product_id,
    movement_type,
    source_table,
    source_id,
    quantity_base,
    cost_price_base,
    stock_after_base_qty,
    created_by,
    note
  )
  values (
    new.product_id,
    'sale',
    'sales_order_items',
    new.id,
    -new.quantity_base,
    new.cost_price_base,
    next_on_hand,
    actor_id,
    new.note
  );

  update public.sales_orders
  set
    subtotal_amount = subtotal_amount + new.line_total,
    total_amount = subtotal_amount + new.line_total - discount_amount,
    total_cost_amount = total_cost_amount + new.line_cost_total,
    gross_profit_amount = subtotal_amount + new.line_total - discount_amount - (total_cost_amount + new.line_cost_total)
  where id = new.sales_order_id;

  return new;
end;
$$;

create or replace function public.apply_stock_adjustment_item()
returns trigger
language plpgsql
as $$
declare
  current_on_hand numeric(18, 3);
  next_on_hand numeric(18, 3);
  actor_id uuid;
begin
  insert into public.product_stock (product_id)
  values (new.product_id)
  on conflict (product_id) do nothing;

  select on_hand_base_qty
    into current_on_hand
  from public.product_stock
  where product_id = new.product_id
  for update;

  next_on_hand = current_on_hand + new.quantity_base_delta;

  if next_on_hand < 0 then
    raise exception 'Stock adjustment would make product % negative', new.product_id;
  end if;

  update public.product_stock
  set on_hand_base_qty = next_on_hand, updated_at = now()
  where product_id = new.product_id;

  select created_by into actor_id
  from public.stock_adjustments
  where id = new.stock_adjustment_id;

  insert into public.stock_movements (
    product_id,
    movement_type,
    source_table,
    source_id,
    quantity_base,
    cost_price_base,
    stock_after_base_qty,
    created_by,
    note
  )
  values (
    new.product_id,
    'adjustment',
    'stock_adjustment_items',
    new.id,
    new.quantity_base_delta,
    new.cost_price_base,
    next_on_hand,
    actor_id,
    new.note
  );

  return new;
end;
$$;

drop trigger if exists trg_purchase_order_items_fill_unit_snapshot on public.purchase_order_items;
create trigger trg_purchase_order_items_fill_unit_snapshot
before insert on public.purchase_order_items
for each row
execute function public.fill_order_item_unit_snapshot();

drop trigger if exists trg_purchase_order_items_apply_stock on public.purchase_order_items;
create trigger trg_purchase_order_items_apply_stock
after insert on public.purchase_order_items
for each row
execute function public.apply_purchase_order_item_stock();

drop trigger if exists trg_sales_order_items_fill_cost on public.sales_order_items;
create trigger trg_sales_order_items_fill_cost
before insert on public.sales_order_items
for each row
execute function public.fill_sales_order_item_cost();

drop trigger if exists trg_sales_order_items_apply_stock on public.sales_order_items;
create trigger trg_sales_order_items_apply_stock
after insert on public.sales_order_items
for each row
execute function public.apply_sales_order_item_stock();

drop trigger if exists trg_stock_adjustment_items_apply on public.stock_adjustment_items;
create trigger trg_stock_adjustment_items_apply
after insert on public.stock_adjustment_items
for each row
execute function public.apply_stock_adjustment_item();

create or replace function public.create_purchase_order_with_items(
  p_order jsonb,
  p_items jsonb
)
returns public.purchase_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  order_row public.purchase_orders;
  item_row jsonb;
begin
  if not public.is_admin_user() then
    raise exception 'Not authorized';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Purchase order requires at least one item';
  end if;

  insert into public.purchase_orders (
    code,
    supplier_name,
    note,
    created_by
  )
  values (
    coalesce(nullif(btrim(p_order->>'code'), ''), 'PN' || to_char(now(), 'YYYYMMDDHH24MISS')),
    nullif(btrim(p_order->>'supplier_name'), ''),
    nullif(btrim(p_order->>'note'), ''),
    nullif(p_order->>'created_by', '')::uuid
  )
  returning * into order_row;

  for item_row in select * from jsonb_array_elements(p_items)
  loop
    insert into public.purchase_order_items (
      purchase_order_id,
      product_id,
      product_unit_id,
      quantity,
      conversion_to_base_qty,
      unit_cost,
      note
    )
    values (
      order_row.id,
      (item_row->>'product_id')::uuid,
      (item_row->>'product_unit_id')::uuid,
      (item_row->>'quantity')::numeric,
      (item_row->>'conversion_to_base_qty')::numeric,
      (item_row->>'unit_cost')::numeric,
      nullif(btrim(item_row->>'note'), '')
    );
  end loop;

  select * into order_row
  from public.purchase_orders
  where id = order_row.id;

  return order_row;
end;
$$;

create or replace function public.create_sales_order_with_items(
  p_order jsonb,
  p_items jsonb
)
returns public.sales_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  order_row public.sales_orders;
  item_row jsonb;
begin
  if not public.is_admin_user() then
    raise exception 'Not authorized';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Sales order requires at least one item';
  end if;

  insert into public.sales_orders (
    code,
    customer_store_id,
    note,
    discount_amount,
    created_by
  )
  values (
    coalesce(nullif(btrim(p_order->>'code'), ''), 'DH' || to_char(now(), 'YYYYMMDDHH24MISS')),
    (p_order->>'customer_store_id')::uuid,
    nullif(btrim(p_order->>'note'), ''),
    coalesce((p_order->>'discount_amount')::numeric, 0),
    nullif(p_order->>'created_by', '')::uuid
  )
  returning * into order_row;

  for item_row in select * from jsonb_array_elements(p_items)
  loop
    insert into public.sales_order_items (
      sales_order_id,
      product_id,
      product_unit_id,
      quantity,
      conversion_to_base_qty,
      unit_price,
      note
    )
    values (
      order_row.id,
      (item_row->>'product_id')::uuid,
      (item_row->>'product_unit_id')::uuid,
      (item_row->>'quantity')::numeric,
      (item_row->>'conversion_to_base_qty')::numeric,
      (item_row->>'unit_price')::numeric,
      nullif(btrim(item_row->>'note'), '')
    );
  end loop;

  select * into order_row
  from public.sales_orders
  where id = order_row.id;

  return order_row;
end;
$$;

create or replace function public.cancel_sales_order_and_restore_stock(
  p_order_id uuid,
  p_cancelled_by uuid default null
)
returns public.sales_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  order_row public.sales_orders;
  item_row public.sales_order_items;
  next_on_hand numeric(18, 3);
begin
  if not public.is_admin_user() then
    raise exception 'Not authorized';
  end if;

  select * into order_row
  from public.sales_orders
  where id = p_order_id
  for update;

  if order_row.id is null then
    raise exception 'Sales order % not found', p_order_id;
  end if;

  if order_row.status = 'cancelled' then
    return order_row;
  end if;

  for item_row in
    select * from public.sales_order_items where sales_order_id = p_order_id
  loop
    update public.product_stock
    set on_hand_base_qty = on_hand_base_qty + item_row.quantity_base,
        updated_at = now()
    where product_id = item_row.product_id
    returning on_hand_base_qty into next_on_hand;

    insert into public.stock_movements (
      product_id,
      movement_type,
      source_table,
      source_id,
      quantity_base,
      cost_price_base,
      stock_after_base_qty,
      created_by,
      note
    )
    values (
      item_row.product_id,
      'sale_cancel',
      'sales_order_items',
      item_row.id,
      item_row.quantity_base,
      item_row.cost_price_base,
      next_on_hand,
      coalesce(p_cancelled_by, order_row.created_by),
      'Hủy đơn ' || order_row.code
    );
  end loop;

  update public.sales_orders
  set status = 'cancelled',
      cancelled_at = now()
  where id = p_order_id
  returning * into order_row;

  return order_row;
end;
$$;

create or replace function public.cancel_purchase_order_and_remove_stock(
  p_purchase_order_id uuid,
  p_cancelled_by uuid default null
)
returns public.purchase_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  order_row public.purchase_orders;
  item_row public.purchase_order_items;
  next_on_hand numeric(18, 3);
begin
  if not public.is_admin_user() then
    raise exception 'Not authorized';
  end if;

  select * into order_row
  from public.purchase_orders
  where id = p_purchase_order_id
  for update;

  if order_row.id is null then
    raise exception 'Purchase order % not found', p_purchase_order_id;
  end if;

  if order_row.cancelled_at is not null then
    return order_row;
  end if;

  for item_row in
    select * from public.purchase_order_items where purchase_order_id = p_purchase_order_id
  loop
    update public.product_stock
    set on_hand_base_qty = on_hand_base_qty - item_row.quantity_base,
        updated_at = now()
    where product_id = item_row.product_id
      and on_hand_base_qty >= item_row.quantity_base
    returning on_hand_base_qty into next_on_hand;

    if next_on_hand is null then
      raise exception 'Cannot cancel purchase order %. Product % stock would be negative',
        p_purchase_order_id, item_row.product_id;
    end if;

    insert into public.stock_movements (
      product_id,
      movement_type,
      source_table,
      source_id,
      quantity_base,
      cost_price_base,
      stock_after_base_qty,
      created_by,
      note
    )
    values (
      item_row.product_id,
      'purchase_cancel',
      'purchase_order_items',
      item_row.id,
      -item_row.quantity_base,
      item_row.unit_cost_base,
      next_on_hand,
      coalesce(p_cancelled_by, order_row.created_by),
      'Hủy phiếu nhập ' || order_row.code
    );
  end loop;

  update public.purchase_orders
  set cancelled_at = now()
  where id = p_purchase_order_id
  returning * into order_row;

  return order_row;
end;
$$;

alter table public.products enable row level security;
alter table public.product_units enable row level security;
alter table public.product_stock enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_items enable row level security;
alter table public.sales_orders enable row level security;
alter table public.sales_order_items enable row level security;
alter table public.stock_adjustments enable row level security;
alter table public.stock_adjustment_items enable row level security;
alter table public.stock_movements enable row level security;

grant select, insert, update, delete on
  public.products,
  public.product_units,
  public.product_stock,
  public.purchase_orders,
  public.purchase_order_items,
  public.sales_orders,
  public.sales_order_items,
  public.stock_adjustments,
  public.stock_adjustment_items,
  public.stock_movements
to authenticated;

grant execute on function public.create_purchase_order_with_items(jsonb, jsonb) to authenticated;
grant execute on function public.create_sales_order_with_items(jsonb, jsonb) to authenticated;
grant execute on function public.cancel_sales_order_and_restore_stock(uuid, uuid) to authenticated;
grant execute on function public.cancel_purchase_order_and_remove_stock(uuid, uuid) to authenticated;

drop policy if exists "products_admin_all" on public.products;
create policy "products_admin_all"
  on public.products
  for all
  to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

drop policy if exists "product_units_admin_all" on public.product_units;
create policy "product_units_admin_all"
  on public.product_units
  for all
  to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

drop policy if exists "product_stock_admin_all" on public.product_stock;
create policy "product_stock_admin_all"
  on public.product_stock
  for all
  to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

drop policy if exists "purchase_orders_admin_all" on public.purchase_orders;
create policy "purchase_orders_admin_all"
  on public.purchase_orders
  for all
  to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

drop policy if exists "purchase_order_items_admin_all" on public.purchase_order_items;
create policy "purchase_order_items_admin_all"
  on public.purchase_order_items
  for all
  to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

drop policy if exists "sales_orders_admin_all" on public.sales_orders;
create policy "sales_orders_admin_all"
  on public.sales_orders
  for all
  to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

drop policy if exists "sales_order_items_admin_all" on public.sales_order_items;
create policy "sales_order_items_admin_all"
  on public.sales_order_items
  for all
  to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

drop policy if exists "stock_adjustments_admin_all" on public.stock_adjustments;
create policy "stock_adjustments_admin_all"
  on public.stock_adjustments
  for all
  to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

drop policy if exists "stock_adjustment_items_admin_all" on public.stock_adjustment_items;
create policy "stock_adjustment_items_admin_all"
  on public.stock_adjustment_items
  for all
  to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

drop policy if exists "stock_movements_admin_all" on public.stock_movements;
create policy "stock_movements_admin_all"
  on public.stock_movements
  for all
  to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());
