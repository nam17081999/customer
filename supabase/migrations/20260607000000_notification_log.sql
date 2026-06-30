-- Notification log: persists notifications + read state server-side
-- Giúp thông báo không bị mất khi đổi thiết bị / đăng nhập lại

create table if not exists public.notification_log (
  id text primary key,
  user_id uuid not null references auth.users(id) default auth.uid(),
  type text not null,
  title text not null,
  detail text not null,
  created_at timestamptz not null default now(),
  read boolean not null default false
);

-- Index for fast user query
create index if not exists idx_notification_log_user
  on public.notification_log (user_id, created_at desc);

-- RLS: user chỉ thấy + sửa notification của chính mình
alter table public.notification_log enable row level security;

drop policy if exists "notification_log_select" on public.notification_log;
create policy "notification_log_select" on public.notification_log
  for select using (auth.uid() = user_id);

drop policy if exists "notification_log_insert" on public.notification_log;
create policy "notification_log_insert" on public.notification_log
  for insert with check (auth.uid() = user_id);

drop policy if exists "notification_log_update" on public.notification_log;
create policy "notification_log_update" on public.notification_log
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "notification_log_delete" on public.notification_log;
create policy "notification_log_delete" on public.notification_log
  for delete using (auth.uid() = user_id);
