-- Fix RLS for vehicle_fuel_logs: set created_by via trigger

drop policy if exists "vehicle_fuel_logs_insert_own" on public.vehicle_fuel_logs;
create policy "vehicle_fuel_logs_insert_own" on public.vehicle_fuel_logs
  for insert with check (auth.role() = 'authenticated');

-- Trigger to set created_by to the current user
create or replace function public.set_vehicle_fuel_log_created_by()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.created_by = auth.uid();
  return new;
end;
$$;

drop trigger if exists trg_vehicle_fuel_logs_set_created_by on public.vehicle_fuel_logs;
create trigger trg_vehicle_fuel_logs_set_created_by
  before insert on public.vehicle_fuel_logs
  for each row
  when (new.created_by is null)
  execute function public.set_vehicle_fuel_log_created_by();
