-- Inventory accounting reconciliation utilities.
-- Strategy:
-- - Do not rewrite historical sales cost/profit snapshots.
-- - Treat stock_movements as append-only accounting ledger for quantity replay.
-- - Rebuild current product_stock quantity and valuation from immutable purchase/adjustment cost inputs plus current movement quantity.
-- - Expose admin-only checker/repair RPCs for production diagnostics.

create table if not exists public.inventory_reconciliation_runs (
  id uuid primary key default gen_random_uuid(),
  run_type text not null,
  status text not null default 'started',
  checked_product_count integer not null default 0,
  mismatch_count integer not null default 0,
  negative_count integer not null default 0,
  orphan_movement_count integer not null default 0,
  repaired_count integer not null default 0,
  started_by uuid null references auth.users(id) on delete set null,
  started_at timestamptz not null default now(),
  finished_at timestamptz null,
  error_message text null,
  constraint inventory_reconciliation_runs_type_allowed check (run_type in ('check', 'repair')),
  constraint inventory_reconciliation_runs_status_allowed check (status in ('started', 'succeeded', 'failed'))
);

alter table public.inventory_reconciliation_runs enable row level security;

drop policy if exists "inventory_reconciliation_runs_admin_all" on public.inventory_reconciliation_runs;
create policy "inventory_reconciliation_runs_admin_all"
  on public.inventory_reconciliation_runs
  for all
  using (public.is_admin_user())
  with check (public.is_admin_user());

grant select, insert, update on public.inventory_reconciliation_runs to authenticated;

create or replace function public.get_inventory_reconciliation_report()
returns table (
  product_id uuid,
  product_name text,
  stock_on_hand_base_qty numeric(18, 3),
  replay_on_hand_base_qty numeric(18, 3),
  quantity_delta numeric(18, 3),
  stock_avg_cost_per_base_unit numeric(14, 4),
  replay_avg_cost_per_base_unit numeric(14, 4),
  avg_cost_delta numeric(14, 4),
  stock_value numeric(18, 2),
  replay_value numeric(18, 2),
  negative_ledger boolean,
  has_orphan_movement boolean,
  issue_codes text[]
)
language sql
security definer
set search_path = public
as $$
  with movement_replay as (
    select
      sm.product_id,
      round(coalesce(sum(sm.quantity_base), 0), 3)::numeric(18, 3) as replay_qty,
      bool_or(sm.stock_after_base_qty < 0) as negative_ledger
    from public.stock_movements sm
    group by sm.product_id
  ), purchase_costs as (
    select
      poi.product_id,
      coalesce(sum(poi.quantity_base) filter (where po.cancelled_at is null), 0) as active_purchase_qty,
      coalesce(sum(poi.line_total) filter (where po.cancelled_at is null), 0) as active_purchase_total
    from public.purchase_order_items poi
    join public.purchase_orders po on po.id = poi.purchase_order_id
    group by poi.product_id
  ), adjustment_costs as (
    select
      sai.product_id,
      coalesce(sum(sai.quantity_base_delta) filter (where sai.quantity_base_delta > 0), 0) as positive_adjustment_qty,
      coalesce(sum(sai.quantity_base_delta * sai.cost_price_base) filter (where sai.quantity_base_delta > 0), 0) as positive_adjustment_total
    from public.stock_adjustment_items sai
    group by sai.product_id
  ), orphan_products as (
    select sm.product_id, true as has_orphan_movement
    from public.stock_movements sm
    left join public.products p on p.id = sm.product_id
    where p.id is null
    group by sm.product_id
  ), product_source as (
    select p.id, p.name from public.products p
    union
    select sm.product_id, '[orphan movement]'::text from public.stock_movements sm
    left join public.products p on p.id = sm.product_id
    where p.id is null
  ), report as (
    select
      ps.id as product_id,
      ps.name as product_name,
      round(coalesce(stock.on_hand_base_qty, 0), 3)::numeric(18, 3) as stock_on_hand_base_qty,
      round(coalesce(replay.replay_qty, 0), 3)::numeric(18, 3) as replay_on_hand_base_qty,
      round(coalesce(stock.on_hand_base_qty, 0) - coalesce(replay.replay_qty, 0), 3)::numeric(18, 3) as quantity_delta,
      round(coalesce(stock.avg_cost_per_base_unit, 0), 4)::numeric(14, 4) as stock_avg_cost_per_base_unit,
      round(case
        when coalesce(purchase.active_purchase_qty, 0) + coalesce(adjustment.positive_adjustment_qty, 0) <= 0 then 0
        else (
          coalesce(purchase.active_purchase_total, 0) + coalesce(adjustment.positive_adjustment_total, 0)
        ) / (
          coalesce(purchase.active_purchase_qty, 0) + coalesce(adjustment.positive_adjustment_qty, 0)
        )
      end, 4)::numeric(14, 4) as replay_avg_cost_per_base_unit,
      coalesce(replay.negative_ledger, false) as negative_ledger,
      coalesce(orphan.has_orphan_movement, false) as has_orphan_movement
    from product_source ps
    left join public.product_stock stock on stock.product_id = ps.id
    left join movement_replay replay on replay.product_id = ps.id
    left join purchase_costs purchase on purchase.product_id = ps.id
    left join adjustment_costs adjustment on adjustment.product_id = ps.id
    left join orphan_products orphan on orphan.product_id = ps.id
  )
  select
    report.product_id,
    report.product_name,
    report.stock_on_hand_base_qty,
    report.replay_on_hand_base_qty,
    report.quantity_delta,
    report.stock_avg_cost_per_base_unit,
    report.replay_avg_cost_per_base_unit,
    round(report.stock_avg_cost_per_base_unit - report.replay_avg_cost_per_base_unit, 4)::numeric(14, 4) as avg_cost_delta,
    round(report.stock_on_hand_base_qty * report.stock_avg_cost_per_base_unit, 2)::numeric(18, 2) as stock_value,
    round(report.replay_on_hand_base_qty * report.replay_avg_cost_per_base_unit, 2)::numeric(18, 2) as replay_value,
    report.negative_ledger,
    report.has_orphan_movement,
    array_remove(array[
      case when abs(report.quantity_delta) > 0.0005 then 'quantity_mismatch' end,
      case when report.replay_on_hand_base_qty < 0 then 'negative_replay_stock' end,
      case when report.negative_ledger then 'negative_movement_snapshot' end,
      case when report.has_orphan_movement then 'orphan_movement' end,
      case when abs(report.stock_avg_cost_per_base_unit - report.replay_avg_cost_per_base_unit) > 0.0001 then 'avg_cost_mismatch' end
    ], null)::text[] as issue_codes
  from report
  where public.is_admin_user();
