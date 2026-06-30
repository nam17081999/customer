-- Harden order/inventory mutations for retry-safe production use.
-- Adds optional client_request_id idempotency keys without changing existing business schema semantics.

alter table public.purchase_orders
  add column if not exists client_request_id text null;

alter table public.sales_orders
  add column if not exists client_request_id text null;

create unique index if not exists idx_purchase_orders_client_request_id_unique
  on public.purchase_orders (client_request_id)
  where client_request_id is not null;

create unique index if not exists idx_sales_orders_client_request_id_unique
  on public.sales_orders (client_request_id)
  where client_request_id is not null;

create unique index if not exists idx_stock_movements_source_once
  on public.stock_movements (movement_type, source_table, source_id);

create or replace function public.create_purchase_order_with_items(
  p_order jsonb,
  p_items jsonb,
  p_request_id text default null
)
returns public.purchase_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  order_row public.purchase_orders;
  item_row jsonb;
  safe_request_id text;
begin
  if not public.is_admin_user() then
    raise exception 'Not authorized';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Purchase order requires at least one item';
  end if;

  safe_request_id = nullif(btrim(coalesce(p_request_id, p_order->>'client_request_id', p_order->>'request_id')), '');

  if safe_request_id is not null then
    select * into order_row
    from public.purchase_orders
    where client_request_id = safe_request_id
    for update;

    if order_row.id is not null then
      return order_row;
    end if;
  end if;

  insert into public.purchase_orders (
    code,
    supplier_name,
    note,
    created_by,
    client_request_id
  )
  values (
    coalesce(nullif(btrim(p_order->>'code'), ''), 'PN' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS')),
    nullif(btrim(p_order->>'supplier_name'), ''),
    nullif(btrim(p_order->>'note'), ''),
    nullif(p_order->>'created_by', '')::uuid,
    safe_request_id
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
      round((item_row->>'quantity')::numeric, 3),
      round((item_row->>'conversion_to_base_qty')::numeric, 6),
      round((item_row->>'unit_cost')::numeric, 2),
      nullif(btrim(item_row->>'note'), '')
    );
  end loop;

  select * into order_row
  from public.purchase_orders
  where id = order_row.id;

  return order_row;
exception
  when unique_violation then
    if safe_request_id is not null then
      select * into order_row
      from public.purchase_orders
      where client_request_id = safe_request_id
      for update;

      if order_row.id is not null then
        return order_row;
      end if;
    end if;
    raise;
end;
$$;

create or replace function public.create_sales_order_with_items(
  p_order jsonb,
  p_items jsonb,
  p_request_id text default null
)
returns public.sales_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  order_row public.sales_orders;
  item_row jsonb;
  safe_request_id text;
  final_subtotal numeric(14, 2);
begin
  if not public.is_admin_user() then
    raise exception 'Not authorized';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Sales order requires at least one item';
  end if;

  safe_request_id = nullif(btrim(coalesce(p_request_id, p_order->>'client_request_id', p_order->>'request_id')), '');

  if safe_request_id is not null then
    select * into order_row
    from public.sales_orders
    where client_request_id = safe_request_id
    for update;

    if order_row.id is not null then
      return order_row;
    end if;
  end if;

  insert into public.sales_orders (
    code,
    customer_store_id,
    note,
    discount_amount,
    created_by,
    client_request_id
  )
  values (
    coalesce(nullif(btrim(p_order->>'code'), ''), 'DH' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS')),
    (p_order->>'customer_store_id')::uuid,
    nullif(btrim(p_order->>'note'), ''),
    round(coalesce((p_order->>'discount_amount')::numeric, 0), 2),
    nullif(p_order->>'created_by', '')::uuid,
    safe_request_id
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
      round((item_row->>'quantity')::numeric, 3),
      round((item_row->>'conversion_to_base_qty')::numeric, 6),
      round((item_row->>'unit_price')::numeric, 2),
      nullif(btrim(item_row->>'note'), '')
    );
  end loop;

  select subtotal_amount into final_subtotal
  from public.sales_orders
  where id = order_row.id
  for update;

  if order_row.discount_amount > final_subtotal then
    raise exception 'Discount amount % exceeds subtotal %', order_row.discount_amount, final_subtotal;
  end if;

  select * into order_row
  from public.sales_orders
  where id = order_row.id;

  return order_row;
exception
  when unique_violation then
    if safe_request_id is not null then
      select * into order_row
      from public.sales_orders
      where client_request_id = safe_request_id
      for update;

      if order_row.id is not null then
        return order_row;
      end if;
    end if;
    raise;
end;
$$;
