# 🗄️ Database & Cache - NPP Hà Công

## Supabase (PostgreSQL)

### Bảng `stores` — Bảng chính

| Cột | Kiểu | Nullable | Mô tả |
|---|---|---|---|
| `id` | uuid/bigint | NOT NULL | Primary key (auto) |
| `name` | text | NOT NULL | Tên cửa hàng (Title Case VI) |
| `store_type` | text | NOT NULL | Loại cửa hàng (mặc định `Tạp hóa`) |
| `address_detail` | text | NULL | Số nhà, tên đường |
| `ward` | text | NULL | Xã/Phường |
| `district` | text | NULL | Quận/Huyện |
| `phone` | text | NULL | SĐT Việt Nam |
| `phone_secondary` | text | NULL | SĐT phụ (tuỳ chọn) |
| `note` | text | NULL | Ghi chú |
| `latitude` | float8 | NULL | Vĩ độ |
| `longitude` | float8 | NULL | Kinh độ |
| `active` | boolean | NOT NULL | `true` = đã xác thực; `false` = chờ duyệt |
| `created_at` | timestamptz | NOT NULL | Timestamp tạo |
| `updated_at` | timestamptz | NOT NULL | Timestamp cập nhật |
| `deleted_at` | timestamptz | NULL | Soft-delete (NULL = đang hoạt động) |
| `last_call_result_at` | timestamptz | NULL | Thời điểm cập nhật kết quả gọi gần nhất |

> **Không có cột `name_search`** — không thêm field này khi insert.

> `store_type` nên có default `'Cửa hàng'` + CHECK constraint theo danh sách:
> `Tạp hóa`, `Quán ăn`, `Quán nước`, `Siêu thị`.

> **Soft Delete**: mọi query đọc phải có `.is('deleted_at', null)`.

---

### Bảng `store_reports` — Báo cáo người dùng

| Cột | Kiểu | Nullable | Mô tả |
|---|---|---|---|
| `id` | uuid | NOT NULL | Primary key |
| `store_id` | uuid/bigint | NOT NULL | FK → `stores.id` |
| `report_type` | text | NOT NULL | `edit` hoặc `reason_only` |
| `reason_codes` | text[] | NULL | Lý do báo cáo (multi-select) |
| `reason_note` | text | NULL | Ghi chú thêm (tuỳ chọn) |
| `proposed_changes` | jsonb | NULL | Dữ liệu đề xuất (khi `report_type = edit`) |
| `status` | text | NOT NULL | `pending` / `approved` / `rejected` |
| `reporter_id` | uuid | NULL | FK → `auth.users.id` |
| `created_at` | timestamptz | NOT NULL | Timestamp tạo |
| `updated_at` | timestamptz | NOT NULL | Timestamp cập nhật |

> **Lưu ý**: kiểu của `store_id` phải **khớp** với kiểu `stores.id`.

---

## Order / Inventory MVP

SQL migration:

- `docs/sql/2026-05-12-add-order-inventory-mvp.sql`

Mục tiêu:

- Tận dụng `stores` làm khách hàng trên đơn bán.
- Tận dụng `auth.users` làm người tạo/thao tác.
- Nhập hàng là vào kho ngay.
- Lên đơn bán là xuất kho ngay.
- Không quản lý thanh toán/công nợ trong MVP.
- Không dùng barcode trong `products`.
- Tồn kho lưu theo **đơn vị gốc** để tránh sai số và dễ tính lãi/lỗ.

### Bảng `products` — Hàng hóa