$$;

create or replace function public.run_inventory_reconciliation_check(p_started_by uuid default null)
returns public.inventory_reconciliation_runs
language plpgsql
security definer
set search_path = public
as $$
declare
  run_row public.inventory_reconciliation_runs;
  stats record;
begin
  if not public.is_admin_user() then
    raise exception 'Not authorized';
  end if;

  insert into public.inventory_reconciliation_runs (run_type, started_by)
  values ('check', p_started_by)
  returning * into run_row;

  select
    count(*)::int as checked_product_count,
    count(*) filter (where cardinality(issue_codes) > 0)::int as mismatch_count,
    count(*) filter (where replay_on_hand_base_qty < 0 or negative_ledger)::int as negative_count,
    count(*) filter (where has_orphan_movement)::int as orphan_movement_count
  into stats
  from public.get_inventory_reconciliation_report();

  update public.inventory_reconciliation_runs
  set status = 'succeeded',
      checked_product_count = stats.checked_product_count,
      mismatch_count = stats.mismatch_count,
      negative_count = stats.negative_count,
      orphan_movement_count = stats.orphan_movement_count,
      finished_at = now()
  where id = run_row.id
  returning * into run_row;

  return run_row;
exception
  when others then
    update public.inventory_reconciliation_runs
    set status = 'failed', finished_at = now(), error_message = sqlerrm
    where id = run_row.id
    returning * into run_row;
    return run_row;
end;
$$;

create or replace function public.repair_product_stock_from_ledger(p_started_by uuid default null)
returns public.inventory_reconciliation_runs
language plpgsql
security definer
set search_path = public
as $$
declare
  run_row public.inventory_reconciliation_runs;
  report_row record;
  repaired integer := 0;
begin
  if not public.is_admin_user() then
    raise exception 'Not authorized';
  end if;

  insert into public.inventory_reconciliation_runs (run_type, started_by)
  values ('repair', p_started_by)
  returning * into run_row;

  for report_row in
    select * from public.get_inventory_reconciliation_report()
    where not has_orphan_movement
      and replay_on_hand_base_qty >= 0
      and ('quantity_mismatch' = any(issue_codes) or 'avg_cost_mismatch' = any(issue_codes))
  loop
    insert into public.product_stock (
      product_id,
      on_hand_base_qty,
      avg_cost_per_base_unit,
      updated_at
    )
    values (
      report_row.product_id,
      report_row.replay_on_hand_base_qty,
      report_row.replay_avg_cost_per_base_unit,
      now()
    )
    on conflict (product_id) do update
    set on_hand_base_qty = excluded.on_hand_base_qty,
        avg_cost_per_base_unit = excluded.avg_cost_per_base_unit,
        updated_at = now();

    repaired = repaired + 1;
  end loop;

  update public.inventory_reconciliation_runs
  set status = 'succeeded',
      repaired_count = repaired,
      finished_at = now()
  where id = run_row.id
  returning * into run_row;

  return run_row;
exception
  when others then
    update public.inventory_reconciliation_runs
    set status = 'failed', finished_at = now(), error_message = sqlerrm
    where id = run_row.id
    returning * into run_row;
    return run_row;
end;
$$;

grant execute on function public.get_inventory_reconciliation_report() to authenticated;
grant execute on function public.run_inventory_reconciliation_check(uuid) to authenticated;
grant execute on function public.repair_product_stock_from_ledger(uuid) to authenticated;
