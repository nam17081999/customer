-- NPP Hà Công PRD migration
-- Add minimal telesale fields directly on public.stores

alter table public.stores
  add column if not exists is_potential boolean not null default false,
  add column if not exists last_called_at timestamptz null,
  add column if not exists last_call_result text null,
  add column if not exists last_call_result_at timestamptz null,
  add column if not exists last_order_reported_at timestamptz null,
  add column if not exists sales_note text null;

comment on column public.stores.is_potential is 'Danh dau cua hang tiem nang cho telesale';
comment on column public.stores.last_called_at is 'Thoi diem goi dien gan nhat';
comment on column public.stores.last_call_result is 'Ket qua goi gan nhat: khong_nghe_may, goi_lai_sau, con hang, da_bao_don';
comment on column public.stores.last_call_result_at is 'Thoi diem cap nhat ket qua cuoc goi gan nhat';
comment on column public.stores.last_order_reported_at is 'Thoi diem bao don gan nhat';
comment on column public.stores.sales_note is 'Ghi chu ngan cho telesale';

create index if not exists idx_stores_is_potential
  on public.stores (is_potential)
  where deleted_at is null;

create index if not exists idx_stores_last_called_at
  on public.stores (last_called_at desc)
  where deleted_at is null;

create index if not exists idx_stores_last_call_result_at
  on public.stores (last_call_result_at desc)
  where deleted_at is null;

create index if not exists idx_stores_last_order_reported_at
  on public.stores (last_order_reported_at desc)
  where deleted_at is null;
