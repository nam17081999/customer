alter table public.sales_orders
  add column is_printed boolean not null default false;
