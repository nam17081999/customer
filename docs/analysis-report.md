# Báo Cáo Phân Tích Tổng Quan — NPP Hà Công

> Tạo ngày: 2026-06-12
> Phân tích dựa trên codebase tại `~/Desktop/customer`

---

## 1. Cấu Trúc Tổng Thể

### Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (Pages Router, Turbopack) | ^15.5.18 |
| UI | React | 19.1.0 |
| Styling | TailwindCSS v4 (`@import "tailwindcss"`) | ^4.3.0 |
| DB + Auth | Supabase (PostgreSQL) | ^2.105.4 |
| Public Map | MapLibre GL + OpenStreetMap | ^4.7.1 |
| Location Picker | Google Maps API | ^2.x |
| Virtual List | react-virtuoso | ^4.18.6 |
| UI Primitives | Radix UI (Dialog, Slot) | ^1.x |
| Icons | lucide-react | ^0.539 |
| Testing | Vitest + Playwright | ^4.1.5 / ^1.59.1 |
| Package Manager | pnpm | — |
| Node | — | 24.x |

> **Lưu ý:** README.md vẫn ghi "Leaflet + React-Leaflet" (lỗi thời).

### Routing (Pages Router — 43 pages)

| Route | Access | Description |
|---|---|---|
| `/` | Public | Store search + filters |
| `/map` | Public | MapLibre map |
| `/login` | Public | Login |
| `/store/create` | Public | Create store (3-step wizard) |
| `/store/edit/[id]?mode=supplement` | Public+Auth | Supplement/edit store |
| `/store/import` | Admin | CSV import |
| `/store/export` | Admin | CSV/VCF export |
| `/store/verify` | Admin | Verify pending stores |
| `/store/reports` | Admin | Review reports |
| `/telesale/overview` | Telesale+Admin | Call queue |
| `/telesale/call/[id]` | Telesale+Admin | Call result update |
| `/account` | Telesale+Admin | Dashboard |
| `/inventory/products/**` | Admin | Products CRUD |
| `/inventory/purchases/**` | Admin | Purchase orders |
| `/inventory/stock` | Admin | Stock dashboard |
| `/inventory/reports` | Admin | Inventory reports |
| `/orders/**` | Admin | Sales orders |
| `/admin/operations` | Admin | Ops center |
| `/admin/users` | Admin | User management |

### Cấu Trúc Thư Mục Chính

```
pages/           → 43 files (page routes + API routes)
components/      → 33 files (UI + feature components)
helper/          → 54 files (business logic + hooks)
lib/             → 13 files (core: storeCache, Auth, supabase)
screens/         → 3 files (page-level logic: map, orders, account)
api/             → 4 files (client wrappers: auth, inventory, notifications, reports)
services/        → 1 file (inventory page service)
features/        → 1 file (auth utils)
data/            → 1 file (old admin area boundaries — legacy)
docs/            → 12 core docs + ~20 skill/SQL/plan files
supabase/        → 13 migrations + seed.sql
__tests__/       → 48 test files (unit)
e2e/             → 9 Playwright specs
scripts/         → Git hooks + mojibake checker
```

### Cache Architecture (3-layer)

```
getOrRefreshStores()
  → 1. In-memory (60s cooldown, promise dedup)
  → 2. IndexedDB (storevis_cache)
  → 3. Supabase (version check via store_cache_versions table)
  → fallback: count + max(updated_at)
```

---

## 2. Tình Trạng Hiện Tại

### File Counts

| Category | Count |
|---|---|
| Total files (excl. node_modules/.git/.next) | 322 |
| JS/JSX source files | 218 |
| CSS files | 1 (`app/globals.css`) |
| SQL files | 20 |
| Test files (unit) | 48 |
| Test files (E2E) | 9 |
| Supabase migrations | 13 |
| Git commits | 324 |

### Lines of Code (core source)

```
~23,110 lines total (pages + components + lib + helper + api + services)
```

### Test Coverage

```
Test Files  43 passed | 5 failed (48 total)
Tests       475 passed | 4 failed | 3 skipped (482 total)
Duration    ~1.6s
```

**Coverage report:** chưa chạy được (failed tests block full suite). Cần fix test trước.

### E2E Tests (9 specs)
- `store-create`, `store-edit`, `store-import`, `store-map`, `store-map-drag`, `store-report`, `store-search`, `store-verify`, `erp-operator-smoke`

> **Lưu ý:** Chưa có E2E cho inventory/orders flows.

