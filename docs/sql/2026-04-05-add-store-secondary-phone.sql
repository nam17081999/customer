-- Add optional secondary phone number for stores.
alter table public.stores
  add column if not exists phone_secondary text null;

comment on column public.stores.phone_secondary is 'So dien thoai thu 2 cua cua hang (optional)';