| Cột | Kiểu | Nullable | Mô tả |
|---|---|---|---|
| `id` | uuid | NOT NULL | Primary key |
| `name` | text | NOT NULL | Tên hàng hóa, ví dụ `Nước Lavie 500ml` |
| `sku` | text | NULL | Mã nội bộ tự đặt, ví dụ `LAVIE500` |
| `category` | text | NULL | Nhóm hàng, ví dụ `Nước`, `Bia`, `Sữa` |
| `base_unit_name` | text | NOT NULL | Đơn vị gốc để lưu tồn, nên là đơn vị nhỏ nhất thường có thể bán/xuất: `chai`, `lon`, `gói`, `cái` |
| `default_sale_price` | numeric | NOT NULL | Giá bán mặc định cho 1 đơn vị gốc |
| `default_purchase_price` | numeric | NULL | Giá nhập tham khảo cho 1 đơn vị gốc |
| `min_stock_base_qty` | numeric | NOT NULL | Tồn tối thiểu theo đơn vị gốc |
| `active` | boolean | NOT NULL | `true` = còn bán; `false` = tạm ngừng |
| `note` | text | NULL | Ghi chú hàng hóa |
| `created_by` | uuid | NULL | FK → `auth.users.id`, người tạo |
| `created_at` | timestamptz | NOT NULL | Timestamp tạo |
| `updated_at` | timestamptz | NOT NULL | Timestamp cập nhật |
| `deleted_at` | timestamptz | NULL | Soft-delete |

### Bảng `product_units` — Đơn vị quy đổi

| Cột | Kiểu | Nullable | Mô tả |
|---|---|---|---|
| `id` | uuid | NOT NULL | Primary key |
| `product_id` | uuid | NOT NULL | FK → `products.id` |
| `unit_name` | text | NOT NULL | Tên đơn vị: `chai`, `lon`, `thùng`, `lốc` |
| `conversion_to_base_qty` | numeric | NOT NULL | 1 đơn vị này bằng bao nhiêu đơn vị gốc |
| `default_sale_price` | numeric | NULL | Giá bán mặc định cho đơn vị này, ví dụ giá 1 thùng |
| `default_purchase_price` | numeric | NULL | Giá nhập mặc định cho đơn vị này |
| `is_base_unit` | boolean | NOT NULL | `true` nếu là đơn vị gốc; khi đó `conversion_to_base_qty = 1` |
| `active` | boolean | NOT NULL | Còn dùng đơn vị này không |
| `created_at` | timestamptz | NOT NULL | Timestamp tạo |
| `updated_at` | timestamptz | NOT NULL | Timestamp cập nhật |

Ví dụ sản phẩm nước có `base_unit_name = chai`:

| `unit_name` | `conversion_to_base_qty` | Nghĩa |
|---|---:|---|
| `chai` | 1 | 1 chai = 1 chai |
| `lốc 6` | 6 | 1 lốc = 6 chai |
| `thùng 12` | 12 | 1 thùng = 12 chai |
| `thùng 24` | 24 | 1 thùng = 24 chai |

### Quy tắc `conversion_to_base_qty`

- DB lưu tồn bằng `product_stock.on_hand_base_qty`.
- `quantity` là số lượng theo đơn vị user chọn trên phiếu.
- `conversion_to_base_qty` là hệ số quy đổi tại thời điểm tạo dòng phiếu.
- `quantity_base = quantity * conversion_to_base_qty`.
- Khi nhập: tồn tăng theo `quantity_base`.
- Khi bán: tồn giảm theo `quantity_base`.

Ví dụ:

- Nhập `10 thùng 12`: `quantity = 10`, `conversion_to_base_qty = 12`, `quantity_base = 120 chai`.
- Bán `3 thùng 12`: `quantity = 3`, `conversion_to_base_qty = 12`, `quantity_base = 36 chai`.

`conversion_to_base_qty` phải được snapshot trên từng dòng nhập/bán vì quy đổi có thể đổi sau này. Nếu hôm nay `thùng = 12 chai`, sau này tạo thêm `thùng = 24 chai`, đơn cũ vẫn phải giữ đúng số lượng lịch sử.

