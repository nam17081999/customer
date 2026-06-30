# Deployment Guide — NPP Hà Công ERP

## Build
1. Install: `npm ci`.
2. Verify: `npm run test && npm run lint && npm run build`.
3. E2E smoke: `npm run test:e2e`.

## Database migration order
0. `supabase/migrations/20260518000000_reconcile_remote_sales_order_code.sql`
1. `supabase/migrations/20260525000000_harden_order_inventory_mutations.sql`
2. `supabase/migrations/20260525010000_inventory_accounting_reconciliation.sql`
3. `supabase/migrations/20260526000000_reporting_aggregate_rpcs.sql`
4. `supabase/migrations/20260526010000_global_search_rpc.sql`
5. `supabase/migrations/20260526020000_import_audit_operations.sql`
6. `supabase/migrations/20260527000000_restore_cancel_order_rpcs.sql`

## Phase 10 staging result
- Linked staging migration history is reconciled and up to date through `20260527000000`.
- Final dry-run expected output: `Remote database is up to date.`
- If another remote-only migration appears, stop and inspect catalog/history before running `supabase db push`.

## Phase 12 certification gate
- Production deploy should wait for non-skipped staging integration certification with `STAGING_ADMIN_ACCESS_TOKEN`.
- Current local environment lacks that token; certification intentionally fails fast instead of skipping real write/concurrency tests.

## Release steps
1. Backup database or export operational tables.
2. Apply migrations to staging; run reconciliation check.
3. Deploy web app with production env vars.
4. Open `/admin/operations`; verify dashboard aggregates, reconciliation history, warning center.
5. Run operator smoke: order, purchase, report export, command search, import preview.

## Rollback
- Roll back web release first if UI-only issue.
- For DB issues, stop dangerous operations, export current stock ledger, restore from backup if corruption is confirmed.
- Never run repair repeatedly without comparing reconciliation snapshots.
