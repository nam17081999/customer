-- Role + RLS hardening for authentication and authorization.
-- Apply once per Supabase environment (SQL editor).

begin;

-- 1) Normalize role labels from JWT app_metadata.
create or replace function public.normalize_app_role(input_role text)
returns text
language sql
immutable
as $$
  select case lower(trim(coalesce(input_role, '')))
    when 'admin' then 'admin'
    when 'administrator' then 'admin'
    when 'super_admin' then 'admin'
    when 'superadmin' then 'admin'
    when 'telesale' then 'telesale'
    when 'tele_sale' then 'telesale'
    when 'tele-sale' then 'telesale'
    when 'sales' then 'telesale'
    when 'sale' then 'telesale'
    else ''
  end;
$$;

-- 2) Trusted role from app_metadata only.
create or replace function public.app_user_role()
returns text
language plpgsql
stable
as $$
declare
  claims jsonb := coalesce(auth.jwt(), '{}'::jsonb);
  normalized text;
  role_item text;
begin
  normalized := public.normalize_app_role(coalesce(
    claims #>> '{app_metadata,role}',
    claims #>> '{app_metadata,user_role}',
    ''
  ));
  if normalized <> '' then
    return normalized;
  end if;

  if jsonb_typeof(claims #> '{app_metadata,roles}') = 'array' then
    for role_item in
      select jsonb_array_elements_text(claims #> '{app_metadata,roles}')
    loop
      normalized := public.normalize_app_role(role_item);
      if normalized <> '' then
        return normalized;
      end if;
    end loop;
  end if;

  if lower(trim(coalesce(
    claims #>> '{app_metadata,is_admin}',
    claims #>> '{app_metadata,admin}',
    ''
  ))) in ('true', '1', 'yes') then
    return 'admin';
  end if;

  return 'guest';
end;
$$;

create or replace function public.is_admin_user()
returns boolean
language sql
stable
as $$
  select public.app_user_role() = 'admin';
$$;

create or replace function public.is_telesale_user()
returns boolean
language sql
stable
as $$
  select public.app_user_role() = 'telesale';
$$;

create or replace function public.is_staff_user()
returns boolean
language sql
stable
as $$
  select public.app_user_role() in ('admin', 'telesale');
$$;

-- 3) Optional helper for admin to assign role in app_metadata.
create or replace function public.set_auth_user_role(target_user_id uuid, target_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized text := public.normalize_app_role(target_role);
begin
  if auth.role() <> 'service_role' and not public.is_admin_user() then
    raise exception 'permission denied: only admin can set roles';
  end if;

  if normalized not in ('admin', 'telesale') then
    raise exception 'invalid role %, only admin/telesale are allowed', target_role;
  end if;

  update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', normalized),
      updated_at = now()
  where id = target_user_id;

  if not found then
    raise exception 'user % not found', target_user_id;
  end if;
end;
$$;

revoke all on function public.set_auth_user_role(uuid, text) from public;
grant execute on function public.set_auth_user_role(uuid, text) to authenticated;
grant execute on function public.set_auth_user_role(uuid, text) to service_role;

-- 4) Enable and rebuild RLS policies for stores.
alter table if exists public.stores enable row level security;

drop policy if exists stores_select_public on public.stores;
drop policy if exists stores_insert_public_pending on public.stores;
drop policy if exists stores_update_admin on public.stores;
drop policy if exists stores_update_telesale on public.stores;

create policy stores_select_public
on public.stores
for select
to anon, authenticated
using (deleted_at is null);

create policy stores_insert_public_pending
on public.stores
for insert
to anon, authenticated
with check (
  deleted_at is null
  and (
    public.is_admin_user()
    or (
      active = false
      and (
        public.is_telesale_user()
        or coalesce(is_potential, false) = false
      )
    )
  )
);

create policy stores_update_admin
on public.stores
for update
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

create policy stores_update_telesale
on public.stores
for update
to authenticated
using (public.is_telesale_user() and deleted_at is null)
with check (public.is_telesale_user() and deleted_at is null);

-- Prevent telesale from changing non-telesale columns.
create or replace function public.enforce_telesale_store_update_columns()
returns trigger
language plpgsql
as $$
begin
  if not public.is_telesale_user() then
    return new;
  end if;

  if
    new.name is distinct from old.name or
    new.store_type is distinct from old.store_type or
    new.address_detail is distinct from old.address_detail or
    new.ward is distinct from old.ward or
    new.district is distinct from old.district or
    new.phone is distinct from old.phone or
    new.phone_secondary is distinct from old.phone_secondary or
    new.note is distinct from old.note or
    new.image_url is distinct from old.image_url or
    new.latitude is distinct from old.latitude or
    new.longitude is distinct from old.longitude or
    new.active is distinct from old.active or
    new.deleted_at is distinct from old.deleted_at or
    new.created_at is distinct from old.created_at
  then
    raise exception 'permission denied: telesale can only update telesale fields';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_telesale_store_update_columns on public.stores;
create trigger trg_enforce_telesale_store_update_columns
before update on public.stores
for each row
execute function public.enforce_telesale_store_update_columns();

-- 5) Enable and rebuild RLS policies for store_reports.
alter table if exists public.store_reports enable row level security;

drop policy if exists store_reports_insert_public on public.store_reports;
drop policy if exists store_reports_select_admin on public.store_reports;
drop policy if exists store_reports_update_admin on public.store_reports;

create policy store_reports_insert_public
on public.store_reports
for insert
to anon, authenticated
with check (
  coalesce(status, 'pending') = 'pending'
  and (reporter_id is null or reporter_id = auth.uid())
  and (
    (report_type = 'edit' and proposed_changes is not null)
    or
    (report_type = 'reason_only' and reason_codes is not null and coalesce(array_length(reason_codes, 1), 0) > 0)
  )
);

create policy store_reports_select_admin
on public.store_reports
for select
to authenticated
using (public.is_admin_user());

create policy store_reports_update_admin
on public.store_reports
for update
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

commit;