> Khuyến nghị: dù thao tác chủ yếu bằng `thùng`, vẫn để đơn vị gốc là `chai` hoặc `lon`, rồi mặc định UI chọn `thùng`. Như vậy vẫn bán lẻ được khi cần và tồn kho không bị số lẻ kiểu `0.083333 thùng`.

### Bảng `product_stock` — Tồn hiện tại

| Cột | Kiểu | Nullable | Mô tả |
|---|---|---|---|
| `product_id` | uuid | NOT NULL | PK + FK → `products.id` |
| `on_hand_base_qty` | numeric | NOT NULL | Tồn hiện tại theo đơn vị gốc |
| `avg_cost_per_base_unit` | numeric | NOT NULL | Giá vốn bình quân / đơn vị gốc |
| `last_purchase_price` | numeric | NULL | Giá nhập gần nhất / đơn vị gốc |
| `updated_at` | timestamptz | NOT NULL | Lần cập nhật tồn gần nhất |

Giá vốn MVP dùng bình quân gia quyền:

```text
avg_cost_mới =
((tồn_cũ * giá_vốn_cũ) + giá_trị_nhập_mới) / tồn_mới
```

### Bảng `purchase_orders` — Phiếu nhập

| Cột | Kiểu | Nullable | Mô tả |
|---|---|---|---|
| `id` | uuid | NOT NULL | Primary key |
| `code` | text | NOT NULL | Mã phiếu nhập, ví dụ `PN0001` |
| `supplier_name` | text | NULL | Tên nhà cung cấp, MVP dùng text |
| `note` | text | NULL | Ghi chú phiếu nhập |
| `total_amount` | numeric | NOT NULL | Tổng tiền nhập |
| `created_by` | uuid | NULL | FK → `auth.users.id`, người tạo |
| `created_at` | timestamptz | NOT NULL | Thời điểm nhập kho |
| `cancelled_at` | timestamptz | NULL | Thời điểm hủy nếu có |

Không có `status`, `confirmed_by`, `confirmed_at`. Tạo phiếu nhập nghĩa là hàng đã vào kho.

### Bảng `purchase_order_items` — Dòng phiếu nhập

| Cột | Kiểu | Nullable | Mô tả |
|---|---|---|---|
| `id` | uuid | NOT NULL | Primary key |
| `purchase_order_id` | uuid | NOT NULL | FK → `purchase_orders.id` |
| `product_id` | uuid | NOT NULL | FK → `products.id` |
| `product_unit_id` | uuid | NOT NULL | FK → `product_units.id`, đơn vị nhập |
| `quantity` | numeric | NOT NULL | Số lượng theo đơn vị nhập |
| `conversion_to_base_qty` | numeric | NOT NULL | Snapshot quy đổi lúc nhập |
| `quantity_base` | numeric | NOT NULL | Generated: số lượng cộng kho theo đơn vị gốc |
| `unit_cost` | numeric | NOT NULL | Giá nhập / đơn vị đang chọn |
| `unit_cost_base` | numeric | NOT NULL | Generated: giá nhập / đơn vị gốc |
| `line_total` | numeric | NOT NULL | Generated: thành tiền dòng |
| `note` | text | NULL | Ghi chú dòng |
| `created_at` | timestamptz | NOT NULL | Timestamp tạo |

### Bảng `sales_orders` — Đơn bán

| Cột | Kiểu | Nullable | Mô tả |
|---|---|---|---|
| `id` | uuid | NOT NULL | Primary key |
| `code` | text | NOT NULL | Mã đơn, ví dụ `DH0001` |
| `customer_store_id` | uuid/bigint | NOT NULL | FK → `stores.id`, khách hàng/cửa hàng |
| `status` | text | NOT NULL | `active` hoặc `cancelled` |
| `note` | text | NULL | Ghi chú đơn hàng |
| `subtotal_amount` | numeric | NOT NULL | Tổng trước giảm |
| `discount_amount` | numeric | NOT NULL | Giảm giá đơn |
| `total_amount` | numeric | NOT NULL | Tổng phải thu sau giảm |
| `total_cost_amount` | numeric | NOT NULL | Tổng giá vốn |
| `gross_profit_amount` | numeric | NOT NULL | Lãi gộp = `total_amount - total_cost_amount` |
| `created_by` | uuid | NULL | FK → `auth.users.id`, người lên đơn |
| `created_at` | timestamptz | NOT NULL | Thời điểm xuất kho |
| `cancelled_at` | timestamptz | NULL | Thời điểm hủy nếu có |

