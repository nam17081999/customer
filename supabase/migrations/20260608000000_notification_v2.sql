-- Notification v2: shared feed + per-user prefs + per-user reads
-- 1. notification_feed: 1 event = 1 row (ko gắn user)
-- 2. notification_feed_reads: per-user read tracking
-- 3. notification_preferences: per-user toggle

-- ════════════════════════════════════════════════
-- NOTIFICATION_FEED — shared feed
-- ════════════════════════════════════════════════
create table if not exists public.notification_feed (
  id          text primary key,
  type        text not null,          -- low-stock | report | store-verify
  title       text not null,
  detail      text not null,
  data        jsonb,                  -- payload gốc, dùng cho toast display
  created_at  timestamptz not null default now()
);

create index if not exists idx_notification_feed_time
  on public.notification_feed (created_at desc);

alter table public.notification_feed enable row level security;

-- Everyone authenticated can read feed (filter happens in app)
drop policy if exists "feed_select" on public.notification_feed;
create policy "feed_select" on public.notification_feed
  for select using (auth.role() = 'authenticated');

-- Insert: system-level (via service_role) or trigger
drop policy if exists "feed_insert" on public.notification_feed;
create policy "feed_insert" on public.notification_feed
  for insert with check (auth.role() = 'service_role');

-- ════════════════════════════════════════════════
-- NOTIFICATION_FEED_READS — per-user read state
-- ════════════════════════════════════════════════
create table if not exists public.notification_feed_reads (
  feed_id   text not null references public.notification_feed(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  read_at   timestamptz not null default now(),
  primary key (feed_id, user_id)
);

create index if not exists idx_feed_reads_user
  on public.notification_feed_reads (user_id, read_at desc);

alter table public.notification_feed_reads enable row level security;

-- User only sees own read marks
drop policy if exists "reads_select" on public.notification_feed_reads;
create policy "reads_select" on public.notification_feed_reads
  for select using (auth.uid() = user_id);

drop policy if exists "reads_insert" on public.notification_feed_reads;
create policy "reads_insert" on public.notification_feed_reads
  for insert with check (auth.uid() = user_id);

drop policy if exists "reads_update" on public.notification_feed_reads;
create policy "reads_update" on public.notification_feed_reads
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ════════════════════════════════════════════════
-- NOTIFICATION_PREFERENCES — per-user toggle
-- ════════════════════════════════════════════════
create table if not exists public.notification_preferences (
  user_id    uuid not null references auth.users(id) on delete cascade,
  type       text not null,           -- low-stock | report | store-verify
  enabled    boolean not null default true,
  primary key (user_id, type)
);

alter table public.notification_preferences enable row level security;

drop policy if exists "prefs_select" on public.notification_preferences;
create policy "prefs_select" on public.notification_preferences
  for select using (auth.uid() = user_id);

drop policy if exists "prefs_upsert" on public.notification_preferences;
create policy "prefs_upsert" on public.notification_preferences
  for insert with check (auth.uid() = user_id);
-- also allow update own
drop policy if exists "prefs_update" on public.notification_preferences;
create policy "prefs_update" on public.notification_preferences
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ════════════════════════════════════════════════
-- MIGRATE DATA: notification_log → feed + reads
-- ════════════════════════════════════════════════
do $$
declare
  r record;
begin
  -- Insert each notification_log row into feed + reads
  for r in select * from public.notification_log loop
    -- Insert into feed (skip duplicate id)
    insert into public.notification_feed (id, type, title, detail, created_at)
    values (r.id, r.type, r.title, r.detail, r.created_at)
    on conflict (id) do nothing;

    -- Insert read mark if already read
    if r.read then
      insert into public.notification_feed_reads (feed_id, user_id, read_at)
      values (r.id, r.user_id, coalesce(r.created_at, now()))
      on conflict (feed_id, user_id) do nothing;
    end if;
  end loop;
end $$;

-- Seed notification_preferences for all existing users
-- (default all enabled)
insert into public.notification_preferences (user_id, type, enabled)
select distinct user_id, 'low-stock', true from public.notification_log
on conflict (user_id, type) do nothing;

insert into public.notification_preferences (user_id, type, enabled)
select distinct user_id, 'report', true from public.notification_log
on conflict (user_id, type) do nothing;

insert into public.notification_preferences (user_id, type, enabled)
select distinct user_id, 'store-verify', true from public.notification_log
on conflict (user_id, type) do nothing;

-- Also seed for users who never got a notification but exist in auth.users
-- (only runs if auth.users accessible, which depends on supabase setup)
-- done via RPC instead to be safe
end $$;

-- ════════════════════════════════════════════════
-- HELPER RPC: insert into feed (for server-side calls)
-- ════════════════════════════════════════════════
create or replace function public.insert_notification(
  p_id        text,
  p_type      text,
  p_title     text,
  p_detail    text,
  p_data      jsonb default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notification_feed (id, type, title, detail, data, created_at)
  values (p_id, p_type, p_title, p_detail, p_data, now())
  on conflict (id) do nothing;
end;
$$;

-- ════════════════════════════════════════════════
-- HELPER RPC: get my feed with read state
-- ════════════════════════════════════════════════
create or replace function public.get_notification_feed(
  p_limit int default 50,
  p_offset int default 0
) returns table (
  id          text,
  type        text,
  title       text,
  detail      text,
  data        jsonb,
  created_at  timestamptz,
  is_read     boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    select
      f.id,
      f.type,
      f.title,
      f.detail,
      f.data,
      f.created_at,
      (r.feed_id is not null) as is_read
    from public.notification_feed f
    left join public.notification_feed_reads r
      on r.feed_id = f.id
      and r.user_id = auth.uid()
    where exists (
      select 1 from public.notification_preferences p
      where p.user_id = auth.uid()
        and p.type = f.type
        and p.enabled = true
    )
    order by f.created_at desc
    limit p_limit
    offset p_offset;
end;
$$;

-- ════════════════════════════════════════════════
-- HELPER RPC: mark feed as read
-- ════════════════════════════════════════════════
create or replace function public.mark_feed_read(
  p_feed_id text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notification_feed_reads (feed_id, user_id, read_at)
  values (p_feed_id, auth.uid(), now())
  on conflict (feed_id, user_id) do update
    set read_at = now();
end;
$$;

-- ════════════════════════════════════════════════
-- HELPER RPC: mark all as read
-- ════════════════════════════════════════════════
create or replace function public.mark_all_feed_read(
  p_type text default null  -- null = all types
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notification_feed_reads (feed_id, user_id, read_at)
  select f.id, auth.uid(), now()
  from public.notification_feed f
  where (p_type is null or f.type = p_type)
    and not exists (
      select 1 from public.notification_feed_reads r
      where r.feed_id = f.id and r.user_id = auth.uid()
    )
  on conflict (feed_id, user_id) do nothing;
end;
$$;

-- ════════════════════════════════════════════════
-- HELPER RPC: get unread count by type
-- ════════════════════════════════════════════════
create or replace function public.get_unread_notification_counts()
returns table (
  type      text,
  cnt       bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    select
      f.type,
      count(*)::bigint as cnt
    from public.notification_feed f
    left join public.notification_feed_reads r
      on r.feed_id = f.id and r.user_id = auth.uid()
    join public.notification_preferences p
      on p.user_id = auth.uid()
      and p.type = f.type
      and p.enabled = true
    where r.feed_id is null  -- not read
    group by f.type;
end;
$$;

-- ════════════════════════════════════════════════
-- HELPER RPC: get/set preferences
-- ════════════════════════════════════════════════
create or replace function public.get_notification_preferences()
returns table (
  type      text,
  enabled   boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    select p.type, p.enabled
    from public.notification_preferences p
    where p.user_id = auth.uid();
end;
$$;

create or replace function public.set_notification_preference(
  p_type    text,
  p_enabled boolean
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notification_preferences (user_id, type, enabled)
  values (auth.uid(), p_type, p_enabled)
  on conflict (user_id, type) do update
    set enabled = p_enabled;
end;
$$;
