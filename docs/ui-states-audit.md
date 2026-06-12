# UI States Audit Report

> **Date:** 2026-06-13  
> **Scope:** All pages in `pages/` + main screen components (`screens/`)  
> **Audited States:** Loading (đang tải/skeleton), Empty (ko có dữ liệu), Error (API fail + hiển thị lỗi)  
> **Note:** Chỉ audit, KO sửa code.

---

## Legend

| ✅ | Có đầy đủ |
| :-- | :-- |
| ⚠️ | Có nhưng chưa đầy đủ / chỉ một phần |
| ❌ | Thiếu hoàn toàn |
| N/A | Không áp dụng (trang form tĩnh, ko fetch data list) |

---

## Pages Audit

### 1. `/` — Home / Store Search (index.js)

| State | Status | Detail |
| :---- | :----- | :----- |
| **Loading** | ✅ | Skeleton cards (`SkeletonList`) hiển thị khi `showSkeleton = loading \|\| !storesLoaded` |
| **Empty** | ✅ | "Không tìm thấy cửa hàng" + "Thử tìm với từ khác hoặc bớt bộ lọc" |
| **Error** | ❌ | `loadAllStores()` trong `useHomeSearchController` chỉ `console.error`, ko có `setError` → user ko thấy lỗi khi API fail |

### 2. `/orders/new` — New Sales Order

| State | Status | Detail |
| :---- | :----- | :----- |
| **Loading** | ✅ | `FullPageLoading` khi auth loading; `"Đang tải..."` khi fetch products/stores |
| **Empty** | ✅ | `"Chưa có hàng hóa."` khi products.length === 0; hướng dẫn tìm hàng khi items rỗng |
| **Error** | ✅ | `try/catch` → `setError` → red banner `<div className="border-b border-red-900...">` |

### 3. `/orders` — Orders List (screens/orders/orders-list-page.jsx)

| State | Status | Detail |
| :---- | :----- | :----- |
| **Loading** | ✅ | `FullPageLoading` + skeleton rows (`<Skeleton>`) trong table |
| **Empty** | ✅ | `"Chưa có đơn hàng phù hợp."` khi filteredOrders.length === 0 |
| **Error** | ✅ | `try/catch` → `setError` → red banner |

### 4. `/orders/[id]` — Order Detail

| State | Status | Detail |
| :---- | :----- | :----- |
| **Loading** | ✅ | `FullPageLoading`, `"Đang tải chi tiết..."` |
| **Empty** | ✅ | `"Không tìm thấy đơn hàng."` |
| **Error** | ✅ | `try/catch` → `setError` → red banner |

### 5. `/map` — Map (screens/map/map-page.jsx)

| State | Status | Detail |
| :---- | :----- | :----- |
| **Loading** | ✅ | Spinner overlay "Đang tải bản đồ…" |
| **Empty** | ❌ | Khi `stores.length === 0` (ko có store nào có toạ độ), map vẫn hiển thị trống, sidebar vẫn hiện "0/0 cửa hàng" → ko có thông báo rõ ràng cho user |
| **Error** | ✅ | `try/catch` trong fetch stores → `setError` ("Không thể tải dữ liệu cửa hàng") + lỗi init map |

### 6. `/store/create` — Create Store

| State | Status | Detail |
| :---- | :----- | :----- |
| **Loading** | ✅ | Button spinner "Đang lưu...", "Đang lấy vị trí...", dynamic import loading |
| **Empty** | N/A | Trang form tạo, ko có danh sách dữ liệu |
| **Error** | ✅ | `duplicateCheckError`, `mapsLinkError`, `fieldErrors`, `geoBlocked`, `compassError`, `msgState` |

### 7. `/store/verify` — Verify Store

| State | Status | Detail |
| :---- | :----- | :----- |
| **Loading** | ✅ | `"Đang tải danh sách cửa hàng..."` khi loading, button "Đang tải..." |
| **Empty** | ✅ | `"Không còn cửa hàng cần xác thực"` / `"Không có kết quả phù hợp bộ lọc"` |
| **Error** | ✅ | `try/catch` → `setError` → red banner |