Không có `payment_status`, `confirmed_by`, `confirmed_at`. Tạo đơn bán nghĩa là hàng đã xuất kho.

### Bảng `sales_order_items` — Dòng đơn bán

| Cột | Kiểu | Nullable | Mô tả |
|---|---|---|---|
| `id` | uuid | NOT NULL | Primary key |
| `sales_order_id` | uuid | NOT NULL | FK → `sales_orders.id` |
| `product_id` | uuid | NOT NULL | FK → `products.id` |
| `product_unit_id` | uuid | NOT NULL | FK → `product_units.id`, đơn vị bán |
| `quantity` | numeric | NOT NULL | Số lượng theo đơn vị bán |
| `conversion_to_base_qty` | numeric | NOT NULL | Snapshot quy đổi lúc bán |
| `quantity_base` | numeric | NOT NULL | Generated: số lượng trừ kho theo đơn vị gốc |
| `unit_price` | numeric | NOT NULL | Giá bán / đơn vị đang chọn |
| `unit_price_base` | numeric | NOT NULL | Generated: giá bán / đơn vị gốc |
| `cost_price_base` | numeric | NOT NULL | Snapshot giá vốn bình quân / đơn vị gốc lúc bán |
| `line_total` | numeric | NOT NULL | Generated: doanh thu dòng |
| `line_cost_total` | numeric | NOT NULL | Generated: giá vốn dòng |
| `line_profit` | numeric | NOT NULL | Generated: lãi dòng |
| `note` | text | NULL | Ghi chú dòng |
| `created_at` | timestamptz | NOT NULL | Timestamp tạo |

### Bảng `stock_movements` — Sổ cái kho

| Cột | Kiểu | Nullable | Mô tả |
|---|---|---|---|
| `id` | uuid | NOT NULL | Primary key |
| `product_id` | uuid | NOT NULL | FK → `products.id` |
| `movement_type` | text | NOT NULL | `purchase`, `sale`, `adjustment`, `purchase_cancel`, `sale_cancel` |
| `source_table` | text | NOT NULL | Bảng nguồn, ví dụ `purchase_order_items` |
| `source_id` | uuid | NOT NULL | ID dòng nguồn |
| `quantity_base` | numeric | NOT NULL | Dương = nhập, âm = xuất |
| `cost_price_base` | numeric | NOT NULL | Giá vốn / đơn vị gốc tại phát sinh |
| `stock_after_base_qty` | numeric | NOT NULL | Tồn sau phát sinh |
| `created_by` | uuid | NULL | FK → `auth.users.id` |
| `created_at` | timestamptz | NOT NULL | Thời điểm phát sinh |
| `note` | text | NULL | Ghi chú |

### Bảng `stock_adjustments` và `stock_adjustment_items` — Điều chỉnh tồn

`stock_adjustments` lưu đầu phiếu kiểm kho/điều chỉnh. `stock_adjustment_items` lưu từng sản phẩm tăng/giảm tồn bằng `quantity_base_delta`.

Các trigger trong migration tự:

- Cộng tồn và cập nhật giá vốn bình quân khi insert `purchase_order_items`.
- Trừ tồn và snapshot `cost_price_base` khi insert `sales_order_items`.
- Chặn bán âm tồn.
- Ghi `stock_movements`.
- Cập nhật tổng tiền và lãi gộp trên đơn.

