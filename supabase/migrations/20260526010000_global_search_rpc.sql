-- Server-side global search for command palette and operator workflows.
-- Returns a bounded typed result union across operational entities.

create index if not exists idx_products_search_active
  on public.products using gin (to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(sku, '') || ' ' || coalesce(category, '')))
  where deleted_at is null;

create index if not exists idx_stores_search_active
  on public.stores using gin (to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(phone, '') || ' ' || coalesce(address_detail, '') || ' ' || coalesce(ward, '') || ' ' || coalesce(district, '')))
  where deleted_at is null;

create index if not exists idx_sales_orders_code_search
  on public.sales_orders (lower(code));

create index if not exists idx_purchase_orders_code_search
  on public.purchase_orders (lower(code));

create or replace function public.global_operator_search(
  p_query text,
  p_limit integer default 20
)
returns table (
  entity_type text,
  entity_id text,
  title text,
  subtitle text,
  href text,
  rank_score numeric
)
language sql
security definer
set search_path = public
as $$
  with input as (
    select
      lower(btrim(coalesce(p_query, ''))) as q,
      greatest(1, least(coalesce(p_limit, 20), 50)) as safe_limit
  ), results as (
    select
      'product'::text as entity_type,
      p.id::text as entity_id,
      p.name as title,
      coalesce(p.sku, p.category, 'Hàng hóa') as subtitle,
      '/inventory/products/' || p.id::text as href,
      case
        when lower(coalesce(p.sku, '')) = input.q then 100
        when lower(p.name) = input.q then 95
        when lower(p.name) like input.q || '%' then 80
        else 60
      end::numeric as rank_score
    from public.products p, input
    where public.is_admin_user()
      and input.q <> ''
      and p.deleted_at is null
      and p.active is not false
      and (
        lower(p.name) like '%' || input.q || '%'
        or lower(coalesce(p.sku, '')) like '%' || input.q || '%'
        or lower(coalesce(p.category, '')) like '%' || input.q || '%'
      )

    union all

    select
      'customer'::text,
      s.id::text,
      s.name,
      concat_ws(' · ', nullif(s.phone, ''), nullif(s.ward, ''), nullif(s.district, '')),
      '/store/' || s.id::text,
      case
        when lower(s.name) = input.q then 95
        when lower(coalesce(s.phone, '')) = input.q then 90
        when lower(s.name) like input.q || '%' then 75
        else 55
      end::numeric
    from public.stores s, input
    where public.is_admin_user()
      and input.q <> ''
      and s.deleted_at is null
      and (
        lower(s.name) like '%' || input.q || '%'
        or lower(coalesce(s.phone, '')) like '%' || input.q || '%'
        or lower(coalesce(s.address_detail, '')) like '%' || input.q || '%'
        or lower(coalesce(s.ward, '')) like '%' || input.q || '%'
        or lower(coalesce(s.district, '')) like '%' || input.q || '%'
      )

    union all

    select
      'order'::text,
      so.id::text,
      so.code,
      concat_ws(' · ', 'Đơn bán', so.status, to_char(so.created_at, 'DD/MM/YYYY HH24:MI')),
      '/orders/' || so.id::text,
      case when lower(so.code) = input.q then 100 else 70 end::numeric
    from public.sales_orders so, input
    where public.is_admin_user()
      and input.q <> ''
      and lower(so.code) like '%' || input.q || '%'

    union all

    select
      'purchase'::text,
      po.id::text,
      po.code,
      concat_ws(' · ', 'Phiếu nhập', coalesce(po.supplier_name, 'NCC'), to_char(po.created_at, 'DD/MM/YYYY HH24:MI')),
      '/inventory/purchases/' || po.id::text,
      case when lower(po.code) = input.q then 100 else 70 end::numeric
    from public.purchase_orders po, input
    where public.is_admin_user()
      and input.q <> ''
      and lower(po.code) like '%' || input.q || '%'

    union all

    select
      'movement'::text,
      sm.id::text,
      coalesce(p.name, sm.product_id::text),
      concat_ws(' · ', sm.movement_type, to_char(sm.created_at, 'DD/MM/YYYY HH24:MI')),
      '/inventory/stock',
      45::numeric
    from public.stock_movements sm
    left join public.products p on p.id = sm.product_id,
    input
    where public.is_admin_user()
      and input.q <> ''
      and (
        lower(coalesce(p.name, '')) like '%' || input.q || '%'
        or lower(sm.movement_type) like '%' || input.q || '%'
      )
  )
  select entity_type, entity_id, title, subtitle, href, rank_score
  from results, input
  order by rank_score desc, title asc
  limit (select safe_limit from input);
$$;

grant execute on function public.global_operator_search(text, integer) to authenticated;