### 8. `/store/reports` — Store Reports List

| State | Status | Detail |
| :---- | :----- | :----- |
| **Loading** | ✅ | authLoading check + button "Đang tải..." |
| **Empty** | ✅ | `"Hiện chưa có báo cáo cần xử lý."` |
| **Error** | ✅ | `error` state → red banner |

### 9. `/store/reports/[id]` — Report Detail

| State | Status | Detail |
| :---- | :----- | :----- |
| **Loading** | ✅ | `"Đang tải chi tiết báo cáo..."` |
| **Empty** | ✅ | `"Báo cáo này không còn ở trạng thái chờ xử lý hoặc không tồn tại."` |
| **Error** | ✅ | `error` state → red banner |

### 10. `/store/[id]` — Store Detail

| State | Status | Detail |
| :---- | :----- | :----- |
| **Loading** | ✅ | `"Đang tải thông tin cửa hàng..."` |
| **Empty** | ✅ | `error` = "Không tìm thấy cửa hàng." hiển thị trong error box |
| **Error** | ✅ | `try/catch` → `setError` → red box |

### 11. `/store/edit/[id]` — Edit Store

| State | Status | Detail |
| :---- | :----- | :----- |
| **Loading** | ✅ | `FullPageLoading` khi auth/page loading; `FullPageLoading` khi store chưa ready |
| **Empty** | ✅ | `fetchError` hiển thị + nút "Quay lại" |
| **Error** | ✅ | `fetchError` state + `saving` error qua `msgState` |

### 12. `/store/report/[id]` — Report a Store

| State | Status | Detail |
| :---- | :----- | :----- |
| **Loading** | ✅ | `"Đang tải thông tin cửa hàng…"` |
| **Empty** | ✅ | `error` = "Không tìm thấy cửa hàng để báo cáo." |
| **Error** | ✅ | `try/catch` → `setError` → red box |

### 13. `/store/report/[id]/edit` — Edit Store Report

| State | Status | Detail |
| :---- | :----- | :----- |
| **Loading** | ✅ | `"Đang tải thông tin cửa hàng…"` |
| **Empty** | ✅ | `error` = "Không tìm thấy cửa hàng để báo cáo." |
| **Error** | ✅ | `try/catch` → `setError` → red box |

### 14. `/store/import` — Import Stores from CSV

| State | Status | Detail |
| :---- | :----- | :----- |
| **Loading** | ✅ | `FullPageLoading` khi auth + loading stores; "Đang đọc file..." khi parse |
| **Empty** | N/A | Trang import, ko có danh sách cần empty state |
| **Error** | ✅ | `parseError`, `importResult` error, try/catch → error display |

### 15. `/store/export` — Export Stores (all/data/contacts)

| State | Status | Detail |
| :---- | :----- | :----- |
| **Loading** | ✅ | `FullPageLoading`, loading trên refresh button |
| **Empty** | ⚠️ | Khi stores.length === 0, các stat cards hiển thị 0 và buttons bị disabled nhưng **ko có thông báo empty state riêng** |
| **Error** | ✅ | `try/catch` → `setError` → red box |

### 16. `/store/history/[id]` — Store Edit History

| State | Status | Detail |
| :---- | :----- | :----- |
| **Loading** | ✅ | `"Đang tải lịch sử..."` |
| **Empty** | ✅ | `"Chưa có lịch sử chỉnh sửa"` / `"Không có kết quả phù hợp bộ lọc"` |
| **Error** | ✅ | `try/catch` → `setError` → red banner |

### 17. `/store/deduplicate` — Deduplicate Stores

| State | Status | Detail |
| :---- | :----- | :----- |
| **Loading** | ✅ | Button "Đang quét..." khi scan |
| **Empty** | ✅ | `"Hệ thống đang sạch sẽ, không tìm thấy trùng lặp!"` khi ko có clusters |
| **Error** | ✅ | `try/catch` → `setError` → red box |

