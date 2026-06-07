-- Enable Realtime for notification-related tables
-- This allows Postgres Changes subscriptions to detect INSERT/UPDATE/DELETE

-- Add tables to the supabase_realtime publication
alter publication supabase_realtime add table public.stores;
alter publication supabase_realtime add table public.store_reports;
alter publication supabase_realtime add table public.product_stock;

-- Set replica identity to full so old/new data is available
alter table public.stores replica identity full;
alter table public.store_reports replica identity full;
alter table public.product_stock replica identity full;