---

## Auth (Supabase built-in)

- Dùng `auth.users` của Supabase, không có bảng user custom
- Chỉ `signInWithPassword(email, password)` — không đăng ký

---

## ⚠️ Index Khuyến Nghị

Hiện tại chưa có index tùy chỉnh. Khi data lớn cần:
```sql
CREATE INDEX idx_stores_active ON stores(active) WHERE deleted_at IS NULL;
CREATE INDEX idx_stores_district ON stores(district) WHERE deleted_at IS NULL;
CREATE INDEX idx_stores_store_type ON stores(store_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_stores_deleted_at ON stores(deleted_at);
CREATE INDEX idx_store_reports_status ON store_reports(status);
CREATE INDEX idx_store_reports_store_id ON store_reports(store_id);
```

---

## ⚠️ Bảo Mật: RLS Bắt Buộc

Môi trường phải chạy migration:
- `docs/sql/2026-04-06-auth-roles-and-rls.sql`

Quy tắc quyền sau migration:
- Role chỉ lấy từ `app_metadata` trong JWT (`admin`, `telesale`, còn lại là `guest`)
- `stores`:
  - `anon/authenticated`: chỉ SELECT store chưa xóa mềm
  - `anon/authenticated`: INSERT được với `active=false`; chỉ `admin` mới được `active=true`
  - `is_potential=true` chỉ dành cho `telesale/admin` (guest không set được)
  - `admin`: UPDATE đầy đủ
  - `telesale`: chỉ UPDATE nhóm cột telesale (`is_potential`, `last_called_at`, `last_call_result`, `last_call_result_at`, `last_order_reported_at`, `sales_note`, `updated_at`)
- `store_reports`:
  - `anon/authenticated`: INSERT báo cáo với `status='pending'`
  - `admin`: SELECT + UPDATE duyệt báo cáo

---

## Cache 3-Layer (`lib/storeCache.js`)

```
1. In-memory (memCache) — instant, 60s cooldown, dedup concurrent calls
2. IndexedDB (storevis_cache / map_stores) — persist qua reload
3. Supabase — fetch khi count hoặc max(updated_at) thay đổi
```

### SELECT_FIELDS (fields được cache)
```
id, name, store_type, latitude, longitude, address_detail,
ward, district, phone, phone_secondary, note, active, created_at, updated_at,
is_potential, last_called_at, last_call_result, last_call_result_at,
last_order_reported_at, sales_note
```
> `deleted_at` **không** được cache. Luôn filter server-side trước khi cache.

### API Cache

| Hàm | Khi dùng |
|---|---|
| `getOrRefreshStores()` | Đọc danh sách stores — API duy nhất |
| `appendStoreToCache(store)` | Sau khi CREATE thành công |
| `removeStoreFromCache(id)` | Sau khi soft-delete |
| `invalidateStoreCache()` | Sau khi EDIT (force refetch) |

> Ngoại lệ: màn admin `/store/export` được đọc trực tiếp Supabase để lấy đủ toàn bộ store chưa xóa mềm cho file xuất; không dùng cache public.

---

## Telesale Minimal Fields

NPP Hà Công ban toi gian cho telesale them truc tiep 6 cot tren `public.stores`:

```sql
is_potential boolean not null default false
last_called_at timestamptz null
last_call_result text null
last_call_result_at timestamptz null
last_order_reported_at timestamptz null
sales_note text null
```

Gia tri khuyen nghi cho `last_call_result`:

```text
khong_nghe
goi_lai_sau
con_hang
da_len_don
```

Gia tri cu van phai doc tuong thich khi hien thi/so lieu:

```text
khong_nghe_may -> khong_nghe
quan_tam -> con_hang
da_bao_don -> da_len_don
```

SQL de ap len moi truong PRD duoc luu tai:

- `docs/sql/2026-04-01-add-store-telesale-columns.sql`