### 18. `/inventory/products` — Products (Hàng hóa & tồn kho)

| State | Status | Detail |
| :---- | :----- | :----- |
| **Loading** | ✅ | `FullPageLoading`; `"Đang tải..."` trong table |
| **Empty** | ✅ | `"Chưa có hàng hóa."` khi filteredProducts.length === 0 |
| **Error** | ✅ | `try/catch` → `setError` → banner (xanh/đỏ tuỳ error/message) |

### 19. `/inventory/products/[id]` — Product Detail/Edit

| State | Status | Detail |
| :---- | :----- | :----- |
| **Loading** | ✅ | `FullPageLoading`; `"Đang tải..."` trong card |
| **Empty** | ✅ | `"Không tìm thấy hàng hóa."` |
| **Error** | ✅ | `try/catch` → `setError` → banner |

### 20. `/inventory/purchases` — Purchase Orders List

| State | Status | Detail |
| :---- | :----- | :----- |
| **Loading** | ✅ | `FullPageLoading`; `"Đang tải..."` trong table |
| **Empty** | ✅ | `"Chưa có phiếu nhập."` |
| **Error** | ✅ | `try/catch` → `setError` → red banner `<div className="rounded-md border border-red-900...">` |

### 21. `/inventory/purchases/new` — New Purchase Order

| State | Status | Detail |
| :---- | :----- | :----- |
| **Loading** | ✅ | `FullPageLoading`; `"Đang tải hàng hóa..."` trong form |
| **Empty** | ✅ | `"Chưa có hàng hóa. Hãy tạo hàng hóa trước."` khi products.length === 0 |
| **Error** | ✅ | `try/catch` → `setError` → red banner |

### 22. `/inventory/purchases/[id]` — Purchase Order Detail

| State | Status | Detail |
| :---- | :----- | :----- |
| **Loading** | ✅ | `FullPageLoading`; `"Đang tải..."` trong card |
| **Empty** | ✅ | `"Không tìm thấy phiếu nhập."` |
| **Error** | ✅ | `try/catch` → `setError` → red banner |

### 23. `/inventory/stock` — Stock Report

| State | Status | Detail |
| :---- | :----- | :----- |
| **Loading** | ✅ | `FullPageLoading`; `"Đang tải..."` trong sections |
| **Empty** | ✅ | `"Không có hàng dưới tồn tối thiểu."`, `"Chưa có phát sinh kho."` |
| **Error** | ✅ | `try/catch` → `setError` → red banner |

### 24. `/inventory/reports` — Sales Reports / Thống kê

| State | Status | Detail |
| :---- | :----- | :----- |
| **Loading** | ✅ | `FullPageLoading`; `"Đang tải thống kê..."` |
| **Empty** | ✅ | `"Chưa có dữ liệu trong kỳ này."` qua `EmptyRows` component |
| **Error** | ✅ | `try/catch` → `setError` → red banner |

### 25. `/inventory/products/import` — Product CSV Import

| State | Status | Detail |
| :---- | :----- | :----- |
| **Loading** | ✅ | `importing` = "Đang import..." |
| **Empty** | ✅ | `"Dán CSV hoặc chọn file để xem preview."` khi validatedRows.length === 0 |
| **Error** | ✅ | `error` state với red banner |

### 26. `/account` — Account Screen (screens/auth/account-screen.jsx)

| State | Status | Detail |
| :---- | :----- | :----- |
| **Loading** | ✅ | `FullPageLoading` khi auth loading |
| **Empty** | ✅ | Static UI menu; thông báo quyền khách nếu ko phải admin/telesale |
| **Error** | N/A | Ko fetch data list, chỉ render menu + thông tin user |

### 27. `/login` — Login

