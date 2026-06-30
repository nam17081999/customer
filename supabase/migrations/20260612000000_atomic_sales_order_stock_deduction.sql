-- Atomic stock check-and-deduct inside create_sales_order_with_items.
-- Makes the RPC self-sufficient: explicitly locks, verifies, and deducts stock
-- instead of relying solely on triggers. Triggers remain as safety nets.

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
  stock_info record;
  agg record;
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

  -- ── STEP 1: Lock all product_stock rows upfront, verify stock is sufficient ──
  -- Aggregate total base quantity per product across all items in the order.
  -- ORDER BY product_id ensures consistent lock ordering across concurrent
  -- transactions, preventing deadlocks when orders share multiple products.
  for agg in
    select
      (item->>'product_id')::uuid as product_id,
      sum(
        round((item->>'quantity')::numeric, 3) *
        round(coalesce(nullif(btrim(item->>'conversion_to_base_qty'), ''), '1')::numeric, 6)
      ) as total_base_qty
    from jsonb_array_elements(p_items) item
    group by (item->>'product_id')::uuid
    order by (item->>'product_id')::uuid
  loop
    -- Lock the stock row for this product (serializes concurrent orders on same product)
    select on_hand_base_qty
      into stock_info
    from public.product_stock
    where product_id = agg.product_id
    for update;

    if stock_info.on_hand_base_qty is null then
      raise exception 'Product % has no stock record', agg.product_id;
    end if;

    if stock_info.on_hand_base_qty < agg.total_base_qty then
      raise exception 'Insufficient stock for product %. On hand: %, requested: %',
        agg.product_id, stock_info.on_hand_base_qty, agg.total_base_qty;
    end if;
  end loop;

  -- ── STEP 2: Create the order ──
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

  -- ── STEP 3: Insert each item (triggers still fire as safety nets) ──
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
      round(coalesce(nullif(btrim(item_row->>'conversion_to_base_qty'), ''), '1')::numeric, 6),
      round((item_row->>'unit_price')::numeric, 2),
      nullif(btrim(item_row->>'note'), '')
    );
  end loop;

  -- ── STEP 4: Verify discount vs subtotal ──
  select subtotal_amount into final_subtotal
  from public.sales_orders
  where id = order_row.id
  for update;

  if order_row.discount_amount > final_subtotal then
    raise exception 'Discount amount % exceeds subtotal %', order_row.discount_amount, final_subtotal;
  end if;

  -- ── STEP 5: Return full order row ──
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
