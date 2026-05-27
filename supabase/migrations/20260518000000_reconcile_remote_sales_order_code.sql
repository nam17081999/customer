-- Reconciliation for remote migration already applied on staging.
-- Remote version: 20260518000000
-- Purpose observed from linked DB catalog:
-- - create public.sales_order_code_seq
-- - create public.generate_sales_order_code()
-- - replace create_sales_order_with_items(jsonb,jsonb) to generate order code server-side
--
-- This file exists locally so Supabase migration history matches remote without reset.
-- Later migration 20260525000000 replaces create_sales_order_with_items again with
-- idempotency and explicit/client request code handling.

create sequence if not exists public.sales_order_code_seq
  start with 1
  increment by 1
  no minvalue
  no maxvalue
  cache 1;

grant usage on sequence public.sales_order_code_seq to anon, authenticated, service_role;

create or replace function public.generate_sales_order_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  next_code text;
begin
  loop
    next_code := 'DH' || lpad(nextval('public.sales_order_code_seq')::text, 6, '0');
    exit when not exists (
      select 1
      from public.sales_orders
      where code = next_code
    );
  end loop;

  return next_code;
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
    public.generate_sales_order_code(),
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

grant execute on function public.generate_sales_order_code() to authenticated;
grant execute on function public.create_sales_order_with_items(jsonb, jsonb) to authenticated;
