-- Phase 9: audit event store + transaction-safe product import RPC
-- Safe to apply after order/inventory/reporting/search migrations.

create table if not exists public.operation_audit_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  entity_type text not null,
  entity_id text null,
  severity text not null default 'info',
  request_id text null,
  actor_id uuid null references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint operation_audit_events_event_type_not_blank check (length(btrim(event_type)) > 0),
  constraint operation_audit_events_entity_type_not_blank check (length(btrim(entity_type)) > 0),
  constraint operation_audit_events_severity_allowed check (severity in ('debug', 'info', 'warning', 'error', 'critical'))
);

create index if not exists idx_operation_audit_events_created_at
  on public.operation_audit_events (created_at desc);

create index if not exists idx_operation_audit_events_type_created_at
  on public.operation_audit_events (event_type, created_at desc);

create unique index if not exists idx_operation_audit_events_request_once
  on public.operation_audit_events (event_type, request_id)
  where request_id is not null;

alter table public.operation_audit_events enable row level security;

grant select, insert on public.operation_audit_events to authenticated;

drop policy if exists "operation_audit_events_admin_select" on public.operation_audit_events;
create policy "operation_audit_events_admin_select"
  on public.operation_audit_events
  for select
  to authenticated
  using (public.is_admin_user());

drop policy if exists "operation_audit_events_admin_insert" on public.operation_audit_events;
create policy "operation_audit_events_admin_insert"
  on public.operation_audit_events
  for insert
  to authenticated
  with check (public.is_admin_user());

