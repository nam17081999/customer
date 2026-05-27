# Production Checklist — NPP Hà Công ERP

## Pre-deploy
- Confirm env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, service/admin secrets only on server tooling.
- Apply migrations in order: `20260525000000_harden_order_inventory_mutations.sql`, `20260525010000_inventory_accounting_reconciliation.sql`, `20260526000000_reporting_aggregate_rpcs.sql`, `20260526010000_global_search_rpc.sql`.
- Run `npm run test`, `npm run lint`, `npm run build`, `npm run test:e2e`.
- Open `/admin/operations`; run reconciliation check; confirm mismatch count is zero or explicitly accepted.

## Data safety
- Export product, order, purchase, stock ledger data before repair/import.
- Never repair stock when orphan movements or negative replay warnings are unresolved.
- Do not recompute historical sales profit snapshots during inventory repair.

## Operator readiness
- Smoke: create/cancel sales order, create/cancel purchase, stock adjustment, reports export, command search.
- Mobile smoke: `/orders/new`, `/inventory/stock`, `/inventory/products/import` at 390px width.
- Verify duplicate-submit guards with rapid submit clicks on order and purchase forms.

## Go-live gate
- No failing reconciliation runs.
- No dashboard/report RPC errors.
- No known inventory drift affecting active products.
- Rollback plan reviewed by owner/operator.