### Lint
```
0 errors, 4 warnings
- 1 unused eslint-disable directive
- 1 <img> instead of next/Image
- 2 react-hooks/exhaustive-deps
```

### Phân tích 5 Test Files Bị Fail

| File | Tests Fail | Root Cause |
|---|---|---|
| `__tests__/helper/homeSearch.test.js` | Module load fail | `supabaseUrl is required` — test không có `.env`; import chain →`storeCache`→`supabaseClient` cần env |
| `__tests__/helper/homeSearchRouteSync.test.js` | Module load fail | Same root cause |
| `__tests__/helper/adminUserManagement.test.js` | 2 assertion failures | Code trong `adminUserManagement.js` có thể đã thay đổi sau khi test viết; mismatch normalized values |
| `__tests__/api/inventoryClient.test.js` | 1 assertion failure | Mock supabase chain không cover `.order()` — `listPurchaseOrders` gọi `.order()` nhưng mock chỉ `.select().in()` |
| `__tests__/services/inventory/inventoryPageService.test.js` | 1 assertion failure | Expected response shape mismatch (thiếu fields) |

---

## 3. Tính Năng Đã Có & Lỗi Tiềm Ẩn

### ✅ Tính Năng Đã Hoàn Thiện

#### Core App
- [x] Store search (accent-insensitive, scoring, filter by district/ward/type/data flags)
- [x] MapLibre map with custom markers, route modal, GPS follow, compass heading
- [x] Store create wizard (3-step + duplicate check + telesale quick-save)
- [x] Store edit / supplement mode (admin direct update / public submits report)
- [x] Store reports (edit proposal + reason_only, admin review flow)
- [x] Store CSV import (preview, duplicates resolution, bulk insert)
- [x] Store CSV/VCF export
- [x] Store verify (admin approves pending stores)
- [x] Telesale call queue (priority-ordered, call result capture)
- [x] Account dashboard for telesale/admin
- [x] Admin user management
- [x] 3-layer cache (memory → IDB → Supabase) with version sync

#### Order/Inventory MVP (May-June 2026)
- [x] Products CRUD + product units with conversion
- [x] Purchase orders (nhập kho) with auto stock update
- [x] Sales orders (xuất kho) with auto stock deduction + profit calculation
- [x] Stock dashboard with low-stock warnings
- [x] Stock movements ledger (sổ cái kho)
- [x] Stock adjustments
- [x] Inventory reconciliation tools
- [x] Inventory reports (aggregate RPCs)
- [x] Admin operations center
- [x] Notifications (real-time via Supabase Realtime + notification_log table)
- [x] Printed flag on orders

### ⚠️ Lỗi & Rủi Ro Tiềm Ẩn

#### Critical
1. **5 test files failing** — chỉ ra code/tests đã lệch pha; có thể có regression không được phát hiện.
2. **homeSearch tests không chạy thiếu .env** — test isolation yếu; `storeCache` import `supabaseClient` trực tiếp chứ không mock ở module level.
3. **adminUserManagement tests fail** — hoặc code thay đổi hoặc test expectation sai; cần rà soát `helper/adminUserManagement.js`.
4. **inventoryClient `listPurchaseOrders` thiếu `.order()`** — sẽ lỗi runtime khi paginate purchase orders (trong test mock cũng thiếu).
5. **inventoryPageService test mismatch** — response shape kỳ vọng khác thực tế; có thể do refactor gần đây.

#### Performance
6. **Không có DB indexes** trên `stores` (đã ghi trong docs khuyến nghị) → query Supabase sẽ chậm khi >10K stores.
7. **Client-side search on full dataset** — load tất cả stores (không pagination) và filter client-side. K >5K stores → memory + render issue.
8. **3-layer cache fragile** — version sync có thể fail silent; nếu `store_cache_versions` table chưa migration, fallback dùng `count + max(updated_at)` có thể không chính xác.

#### Code Quality
9. **Toàn bộ JS, không TypeScript** → refactoring dễ sai, thiếu type safety.
10. **API client là hand-rolled fetch wrappers** — không tận dụng schema generation từ Supabase.
11. **54 helper files** → nhiều file, một số có thể đã outdated hoặc duplicate logic.
12. **`pages/api/reverse-geocode-area.js`** có fallback chain (Geoapify → OpenMap → Goong) nhưng test log vẫn ghi lỗi stderr mỗi fallback — noisy nhưng functional.
13. **README sai tech stack** (Leaflet thay vì MapLibre).