| State | Status | Detail |
| :---- | :----- | :----- |
| **Loading** | ✅ | Button disabled + "Đang đăng nhập..." |
| **Empty** | N/A | Form, ko có list data |
| **Error** | ✅ | `error` state hiển thị text đỏ dưới form |

### 28. `/admin/users` — Manage Users

| State | Status | Detail |
| :---- | :----- | :----- |
| **Loading** | ✅ | `"Đang kiểm tra đăng nhập..."`, button "Đang tải..." |
| **Empty** | ✅ | `"Không có dữ liệu người dùng."` |
| **Error** | ✅ | `try/catch` → `setError` → red banner |

### 29. `/admin/operations` — Operations Center

| State | Status | Detail |
| :---- | :----- | :----- |
| **Loading** | ✅ | `FullPageLoading`; `"Đang tải..."` trong các section |
| **Empty** | ✅ | `"Không có lỗi đối soát."`, `"Chưa có lịch sử."`, `"Chưa có audit event."` |
| **Error** | ✅ | `try/catch` → `setError` → red banner |

### 30. `/telesale/overview` — Telesale Overview

| State | Status | Detail |
| :---- | :----- | :----- |
| **Loading** | ✅ | `FullPageLoading` khi auth + page loading |
| **Empty** | ✅ | `"Chưa có cửa hàng cần ưu tiên gọi."`, `"Chưa có cuộc gọi nào được cập nhật."` |
| **Error** | ✅ | `try/catch` → `setError` → red banner |

### 31. `/telesale/call/[id]` — Telesale Call Result

| State | Status | Detail |
| :---- | :----- | :----- |
| **Loading** | ✅ | `FullPageLoading` khi auth + loading store |
| **Empty** | ✅ | Fallback UI: `"Không tìm thấy cửa hàng."` + nút Quay lại |
| **Error** | ✅ | `try/catch` → `setError` → red banner |

### 32. `/overview` — Overview Dashboard

| State | Status | Detail |
| :---- | :----- | :----- |
| **Loading** | ✅ | `FullPageLoading`; `"Đang tải dữ liệu..."` |
| **Empty** | ✅ | `"Chưa có dữ liệu cửa hàng."` |
| **Error** | ✅ | `try/catch` → `setError` → red banner |

---

## Summary: Pages Missing Each State

### ❌ Missing Loading State
| Page | Notes |
| :--- | :---- |
| *(None)* | Tất cả 32 pages đều có loading state |

### ❌ Missing Empty State
| Page | Notes |
| :--- | :---- |
| **`/map`** | stores.length === 0 → map trống, sidebar "0/0", ko có thông báo empty state riêng cho user |
| **`/store/export`** | stores.length === 0 → stat cards = 0, buttons disabled, ko có thông báo "chưa có dữ liệu" |

### ❌ Missing Error State
| Page | Notes |
| :--- | :---- |
| **`/` (Home)** | `useHomeSearchController.loadAllStores()` catch chỉ `console.error`, ko có `setError` → API fail silent, user ko thấy lỗi |

---

## Extra Notes

### Components with dynamic imports (loading states)
- `StoreLocationPicker` (store/create) — ✅ loading="Đang tải bản đồ…"
- `SearchStoreCard` (store/create) — ✅ loading="Đang tải thẻ cửa hàng nghi trùng..."
- `StoreReportAdminDetail` (store/reports/[id]) — ✅ loading="Đang tải chi tiết báo cáo..."
- `StoreReportForm` (store/report/[id], store/report/[id]/edit) — ✅ loading="Đang tải form báo cáo..."
- `StoreSupplementForm` (store/edit/[id]) — ✅ loading=`<FullPageLoading />`
- `StoreDetailModal` (screens/map/map-page.jsx) — ❌ **No loading fallback** cho dynamic import (`ssr: false` nhưng ko có `loading` prop)

### Reusable components
- `FullPageLoading` — ✅ Dùng rộng rãi
- `Msg` (flash messages) — ✅ Dùng ở orders/new, orders list
- `Skeleton` — ✅ Dùng ở orders list
