-- NPP Hà Công cache versioning migration
-- Goal: avoid full-store refetch on every check while keeping cache freshness.

create table if not exists public.store_cache_versions (
  cache_key text primary key,
  version bigint not null default 0,
  updated_at timestamptz not null default now()
);

insert into public.store_cache_versions (cache_key, version)
values ('stores', 0)
on conflict (cache_key) do nothing;

create or replace function public.bump_stores_cache_version()
returns trigger
language plpgsql
security definer
as $$
begin
  update public.store_cache_versions
  set version = version + 1,
      updated_at = now()
  where cache_key = 'stores';

  if not found then
    insert into public.store_cache_versions (cache_key, version, updated_at)
    values ('stores', 1, now())
    on conflict (cache_key)
    do update set version = public.store_cache_versions.version + 1,
                  updated_at = now();
  end if;

  return null;
end;
$$;

drop trigger if exists trg_stores_bump_cache_version on public.stores;

create trigger trg_stores_bump_cache_version
after insert or update or delete on public.stores
for each statement
execute function public.bump_stores_cache_version();

grant select on public.store_cache_versions to anon, authenticated;
