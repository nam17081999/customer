begin;

create table if not exists public.routes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  wards text[] not null default '{}',
  call_days text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint routes_name_not_blank check (char_length(trim(name)) > 0),
  constraint routes_wards_not_empty check (coalesce(array_length(wards, 1), 0) > 0),
  constraint routes_call_days_not_empty check (coalesce(array_length(call_days, 1), 0) > 0),
  constraint routes_call_days_valid check (
    call_days <@ array['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']::text[]
  )
);

alter table public.stores
  add column if not exists route_id uuid null references public.routes(id) on delete set null;

create index if not exists idx_routes_name on public.routes(name);
create index if not exists idx_stores_route_id on public.stores(route_id) where deleted_at is null;

create or replace function public.set_updated_at_routes()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_routes_set_updated_at on public.routes;
create trigger trg_routes_set_updated_at
before update on public.routes
for each row
execute function public.set_updated_at_routes();

alter table if exists public.routes enable row level security;

drop policy if exists routes_select_staff on public.routes;
drop policy if exists routes_insert_admin on public.routes;
drop policy if exists routes_update_admin on public.routes;
drop policy if exists routes_delete_admin on public.routes;

create policy routes_select_staff
on public.routes
for select
to authenticated
using (public.is_staff_user());

create policy routes_insert_admin
on public.routes
for insert
to authenticated
with check (public.is_admin_user());

create policy routes_update_admin
on public.routes
for update
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

create policy routes_delete_admin
on public.routes
for delete
to authenticated
using (public.is_admin_user());

commit;