create or replace function public.log_operation_audit_event(
  p_event_type text,
  p_entity_type text,
  p_entity_id text default null,
  p_severity text default 'info',
  p_request_id text default null,
  p_actor_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.operation_audit_events
language plpgsql
security definer
set search_path = public
as $$
declare
  event_row public.operation_audit_events;
begin
  if not public.is_admin_user() then
    raise exception 'Admin permission required' using errcode = '42501';
  end if;

  insert into public.operation_audit_events (
    event_type,
    entity_type,
    entity_id,
    severity,
    request_id,
    actor_id,
    metadata
  ) values (
    nullif(btrim(p_event_type), ''),
    nullif(btrim(p_entity_type), ''),
    nullif(btrim(p_entity_id), ''),
    coalesce(nullif(btrim(p_severity), ''), 'info'),
    nullif(btrim(p_request_id), ''),
    p_actor_id,
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (event_type, request_id) where request_id is not null
  do update set metadata = public.operation_audit_events.metadata || excluded.metadata
  returning * into event_row;

  return event_row;
end;
$$;

create or replace function public.import_products_from_preview(
  p_rows jsonb,
  p_request_id text,
  p_actor_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  row_item jsonb;
  row_number int;
  row_name text;
  row_sku text;
  row_unit text;
  row_sale_price numeric(14,2);
  row_errors text[];
  valid_count int := 0;
  invalid_count int := 0;
  inserted_count int := 0;
  updated_count int := 0;
  skipped_count int := 0;
  result_rows jsonb := '[]'::jsonb;
  product_id uuid;
  existing_id uuid;
  prior_event public.operation_audit_events;
begin
  if not public.is_admin_user() then
    raise exception 'Admin permission required' using errcode = '42501';
  end if;

  if p_request_id is null or length(btrim(p_request_id)) < 12 then
    raise exception 'Import request id is required' using errcode = '22023';
  end if;

  select * into prior_event
  from public.operation_audit_events
  where event_type = 'product_import'
    and request_id = btrim(p_request_id)
  limit 1;

  if prior_event.id is not null then
    return jsonb_build_object(
      'idempotent', true,
      'requestId', btrim(p_request_id),
      'summary', prior_event.metadata,
      'rows', prior_event.metadata -> 'rows'
    );
  end if;

  if jsonb_typeof(coalesce(p_rows, '[]'::jsonb)) <> 'array' then
    raise exception 'Import rows must be an array' using errcode = '22023';
  end if;

  for row_item in select * from jsonb_array_elements(p_rows)
  loop
    row_number := coalesce((row_item ->> 'rowNumber')::int, 0);
    row_name := nullif(btrim(coalesce(row_item #>> '{data,name}', row_item ->> 'name', '')), '');
    row_sku := nullif(btrim(coalesce(row_item #>> '{data,sku}', row_item ->> 'sku', '')), '');
    row_unit := nullif(btrim(coalesce(row_item #>> '{data,baseUnitName}', row_item ->> 'baseUnitName', row_item ->> 'base_unit_name', '')), '');
    row_sale_price := coalesce(nullif(coalesce(row_item #>> '{data,defaultSalePrice}', row_item ->> 'defaultSalePrice', row_item ->> 'default_sale_price', '0'), '')::numeric, 0);
    row_errors := array[]::text[];

    if row_name is null then row_errors := array_append(row_errors, 'Thiếu tên hàng'); end if;
    if row_unit is null then row_errors := array_append(row_errors, 'Thiếu đơn vị gốc'); end if;
    if row_sale_price < 0 then row_errors := array_append(row_errors, 'Giá bán không hợp lệ'); end if;

    if array_length(row_errors, 1) is not null then
      invalid_count := invalid_count + 1;
      result_rows := result_rows || jsonb_build_array(jsonb_build_object('rowNumber', row_number, 'status', 'invalid', 'errors', row_errors));
      continue;
    end if;

    valid_count := valid_count + 1;

    if row_sku is not null then
      select id into existing_id
      from public.products
      where sku = row_sku and deleted_at is null
      for update;
    else
      existing_id := null;
    end if;

    if existing_id is null then
      insert into public.products (name, sku, base_unit_name, default_sale_price, created_by)
      values (row_name, row_sku, row_unit, row_sale_price, p_actor_id)
      returning id into product_id;

      insert into public.product_units (product_id, unit_name, conversion_to_base_qty, default_sale_price, is_base_unit)
      values (product_id, row_unit, 1, row_sale_price, true)
      on conflict do nothing;

      insert into public.product_stock (product_id)
      values (product_id)
      on conflict do nothing;

      inserted_count := inserted_count + 1;
      result_rows := result_rows || jsonb_build_array(jsonb_build_object('rowNumber', row_number, 'status', 'inserted', 'productId', product_id));
    else
      update public.products
      set name = row_name,
          base_unit_name = row_unit,
          default_sale_price = row_sale_price,
          updated_at = now()
      where id = existing_id;

      insert into public.product_units (product_id, unit_name, conversion_to_base_qty, default_sale_price, is_base_unit)
      values (existing_id, row_unit, 1, row_sale_price, true)
      on conflict do nothing;

      updated_count := updated_count + 1;
      result_rows := result_rows || jsonb_build_array(jsonb_build_object('rowNumber', row_number, 'status', 'updated', 'productId', existing_id));
    end if;
  end loop;

  skipped_count := invalid_count;

  perform public.log_operation_audit_event(
    'product_import',
    'import',
    null,
    case when invalid_count > 0 then 'warning' else 'info' end,
    btrim(p_request_id),
    p_actor_id,
    jsonb_build_object(
      'validCount', valid_count,
      'invalidCount', invalid_count,
      'insertedCount', inserted_count,
      'updatedCount', updated_count,
      'skippedCount', skipped_count,
      'rows', result_rows
    )
  );

  return jsonb_build_object(
    'idempotent', false,
    'requestId', btrim(p_request_id),
    'summary', jsonb_build_object(
      'validCount', valid_count,
      'invalidCount', invalid_count,
      'insertedCount', inserted_count,
      'updatedCount', updated_count,
      'skippedCount', skipped_count
    ),
    'rows', result_rows
  );
end;
$$;

grant execute on function public.log_operation_audit_event(text, text, text, text, text, uuid, jsonb) to authenticated;
grant execute on function public.import_products_from_preview(jsonb, text, uuid) to authenticated;
