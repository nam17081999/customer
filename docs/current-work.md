# Current Work

## Goal
- Thêm màn thống kê đơn hàng và hàng hóa: hàng bán nhiều, lãi/lỗ theo kỳ, khách lấy nhiều hàng, sản phẩm lãi nhất; đồng thời giữ chỉnh UI danh sách hàng hóa đã yêu cầu trước đó.

## Task Type
- Feature

## Why
- Admin cần xem nhanh hiệu quả bán hàng theo ngày/tuần/tháng/năm, khách hàng mua nhiều và sản phẩm tạo lãi tốt.

## In Scope
- Màn thống kê mới trong nhóm inventory/order.
- Truy vấn/aggregate dữ liệu `sales_orders`, `sales_order_items`, `products`, `stores` phía client hiện có.
- Link điều hướng tới màn thống kê từ danh sách hàng hóa.
- UI danh sách hàng hóa: đơn vị và tồn xuống dòng riêng.

## Out of Scope
- Thêm bảng/migration/RPC mới.
- Đổi logic tạo/hủy đơn, trừ tồn, tính giá vốn, cache store.
- Biểu đồ phức tạp hoặc export file.
- Báo cáo phiếu nhập/chi phí ngoài `sales_orders` hiện có.

## Must Preserve
- Chỉ tính đơn `status = active`; đơn hủy không tính doanh thu/lãi/tồn.
- Lãi dùng snapshot hiện có: `gross_profit_amount` và `line_profit`.
- Public store reads qua `getOrRefreshStores()`.
- Auth admin guard, Pages Router, import alias, dark theme, text size/contrast.
- UTF-8 tiếng Việt.

## Inputs / Repro / Expected
- Input: admin mở màn thống kê, chọn kỳ ngày/tuần/tháng/năm.
- Expected:
  - Hiển thị tổng đơn, doanh thu, giá vốn, lãi gộp, biên lãi.
  - Bảng sản phẩm bán nhiều theo số lượng gốc/doanh thu/lãi.
  - Bảng khách mua nhiều theo số đơn/doanh thu/số lượng/lãi.
  - Bảng sản phẩm lãi nhất theo tổng lãi và biên lãi.

## Constraints
- Sửa tối thiểu, không thêm dependency.
- Query giới hạn hợp lý cho MVP client-side.

## Required Verification
- `npm run lint`.
- `git diff --check`.
- Smoke review UI/accessibility cho `/inventory/reports` và `/inventory/products`.

## Definition of Done
- Có màn thống kê mới truy cập được.
- Các metric chính tính từ dữ liệu đơn bán active.
- Product list giữ yêu cầu xuống dòng.
- Verification ghi rõ kết quả.

## Plan
- Thêm API đọc dữ liệu thống kê đơn bán.
- Thêm helper aggregate thống kê.
- Tạo page `/inventory/reports`.
- Thêm link từ danh sách hàng hóa.
- Chạy lint và diff check.

## Done
- Added `/inventory/reports` dashboard with period filters: day, week, month, year, all.
- Added active sales report loading from `sales_orders` + `sales_order_items`, joined client-side with products and cached stores.
- Added aggregates for totals, top products by quantity, top products by profit, and top customers by quantity.
- Added link from `/inventory/products` to the new statistics screen.
- Updated `/inventory/products` list so units and stock display on separate lines.

## Verification
- `npm run lint` passed with 0 errors; existing `@next/next/no-img-element` warnings remain in `/Users/nam/Desktop/customer/pages/orders/[id].js` and `/Users/nam/Desktop/customer/.claude/worktrees/condescending-williamson-122bbe/pages/orders/[id].js`.
- `git diff --check` passed.
- `node scripts/check-mojibake.js` is blocked by pre-existing `.claude/worktrees/condescending-williamson-122bbe/scripts/check-mojibake.js` self-pattern findings.
- Custom changed-file mojibake scan passed for modified `.js/.jsx/.md/.json/.css` files.
- Checklist reviewed: auth/admin guard, store cache read, order status safety, inventory/profit snapshot safety, dark theme/readability.

## Risks / Next
- Browser smoke test not run in this session.
- Report currently uses client-side aggregation with a 1000 active-order query limit; large production datasets should move this to paged queries or Supabase RPC.
