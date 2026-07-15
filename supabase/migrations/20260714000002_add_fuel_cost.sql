-- Add fuel_cost column to vehicle_fuel_logs
alter table public.vehicle_fuel_logs
  add column fuel_cost numeric(12, 0) check (fuel_cost >= 0);
