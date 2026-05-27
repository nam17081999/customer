# Staging Validation Notes — Phase 10

## Supabase status checked
- `supabase migration list --linked` connects to the remote project.
- Remote has `20260512000000` and remote-only `20260518000000`.
- Local has pending ERP hardening migrations: `20260525000000`, `20260525010000`, `20260526000000`, `20260526010000`, `20260526020000`.

## Resolution applied
- Added local reconciliation migration `supabase/migrations/20260518000000_reconcile_remote_sales_order_code.sql` based on live catalog inspection.
- `supabase db push --dry-run` then showed only pending Phase 2-9 migrations.
- Applied pending migrations to linked staging: `20260525000000`, `20260525010000`, `20260526000000`, `20260526010000`, `20260526020000`.
- Live verification found cancel RPCs missing on staging; added and applied `20260527000000_restore_cancel_order_rpcs.sql`.
- Final `supabase db push --dry-run` reports remote DB is up to date.

## Staging smoke run
1. Migration list is consistent through `20260527000000`.
2. Runtime catalog confirms aggregate, reconciliation, search, import/audit, and cancel RPCs exist.
3. RLS is enabled on ERP safety tables including `products`, `sales_orders`, `purchase_orders`, `stock_movements`, `inventory_reconciliation_runs`, `operation_audit_events`.
4. Indexes exist for client request id, audit request id, product/store search.
5. Read RPC smoke passed:
   - `select public.global_operator_search('test', 5);`
   - `select public.get_inventory_reconciliation_report();`
   - `select public.get_sales_summary(null, null);`
6. Import write RPC permission smoke as CLI login returned `Admin permission required`, confirming admin guard. Full browser write still requires staging admin credentials.

## Safety notes
- Never run import write flow on production data without a request id and CSV backup.
- Never run stock repair before reconciliation mismatch/orphan/negative-stock review.
- Historical sales cost/profit snapshots must remain immutable.

## Phase 11 integration QA
- Local contract suite includes staging-gated integration tests in `__tests__/integration/stagingInventory.integration.test.js`.
- Run real integration only with an admin JWT/session:
  - `RUN_STAGING_INTEGRATION=1 STAGING_SUPABASE_URL=... STAGING_SUPABASE_ANON_KEY=... STAGING_ADMIN_ACCESS_TOKEN=... npm run test -- __tests__/integration/stagingInventory.integration.test.js`
- Covered live when enabled: aggregate/search/reconciliation RPC contracts, product import idempotency, audit event persistence, duplicate SKU/concurrent import guard, cleanup via soft delete.
- Without `STAGING_ADMIN_ACCESS_TOKEN`, tests skip real writes and only verify the integration gate.
- Phase 11 dry-run result: `supabase db push --dry-run` reports remote database is up to date.

## Phase 12 certification status
- Certification command was executed with `.env` loaded and `RUN_STAGING_CERTIFICATION=1 RUN_STAGING_INTEGRATION=1`.
- Result: fail-fast blocker, because `STAGING_ADMIN_ACCESS_TOKEN` is not present in this shell.
- This is expected and safer than silently skipping write/concurrency tests.
- Migration state remains clean: `supabase db push --dry-run` reports remote database is up to date.
- Local regression remains green: Vitest, lint, build, Playwright smoke, and diff checks passed.

## Phase 12 unlock command
```bash
set -a
source .env
set +a
RUN_STAGING_CERTIFICATION=1 \
RUN_STAGING_INTEGRATION=1 \
STAGING_SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL" \
STAGING_SUPABASE_ANON_KEY="$NEXT_PUBLIC_SUPABASE_ANON_KEY" \
STAGING_ADMIN_ACCESS_TOKEN="<admin-user-jwt>" \
npm run test -- __tests__/integration/stagingInventory.integration.test.js
```

Certification can only be marked passed after the command above runs without skipped live tests and the admin JWT is from a real staging admin user.