#### Security
14. **RLS migrations tồn tại** (`docs/sql/2026-04-06-auth-roles-and-rls.sql`) nhưng không rõ đã apply lên prod hay chưa.
15. **Google Maps API key** dùng client-side → exposed ở browser.

#### Missing
16. **Chưa có E2E cho inventory/orders** — chỉ có store CRUD E2E.
17. **Chưa có CI/CD pipeline** — không có GitHub Actions/workflows trong repo.
18. **Không có accessibility tests** — dù design docs yêu cầu contrast cao, font lớn cho người mắt kém.
19. **`/store/deduplicate.js`** page tồn tại nhưng không rõ đang được dùng hay legacy.

---

## 4. Gợi Ý Ưu Tiên Phát Triển Sắp Tới

### Priority 1: 🔴 Fix Ngay (1-2 ngày)

| Task | Lý do | File ảnh hưởng |
|---|---|---|
| **Fix 4 test failures** | Test đang fail → không tin tưởng được test suite. Ưu tiên cao nhất. | `adminUserManagement.js`, `inventory-client.js`, `inventoryPageService.js`, test files |
| **Fix homeSearch test env isolation** | Mock supabaseClient ở module level để test không phụ thuộc .env | `vitest.config.js`, `storeCache.js` test setup |
| **Áp DB indexes** | Performance sẽ degrade khi data lớn | Supabase migration mới |

### Priority 2: 🟡 Ổn Định Inventory/Orders MVP (3-5 ngày)

| Task | Lý do |
|---|---|
| **Add E2E tests** cho inventory flows (products, PO, SO, stock) | Hiện không có E2E coverage cho module mới nhất |
| **Review notification system** | Vừa thêm realtime notifications (3 migrations trong 1 tuần); có thể còn edge cases |
| **Polish admin operations dashboard** | Mới, cần review error handling, loading states, mobile layout |
| **Add pagination cho inventory lists** (PO list, SO list) | ListPurchaseOrders đã có page param nhưng mock chưa cover |

### Priority 3: 🟢 Cải Thiện Core (1-2 tuần)

| Task | Lý do |
|---|---|
| **Add pagination/server-side search** cho store list | Client-side full load không scale; cần Supabase query với `range()` + full-text search |
| **Clean up 54 helper files** | Review + consolidate duplicate logic; tách hooks vào `hooks/` riêng |
| **Update README + IMPROVEMENTS.md** | Sai tech stack (Leaflet), thiếu inventory/orders docs |
| **Add CI/CD** (GitHub Actions) | Chạy test + lint + build tự động trên mỗi PR |

### Priority 4: 🔵 Dài Hạn (1-3 tháng)

| Task | Lý do |
|---|---|
| **TypeScript migration** | Codebase 218 JS files; migrate dần theo module giúp giảm bug |
| **Payment tracking** (beyond MVP) | Inventory MVP không có payment/công nợ; cần khi triển khai thực tế |
| **Store analytics & reporting dashboard** | Biểu đồ doanh số theo store/vùng |
| **Data export API** | API endpoints cho third-party integrations |
| **Accessibility audit** | Đảm bảo đúng chuẩn cho user mắt kém |

### Tổng Quan Ưu Tiên Theo Impact

```
Impact
  ↑
  │  [Fix tests] [DB indexes]     [TypeScript]
  │     🔴                            🔵
  │     └───── [E2E inventory] ───────┘
  │              🟡
  │     └──────── [CI/CD] ────────────┘
  │              🟢
  │     └── [Search pagination] ──────┘
  │              🟢
  └──────────────────────────────────────→ Effort
```

---

## Tóm Tắt Cho User

1. **Dự án đang active phát triển** — 324 commits, module inventory/orders MVP vừa hoàn thành (13 migrations trong tháng 5-6/2026).
2. **Cần fix test ngay** — 5 test files fail (4 actual assertion failures + 1 env config). Không thể tin test suite.
3. **Inventory/Orders module mới** nhưng thiếu E2E tests và có mock không cover hết API calls (`listPurchaseOrders` thiếu `.order()`).
4. **Nên làm tiếp theo:**
   - **Ngay:** Fix tests → apply DB indexes → thêm E2E cho inventory
   - **Tuần này:** Review + stabilize notifications, admin ops dashboard
   - **Tháng này:** Thêm pagination cho store search, cleanup helpers, CI/CD
5. **Không nên** thêm feature mới khi test suite chưa xanh.
