-- Scalable reporting aggregate RPCs for dashboard/reporting.
-- Keeps historical sales snapshots as source of truth for revenue/profit.

create index if not exists idx_sales_orders_status_created_at
  on public.sales_orders (status, created_at desc);

create index if not exists idx_sales_order_items_product_order
  on public.sales_order_items (product_id, sales_order_id);

create index if not exists idx_purchase_orders_cancelled_created_at
  on public.purchase_orders (cancelled_at, created_at desc);

create index if not exists idx_stock_movements_product_created_at
  on public.stock_movements (product_id, created_at desc);

create or replace function public.get_sales_summary(
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns table (
  order_count integer,
  revenue numeric(14, 2),
  cost numeric(14, 2),
  profit numeric(14, 2),
  discount numeric(14, 2),
  avg_order_value numeric(14, 2)
)
language sql
security definer
set search_path = public
as $$
  select
    count(*)::int as order_count,
    round(coalesce(sum(total_amount), 0), 2)::numeric(14, 2) as revenue,
    round(coalesce(sum(total_cost_amount), 0), 2)::numeric(14, 2) as cost,
    round(coalesce(sum(gross_profit_amount), 0), 2)::numeric(14, 2) as profit,
    round(coalesce(sum(discount_amount), 0), 2)::numeric(14, 2) as discount,
    round(coalesce(avg(total_amount), 0), 2)::numeric(14, 2) as avg_order_value
  from public.sales_orders
  where public.is_admin_user()
    and status = 'active'
    and (p_from is null or created_at >= p_from)
    and (p_to is null or created_at < p_to);
$$;

create or replace function public.get_purchase_summary(
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns table (
  purchase_count integer,
  purchase_amount numeric(14, 2)
)
language sql
security definer
set search_path = public
as $$
  select
    count(*)::int as purchase_count,
    round(coalesce(sum(total_amount), 0), 2)::numeric(14, 2) as purchase_amount
  from public.purchase_orders
  where public.is_admin_user()
    and cancelled_at is null
    and (p_from is null or created_at >= p_from)
    and (p_to is null or created_at < p_to);
$$;

create or replace function public.get_inventory_valuation_summary()
returns table (
  product_count integer,
  active_product_count integer,
  low_stock_count integer,
  out_of_stock_count integer,
  stock_value numeric(18, 2)
)
language sql
security definer
set search_path = public
as $$
  select
    count(p.id)::int as product_count,
    count(p.id) filter (where p.active is not false)::int as active_product_count,
    count(p.id) filter (where coalesce(ps.on_hand_base_qty, 0) <= p.min_stock_base_qty)::int as low_stock_count,
    count(p.id) filter (where coalesce(ps.on_hand_base_qty, 0) <= 0)::int as out_of_stock_count,
    round(coalesce(sum(coalesce(ps.on_hand_base_qty, 0) * coalesce(ps.avg_cost_per_base_unit, 0)), 0), 2)::numeric(18, 2) as stock_value
  from public.products p
  left join public.product_stock ps on ps.product_id = p.id
  where public.is_admin_user()
    and p.deleted_at is null;
$$;

create or replace function public.get_top_products_report(
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_limit integer default 10
)
returns table (
  product_id uuid,
  product_name text,
  sku text,
  quantity_base numeric(18, 3),
  revenue numeric(14, 2),
  profit numeric(14, 2),
  order_count integer
)
language sql
security definer
set search_path = public
as $$
  select
    soi.product_id,
    coalesce(p.name, soi.product_id::text) as product_name,
    p.sku,
    round(coalesce(sum(soi.quantity_base), 0), 3)::numeric(18, 3) as quantity_base,
    round(coalesce(sum(soi.line_total), 0), 2)::numeric(14, 2) as revenue,
    round(coalesce(sum(soi.line_profit), 0), 2)::numeric(14, 2) as profit,
    count(distinct so.id)::int as order_count
  from public.sales_order_items soi
  join public.sales_orders so on so.id = soi.sales_order_id
  left join public.products p on p.id = soi.product_id
  where public.is_admin_user()
    and so.status = 'active'
    and (p_from is null or so.created_at >= p_from)
    and (p_to is null or so.created_at < p_to)
  group by soi.product_id, p.name, p.sku
  order by quantity_base desc, revenue desc
  limit greatest(1, least(coalesce(p_limit, 10), 100));
$$;

create or replace function public.get_low_stock_report(p_limit integer default 50)
returns table (
  product_id uuid,
  product_name text,
  sku text,
  on_hand_base_qty numeric(18, 3),
  min_stock_base_qty numeric(18, 3),
  base_unit_name text
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
    p.base_unit_name
  from public.products p
  left join public.product_stock ps on ps.product_id = p.id
  where public.is_admin_user()
    and p.deleted_at is null
    and p.active is not false
    and coalesce(ps.on_hand_base_qty, 0) <= p.min_stock_base_qty
  order by coalesce(ps.on_hand_base_qty, 0) asc, p.name asc
  limit greatest(1, least(coalesce(p_limit, 50), 500));
$$;

create or replace function public.get_customer_revenue_report(
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_limit integer default 20
)
returns table (
  customer_store_id uuid,
  customer_name text,
  order_count integer,
  revenue numeric(14, 2),
  profit numeric(14, 2)
)
language sql
security definer
set search_path = public
as $$
  select
    so.customer_store_id,
    coalesce(s.name, so.customer_store_id::text) as customer_name,
    count(*)::int as order_count,
    round(coalesce(sum(so.total_amount), 0), 2)::numeric(14, 2) as revenue,
    round(coalesce(sum(so.gross_profit_amount), 0), 2)::numeric(14, 2) as profit
  from public.sales_orders so
  left join public.stores s on s.id = so.customer_store_id
  where public.is_admin_user()
    and so.status = 'active'
    and (p_from is null or so.created_at >= p_from)
    and (p_to is null or so.created_at < p_to)
  group by so.customer_store_id, s.name
  order by revenue desc, order_count desc
  limit greatest(1, least(coalesce(p_limit, 20), 200));
$$;

grant execute on function public.get_sales_summary(timestamptz, timestamptz) to authenticated;
grant execute on function public.get_purchase_summary(timestamptz, timestamptz) to authenticated;
grant execute on function public.get_inventory_valuation_summary() to authenticated;
grant execute on function public.get_top_products_report(timestamptz, timestamptz, integer) to authenticated;
grant execute on function public.get_low_stock_report(integer) to authenticated;
grant execute on function public.get_customer_revenue_report(timestamptz, timestamptz, integer) to authenticated;
