-- Add store edit history (diff logs) - admin only
-- Date: 2026-04-20
--
-- Prerequisites:
-- - Run `docs/sql/2026-04-06-auth-roles-and-rls.sql` first (provides `public.is_admin_user()`).
--
-- IMPORTANT:
-- - This file assumes `public.stores.id` is UUID (common Supabase default).
-- - If your environment uses BIGINT for `stores.id`, change `store_id uuid` below to `store_id bigint`
--   (and update the FK accordingly) before applying.

create table if not exists public.store_edit_history (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  action_type text not null,
  actor_user_id uuid null references auth.users(id) on delete set null,
  actor_role text not null default 'admin',
  changes jsonb not null,
  created_at timestamptz not null default now(),
  constraint store_edit_history_changes_is_object check (jsonb_typeof(changes) = 'object')
);

create index if not exists idx_store_edit_history_store_id_created_at_desc
  on public.store_edit_history (store_id, created_at desc);

alter table public.store_edit_history enable row level security;

-- Admin-only read
drop policy if exists "store_edit_history_select_admin" on public.store_edit_history;
create policy "store_edit_history_select_admin"
  on public.store_edit_history
  for select
  to authenticated
  using (public.is_admin_user());

-- Admin-only write
drop policy if exists "store_edit_history_insert_admin" on public.store_edit_history;
create policy "store_edit_history_insert_admin"
  on public.store_edit_history
  for insert
  to authenticated
  with check (public.is_admin_user());

