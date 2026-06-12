-- Add retail_price and wholesale_price columns to products and product_units
-- Keep existing default_sale_price / default_purchase_price for backward compatibility

-- ============================================================
-- products: add list price columns
-- ============================================================
alter table public.products
  add column if not exists retail_price decimal(12, 2) not null default 0;

alter table public.products
  add column if not exists wholesale_price decimal(12, 2) not null default 0;

-- ============================================================
-- product_units: add unit-level list price columns
-- ============================================================
alter table public.product_units
  add column if not exists unit_retail_price decimal(12, 2) not null default 0;

alter table public.product_units
  add column if not exists unit_wholesale_price decimal(12, 2) not null default 0;

-- ============================================================
-- Constraints: ensure non-negative prices
-- ============================================================
alter table public.products
  add constraint products_retail_price_nonnegative check (retail_price >= 0);

alter table public.products
  add constraint products_wholesale_price_nonnegative check (wholesale_price >= 0);

alter table public.product_units
  add constraint product_units_retail_price_nonnegative check (unit_retail_price >= 0);

alter table public.product_units
  add constraint product_units_wholesale_price_nonnegative check (unit_wholesale_price >= 0);
