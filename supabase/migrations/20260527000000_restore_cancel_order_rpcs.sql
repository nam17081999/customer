-- Phase 10: live staging repair for missing cancel RPCs.
-- Non-destructive: creates/replaces functions only; no data mutation.

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
    )
    on conflict (movement_type, source_table, source_id) do nothing;
  end loop;

  update public.sales_orders
  set status = 'cancelled',
      cancelled_at = coalesce(cancelled_at, now())
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
    )
    on conflict (movement_type, source_table, source_id) do nothing;
  end loop;

  update public.purchase_orders
  set cancelled_at = coalesce(cancelled_at, now())
  where id = p_purchase_order_id
  returning * into order_row;

  return order_row;
end;
$$;

grant execute on function public.cancel_sales_order_and_restore_stock(uuid, uuid) to authenticated;
grant execute on function public.cancel_purchase_order_and_remove_stock(uuid, uuid) to authenticated;
