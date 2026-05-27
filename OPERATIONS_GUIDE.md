# Operations Guide — NPP Hà Công ERP

## Daily checks
- Open `/admin/operations`.
- Review inventory warnings, failed reconciliation runs, dashboard aggregate health.
- Run reconciliation check after heavy purchase/sales batches.

## Import workflow
- Use `/inventory/products/import` for CSV preview.
- Fix all validation errors and duplicate SKU warnings before real import processing.
- Confirm import only as admin; each write uses a unique request id and writes an audit event.
- Keep CSV exports as rollback evidence for product/stock import windows.

## Repair workflow
- Prefer dry-run/preview from reconciliation tools.
- Export backup before repair.
- Repair only when the operator understands affected products and valuation impact.
- Historical sales cost/profit snapshots remain immutable.

## Staging verification workflow
- Run `supabase migration list --linked` and confirm local/remote versions match.
- Run `supabase db push --dry-run`; continue only when it says remote is up to date or lists expected pending migrations.
- Verify cancel RPCs exist before go-live: `cancel_sales_order_and_restore_stock`, `cancel_purchase_order_and_remove_stock`.
- Verify import admin guard with a non-admin context; expected failure is `Admin permission required`.
- For Phase 12 certification, do not accept skipped staging tests. Provide a real staging admin JWT as `STAGING_ADMIN_ACCESS_TOKEN` and run the command in `STAGING_VALIDATION.md`.

## Incident response
- If order mutation times out, check duplicate client request ID behavior before manually recreating the order.
- If stock drift appears, stop related product mutations, run reconciliation, inspect movement ledger, then repair with backup.
- If dashboard/report totals look stale, compare aggregate RPC output with stock ledger reports.

## Operator-safe errors
- Operator UI should show Vietnamese messages only; raw SQL/Postgres/Supabase errors belong in structured logs.
- Common mapped messages: tồn kho không đủ, mã/SKU trùng, dữ liệu không hợp lệ, không có quyền, kết nối không ổn định.
- If an operator reports an English/SQL error string, treat it as a production bug and add a mapping in `helper/operatorErrors.js`.

## Known limits
- CSV import page is preview/validation-first; final DB write should run through server-side validated RPC.
- Inventory repair must remain admin-only and backup-gated.
