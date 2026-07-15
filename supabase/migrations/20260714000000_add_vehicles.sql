-- Vehicles management: danh sách xe giao hàng
create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plate text not null,
  note text,
  active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Fuel logs: ghi nhận số xăng đã đổ cho xe
create table if not exists public.vehicle_fuel_logs (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id),
  created_by uuid not null references auth.users(id),
  fuel_amount numeric(10, 2) not null check (fuel_amount > 0),
  note text,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_vehicles_active
  on public.vehicles (active)
  where active = true;

create index if not exists idx_vehicle_fuel_logs_vehicle
  on public.vehicle_fuel_logs (vehicle_id, recorded_at desc);

create index if not exists idx_vehicle_fuel_logs_created_by
  on public.vehicle_fuel_logs (created_by, recorded_at desc);

-- RLS
alter table public.vehicles enable row level security;
alter table public.vehicle_fuel_logs enable row level security;

-- Vehicles: admin full access, authenticated users can read
drop policy if exists "vehicles_admin_all" on public.vehicles;
create policy "vehicles_admin_all" on public.vehicles
  for all using (is_admin_user());

drop policy if exists "vehicles_authenticated_select" on public.vehicles;
create policy "vehicles_authenticated_select" on public.vehicles
  for select using (auth.role() = 'authenticated');

-- Fuel logs: admin all, users can insert/read own
drop policy if exists "vehicle_fuel_logs_admin_all" on public.vehicle_fuel_logs;
create policy "vehicle_fuel_logs_admin_all" on public.vehicle_fuel_logs
  for all using (is_admin_user());

drop policy if exists "vehicle_fuel_logs_insert_own" on public.vehicle_fuel_logs;
create policy "vehicle_fuel_logs_insert_own" on public.vehicle_fuel_logs
  for insert with check (auth.uid() = created_by);

drop policy if exists "vehicle_fuel_logs_select_own" on public.vehicle_fuel_logs;
create policy "vehicle_fuel_logs_select_own" on public.vehicle_fuel_logs
  for select using (auth.uid() = created_by);
