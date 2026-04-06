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
| `image_url` | text | NULL | **Tên file** ảnh trên ImageKit (không phải URL đầy đủ) |
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

## Ảnh (hiển thị)

- `image_url` chỉ là **tên file**: `1716000000_abc.jpg`
- Full URL để hiển thị: `NEXT_PUBLIC_IMAGE_BASE_URL + image_url`

---

## Cache 3-Layer (`lib/storeCache.js`)

```
1. In-memory (memCache) — instant, 60s cooldown, dedup concurrent calls
2. IndexedDB (storevis_cache / map_stores) — persist qua reload
3. Supabase — fetch khi count hoặc max(updated_at) thay đổi
```

### SELECT_FIELDS (fields được cache)
```
id, name, store_type, image_url, latitude, longitude, address_detail,
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
