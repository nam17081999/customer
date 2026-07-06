# Current Work

## Goal
Chuyển toàn bộ external CSS của màn danh sách cửa hàng sang Tailwind utility classes.

## Task Type
Refactor

## Why
UI mới đang dùng rất nhiều class CSS ngoài (`.store-card`, `.filter-panel`, `.btn`, `.dt-modal-*`, etc.) định nghĩa trong `app/globals.css`. Cần chuyển sang Tailwind để:
- đồng nhất style
- giảm phụ thuộc vào CSS file
- dễ maintain

## In Scope
- `pages/index.js` — store list page
- `components/store/store-card.jsx`
- `components/store/store-detail-sheet.jsx`
- `components/store/store-detail-modal-simple.jsx`
- `components/ui/empty-state.jsx`
- `app/globals.css` — xoá các class không còn dùng sau khi convert

## Out of Scope
- Các page khác (dashboard, orders, products, store create/edit/report, map)
- Các component khác (sidebar, header, layout, button, search-box, chip, etc.)
- Thay đổi behavior, business rule, logic
- CSS custom properties (`--surface`, `--border`, `--fg`, etc.) vẫn được dùng qua `var()` trong Tailwind

## Must Preserve
- Dark theme, colors, spacing, border-radius, fonts
- Hover/focus/active states
- Responsive breakpoints (store grid 1 column on mobile, filter panel vs sheet)
- Store type badge colors (giữ nguyên hex values)
- Button styles (height, padding, font-size, colors)
- Animation/transition timings
- Accessibility (focus-visible, tap targets, ARIA attributes)
- Infinite scroll sentinel
- Skeleton loading appearance
- Empty state appearance

## Required Verification
- `npm run lint` — 0 errors
- `npx next build` — thành công
- So sánh visual: store grid, cards, search bar, filter panel/sheet, detail modal/sheet, empty state

## Plan
1. Convert `app/globals.css`: xoá store-list-specific CSS classes
2. Update `getStoreTypeClass()` in store-card.jsx → trả về Tailwind classes
3. Convert `pages/index.js`
4. Convert `store-card.jsx`
5. Convert `store-detail-sheet.jsx`
6. Convert `store-detail-modal-simple.jsx`
7. Convert `empty-state.jsx`
8. Build + lint verify

---

## Done

✅ **pages/index.js** — toàn bộ class chuyển sang Tailwind:
- `.toolbar` → `flex items-center gap-2.5 mb-3.5 flex-wrap`
- `.search-box` → Tailwind utilities + focus-within
- `.search-clear` → Tailwind utilities + opacity conditional
- `.filter-toggle` → Tailwind utilities  
- `.filter-badge` → Tailwind utilities
- `.filter-clear-mobile` → Tailwind utilities + responsive
- `.filter-panel > .filter-inner` → Tailwind flex/grid
- `.filter-group` → Tailwind
- `.filter-chip` → Tailwind + conditional active state
- `.filter-sheet / .filter-backdrop` → Tailwind fixed + transitions
- `.sheet-handle / .sheet-title / .sheet-group` → Tailwind
- `.apply-btn` → Tailwind
- `.store-grid` → `grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-3 max-md:grid-cols-1`
- `.btn, .btn-primary, .btn-outline, .btn-sm` → inline Tailwind utilities
- Skeleton grid → Tailwind

✅ **store-card.jsx**:
- `getStoreTypeClass()` now returns Tailwind classes: `text-emerald-500 bg-emerald-500/10` etc.
- `.store-card` → `flex flex-col ...`
- `.store-card-top / .store-card-name / .store-card-meta` → Tailwind
- `.store-card-type` + all `.store-type-*` → Tailwind
- `.store-card-body / .store-card-row` → Tailwind
- `.store-card-actions` → Tailwind
- `.dist-badge` → Tailwind
- `btn btn-outline btn-sm` everywhere → inline Tailwind

✅ **store-detail-sheet.jsx**:
- `.filter-backdrop / .filter-sheet` → Tailwind
- `.sheet-handle` → Tailwind
- All inline `style={{}}` with `var(--*)` → `text-[color:var(--*)]`
- `.btn` → Tailwind
- `.order-empty` → Tailwind

✅ **store-detail-modal-simple.jsx**:
- `.dt-modal-overlay` → Tailwind fixed + transitions
- `.dt-modal` → Tailwind
- `.dt-modal-header / .dt-modal-close / .dt-modal-body / .dt-modal-footer` → Tailwind
- `.dt-row / .dt-label / .dt-value / .dt-empty / .dt-section-title / .order-empty` → Tailwind
- `.store-card-type` → Tailwind (via getStoreTypeClass)

✅ **empty-state.jsx**:
- `.empty-state` → `text-center py-16`

✅ **globals.css** — removed dead CSS:
- `.store-grid`, `.store-card`, `.store-card-top`, `.store-card-name`, `.store-card-meta`, `.store-card-type`, `.store-card-body`, `.store-card-row`, `.store-card-actions`, `.dist-badge`
- `.store-type-tap-hoa`, `.store-type-quan-an`, `.store-type-kho`, `.store-type-karaoke`, `.store-type-khach-san`, `.store-type-game`
- `.dt-modal-overlay`, `.dt-modal`, `.dt-modal-header`, `.dt-modal-close`, `.dt-modal-body`, `.dt-modal-footer`, `.dt-row`, `.dt-label`, `.dt-value`, `.dt-empty`, `.dt-section-title`, `.order-empty`, `.order-row`, `.order-id`, `.order-label`, `.order-amount` (dt-modal version)
- `.filter-clear-mobile`
- `.store-grid` from `@media (max-width: 768px)`

## Verification
- ✅ `npm run lint` — 0 errors
- ✅ `npx next build` — Compiled successfully, 36 pages generated

## Risks / Next
- **Filter-clear-mobile**: removed CSS class; other pages still using `.filter-toggle` and `.filter-badge` — not affected
- **Btn classes**: store list page no longer uses `.btn`, `.btn-primary`, `.btn-outline`, `.btn-sm` from globals.css; they still exist for other pages
- **Visual diff**: store list should look identical since Tailwind values match original CSS exactly. Cần kiểm tra thủ công nếu có responsive khác biệt
- **Next**: Có thể chuyển tiếp các page/products, orders-list-page, store/create theo pattern tương tự

---

## Phase 7: Skeleton Standardization

**Task Type**: Refactor

### Goal
Standardize skeleton/loading patterns across the app by creating reusable primitives in `components/ui/skeleton.jsx` and replacing inline skeleton grids.

### Done
- **skeleton.jsx** — added 3 new exports:
  - `SkeletonLine` — configurable-width horizontal line skeleton
  - `SkeletonCard` — card-shaped skeleton matching store-card layout
  - `SkeletonGrid` — configurable grid of SkeletonCards (default 12 desktop, caps at 6 mobile)
- **pages/index.js** — replaced inline `SkeletonGrid` (41 lines) with imported `{ SkeletonGrid }` from skeleton.jsx
- **`__tests__/helper/skeleton.test.js`** — expanded from 2 to 12 tests covering all 4 exports, default props, custom className, mobile cap, and desktop default count

### Verification
- ✅ 12/12 skeleton tests pass
- ✅ `npx next build` — Compiled successfully
- ✅ 658 tests pass (+10 from skeleton), 2 pre-existing failures unchanged

### Long tail (not modified)
The remaining `animate-pulse` uses are single-element inline patterns (loading dots, "Đang tải bản đồ…" text, table rows) unique to their context — not suitable for generic extraction.
