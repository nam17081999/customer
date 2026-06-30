-- Thêm updated_at (timestamp gốc từ product_stock) vào low stock report

drop function if exists public.get_low_stock_report(integer);

create or replace function public.get_low_stock_report(p_limit integer default 50)
returns table (
  product_id uuid,
  product_name text,
  sku text,
  on_hand_base_qty numeric(18, 3),
  min_stock_base_qty numeric(18, 3),
  base_unit_name text,
  updated_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    p.id,
    p.name,
    p.sku,
    round(coalesce(ps.on_hand_base_qty, 0), 3)::numeric(18, 3) as on_hand_base_qty,
    p.min_stock_base_qty,
    p.base_unit_name,
    ps.updated_at
  from public.products p
  left join public.product_stock ps on ps.product_id = p.id
  where public.is_admin_user()
    and p.deleted_at is null
    and p.active is not false
    and coalesce(ps.on_hand_base_qty, 0) <= p.min_stock_base_qty
  order by coalesce(ps.on_hand_base_qty, 0) asc, p.name asc
  limit greatest(1, least(coalesce(p_limit, 50), 500));
$$;

grant execute on function public.get_low_stock_report(integer) to authenticated;
