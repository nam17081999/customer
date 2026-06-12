# Phân Tích Business — Hệ Thống NPP Hà Công

> Ngày: 2026-06-12
> Mục tiêu: Đánh giá mức độ hoàn thiện của hệ thống dưới góc nhìn một Nhà Phân Phối (NPP) điển hình tại Việt Nam

---

## 1. Tổng Quan Hiện Trạng

### Tech Stack
| Layer | Công nghệ | Mức độ |
|---|---|---|
| Framework | Next.js Pages Router | ✅ Ổn định |
| Database | Supabase (PostgreSQL) | ✅ RLS, migration, realtime |
| Map | MapLibre + OSM + Google Maps picker | ✅ 3 nguồn dự phòng |
| Cache | 3-layer (memory → IDB → Supabase) | ✅ Tối ưu cho mobile |
| Auth | Supabase Auth | ✅ Role-based (admin/telesale/guest) |
| Testing | Vitest (48 unit) + Playwright (9 E2E) | ⚠️ Có nhưng 5 test fail |
| Type Safety | JavaScript (không TypeScript) | ❌ Rủi ro refactor |

### Modules Đã Có
```
┌──────────────────────────────────────────┐
│  Store Management        ✅ Hoàn chỉnh    │
│  - CRUD, map, search, import/export       │
│  - Deduplicate, verify, report flow       │
│  - 3-layer cache, soft-delete, RLS        │
├──────────────────────────────────────────┤
│  Product Management      ✅ Hoàn chỉnh    │
│  - CRUD, product units, conversion        │
│  - Category, SKU, pricing                 │
├──────────────────────────────────────────┤
│  Purchase Orders         ✅ Cơ bản        │
│  - PO create, auto stock update           │
│  - Cost averaging (bình quân gia quyền)   │
│  - Cancel flow                            │
├──────────────────────────────────────────┤
│  Sales Orders            ✅ Cơ bản        │
│  - SO create with line items, drafts      │
│  - Auto stock deduction, profit calc      │
│  - Discount, subtotal, printed flag       │
├──────────────────────────────────────────┤
│  Inventory               ✅ Cơ bản        │
│  - Stock dashboard, low-stock warnings     │
│  - Movements ledger, adjustments          │
│  - Reconciliation tools                    │
│  - Inventory reports (aggregate RPCs)     │
├──────────────────────────────────────────┤
│  Telesale                ✅ Hoàn chỉnh    │
│  - Call queue, priority ordering          │
│  - Call result capture, sales notes       │
│  - Re-call scheduling (2d/3d rules)       │
├──────────────────────────────────────────┤
│  Admin                   ✅ Cơ bản        │
│  - User management                        │
│  - Operations center                      │
│  - Audit logs                             │
├──────────────────────────────────────────┤
│  Notifications           ✅ Cơ bản        │
│  - Realtime (Supabase Realtime)           │
│  - Low stock, pending reports             │
│  - V2 notification feed                   │
├──────────────────────────────────────────┤
│  Map & Geolocation       ✅ Hoàn chỉnh    │
│  - Routing, markers, GPS tracking         │
│  - Compass heading, nearby stores         │
└──────────────────────────────────────────┘
```

---

## 2. So Sánh Với Hệ Thống Phân Phối Chuẩn

### Ma trận tính năng NPP điển hình vs. Hà Công hiện tại

| Tính năng | NPP chuẩn | Hà Công | Ghi chú |
|---|---|---|---|
| **Quản lý khách hàng (cửa hàng)** | ✅ | ✅ | Mạnh: có duplicate check, import/export, verify flow |
| **Quản lý sản phẩm** | ✅ | ✅ | Có đơn vị tính, quy đổi, SKU |
| **Đặt hàng (SO)** | ✅ | ✅ | Có discount, profit calc, draft |
| **Nhập kho (PO)** | ✅ | ✅ | Có giá vốn bình quân |
| **Tồn kho** | ✅ | ✅ | Có sổ cái, kiểm kê, điều chỉnh |
| **Bản đồ / Tuyến** | ⚠️ | ✅ | Hà Công mạnh hơn NPP chuẩn |
| **Telesale CRM** | ⚠️ | ✅ | Có queue, kết quả gọi |
| | | | |
| **Quản lý giá (Price List)** | ✅ | ❌ | Không có bảng giá theo khách hàng/khu vực |
| **Chiết khấu / Khuyến mãi** | ✅ | ❌ | Chỉ có discount đơn hàng, không có chương trình KM |
| **Công nợ phải thu (AR)** | ✅ | ❌ | Không có theo dõi thanh toán, dư nợ, quá hạn |
| **Công nợ phải trả (AP)** | ✅ | ❌ | Không có thanh toán nhà cung cấp |
| **Giao hàng** | ✅ | ❌ | Không có quản lý vận chuyển, xác nhận giao |
| **Hàng trả lại / Đổi trả** | ✅ | ❌ | Không có returns/credit note |
| **Báo giá (Quotation)** | ✅ | ❌ | Không có, tạo đơn trực tiếp |
| **Hợp đồng** | ⚠️ | ❌ | Không có quản lý hợp đồng |
| **Đa kho (Multi-warehouse)** | ⚠️ | ❌ | 1 kho duy nhất |
| **KPI / Mục tiêu** | ⚠️ | ❌ | Không có mục tiêu doanh số |
| **Báo cáo tài chính** | ⚠️ | ❌ | Chỉ có lãi gộp đơn hàng |
| **POS / In hóa đơn** | ⚠️ | ⚠️ | Có printed flag nhưng chưa template in |
| **Xuất nhập khẩu** | ❌ | ❌ | Out of scope cho NPP nội địa |
| **Phân quyền nhân viên** | ✅ | ⚠️ | Chỉ có admin/telesale/guest, không có sales rep territories |
| **Mobile App** | ✅ | ⚠️ | Web responsive nhưng không phải native app |

**Tổng quan: Hà Công hiện đang ở giai đoạn "Inventory/Order MVP" — đã có skeleton của NPP nhưng thiếu 5-6 module kinh doanh cốt lõi để vận hành thực tế.**

---

## 3. Điểm Mạnh / Điểm Yếu

### 🟢 Điểm Mạnh

| # | Điểm mạnh | Tác động business |
|---|---|---|
| 1 | **Store management rất mạnh** — duplicate detection, CSV import/export, verify flow, geolocation | Giúp xây dựng database khách hàng sạch, không trùng lặp — nền tảng cho mọi hoạt động bán hàng |
| 2 | **Map & Geolocation vượt trội** — routing, compass, GPS tracking, nearby stores | NPP thường không có tính năng này; là lợi thế cạnh tranh rõ rệt |
| 3 | **3-layer cache** — hoạt động offline-friendly, phù hợp telesale field | Telesale đi thực địa không cần mạng ổn định |
| 4 | **Telesale module chuyên biệt** — call queue, priority rules, call results | Phù hợp quy trình telesale B2B thực tế |
| 5 | **Tiếng Việt hóa tốt** — tìm kiếm không dấu, phonetic matching | Người dùng cuối là người Việt, gõ sai chính tả vẫn tìm được |
| 6 | **Test coverage khá** — 48 unit + 9 E2E (dù 5 fail) | Hơn nhiều startup Việt Nam cùng quy mô |
| 7 | **Kiến trúc sạch** — 324 commits, migration có versioning, business rules rõ ràng | Có thể mở rộng dễ dàng |

### 🔴 Điểm Yếu

| # | Điểm yếu | Tác động business | Mức độ |
|---|---|---|---|
| 1 | **Không có quản lý công nợ** — không thể biết khách nợ bao nhiêu, quá hạn bao lâu | ❌ KHÔNG THỂ vận hành; NPP bán chịu là chính | **Critical** |
| 2 | **Không có bảng giá / khuyến mãi** — mỗi khách hàng có thể có giá riêng | Không linh hoạt trong định giá; mất cạnh tranh | **High** |
| 3 | **Không có quản lý giao hàng** — không track được đơn đã giao chưa | ❌ KHÔNG THỂ vận hành logistics | **Critical** |
| 4 | **5 tests failing** — test suite không đáng tin cậy | Rủi ro regression khi thêm tính năng | **High** |
| 5 | **Không TypeScript** — codebase 218 files JS thuần | Refactor khó, bug runtime dễ xảy ra | **Medium** |
| 6 | **Client-side search không scale** — tải toàn bộ stores về client | Khi >5K stores sẽ chậm | **Medium** |
| 7 | **Thiếu DB indexes** — chưa apply `indexes.sql` | Query Supabase chậm khi data lớn | **Medium** |
| 8 | **Không CI/CD** — không có GitHub Actions | Không automated testing trên PR | **Medium** |
| 9 | **Chưa có E2E cho inventory/orders** — module mới nhất không có E2E | Rủi ro cao nhất cho module quan trọng | **High** |
| 10 | **Không có tính năng offline cho field sales** — cache chỉ cho stores, không cho orders | Sales không thể tạo đơn khi mất mạng | **Medium** |

---

## 4. Phân Tích Khoảng Cách (Gap Analysis) — Góc Nhìn NPP

### Vòng đời đơn hàng NPP điển hình
```
Báo giá → Đặt hàng → Xác nhận → Giao hàng → Xác nhận giao → Ghi nhận công nợ → Thu tiền → Đối soát
```

### Hà Công hiện tại
```
           Đặt hàng → [Xuất kho ngay] → [Kết thúc]
```

**Khoảng cách lớn nhất:**
1. **Không có trạng thái đơn hàng** — đơn được tạo là xuất kho ngay, không có pending/confirmed/shipping/delivered
2. **Không có payment** — không ghi nhận khách trả tiền, không biết công nợ
3. **Không có delivery** — không có module giao hàng, không track vận chuyển
4. **Không có returns** — không xử lý hàng trả lại, không có credit note

### So sánh scope với 3 DMS phổ biến tại Việt Nam
| Module | Sapo | KiotViet | Haravan | Hà Công |
|---|---|---|---|---|
| Quản lý khách hàng | ✅ | ✅ | ✅ | ✅ |
| Quản lý sản phẩm | ✅ | ✅ | ✅ | ✅ |
| Bán hàng (POS) | ✅ | ✅ | ✅ | ⚠️ |
| Đặt hàng (Order) | ✅ | ✅ | ✅ | ✅ |
| Quản lý kho | ✅ | ✅ | ✅ | ✅ |
| Công nợ | ✅ | ✅ | ✅ | ❌ |
| Bảng giá | ✅ | ✅ | ✅ | ❌ |
| Khuyến mãi | ✅ | ✅ | ✅ | ❌ |
| Giao hàng | ✅ | ✅ | ✅ | ❌ |
| Báo cáo doanh số | ✅ | ✅ | ✅ | ⚠️ |
| CRM/Marketing | ✅ | ✅ | ✅ | ❌ |
| Nhân viên/Phân quyền | ✅ | ✅ | ✅ | ⚠️ |

---

## 5. Đề Xuất Lộ Trình Phát Triển (Product Roadmap)

### Phase 0: 🔴 Stabilize (1-2 tuần) — PHẢI LÀM TRƯỚC KHI THÊM TÍNH NĂNG

| Task | Rationale | Effort |
|---|---|---|
| **Fix 5 test failures** | Không thể tin tưởng codebase khi test đỏ | 1 ngày |
| **Apply DB indexes** (`supabase/indexes.sql`) | Query sẽ chậm khi data > vài nghìn | 0.5 ngày |
| **Add E2E cho inventory/orders flows** | Module mới nhất, rủi ro cao nhất, không E2E | 2-3 ngày |
| **Fix inventoryClient `listPurchaseOrders` mock** | ⚠️ Code thiếu `.order()` → sẽ lỗi runtime | 0.5 ngày |

### Phase 1: 🟡 Payment & AR (Công nợ & Thu tiền) — 2-3 tuần
*Không thể vận hành NPP nếu không có module này.*

| Tính năng | Mô tả | Lý do business |
|---|---|---|
| **Thêm `payment_status` vào sales_orders** | `pending`, `partial`, `paid` | Biết đơn nào đã thu tiền |
| **Bảng `customer_debts`** | Dư nợ đầu kỳ, phát sinh, dư nợ cuối | Theo dõi công nợ theo khách hàng |
| **Bảng `payments` / `payment_collections`** | Ghi nhận thanh toán từ khách | Đối soát tiền |
| **Bảng `debt_aging`** | Phân tích nợ quá hạn (1-7d, 8-30d, 30d+) | Quản lý rủi ro |
| **UI: Sổ công nợ khách hàng** | Xem lịch sử nợ/trả | Telesale/Admin cần để đôn đốc thu hồi |
| **Số dư tài khoản** | Tổng hợp công nợ theo khách | Báo cáo quản trị |

### Phase 2: 🟢 Pricing & Promotion (Bảng giá & Khuyến mãi) — 2-3 tuần

| Tính năng | Mô tả |
|---|---|
| **Bảng `price_lists`** | Định nghĩa các bảng giá (bán buôn, bán lẻ, đặc biệt) |
| **Bảng `price_list_items`** | Giá theo sản phẩm + đơn vị tính |
| **Bảng `price_list_customers`** | Gán bảng giá cho khách hàng / nhóm khách hàng |
| **UI: Chọn bảng giá khi tạo đơn** | Mặc định theo khách, có thể override |
| **Bảng `promotions`** | Chương trình khuyến mãi (mua X tặng Y, chiết khấu %, giảm tiền) |
| **UI: Áp dụng khuyến mãi tự động** | Khi thỏa điều kiện, discount tự tính |

### Phase 3: 🔵 Delivery Management (Giao hàng) — 3-4 tuần

| Tính năng | Mô tả | Lý do |
|---|---|---|
| **Thêm `status` enum vào sales_orders** | `draft → confirmed → shipping → delivered → cancelled` | Track trạng thái thực tế |
| **Bảng `deliveries`** | Đầu phiếu giao hàng | Gán tài xế, xe, lộ trình |
| **Bảng `delivery_items`** | Hàng giao (có thể khác đơn) | Xử lý giao thiếu |
| **UI: Xác nhận giao hàng** | Tài xế xác nhận đã giao | Khép đơn |
| **Tích hợp Map routing** | Đã có sẵn — tối ưu lộ trình giao | Tận dụng module map hiện có |

### Phase 4: ⚪ Reporting & Analytics (Báo cáo & Phân tích) — 2-3 tuần

| Tính năng | Mô tả |
|---|---|
| **Dashboard doanh số theo ngày/tuần/tháng** | Tổng quan cho admin |
| **Báo cáo theo nhân viên** | Doanh số telesale, KPI |
| **Báo cáo theo khu vực** | Quận/huyện nào bán chạy |
| **Báo cáo theo sản phẩm** | Top sản phẩm, tồn chậm luân chuyển |
| **Báo cáo công nợ** | Nợ quá hạn, khách nợ nhiều |
| **Xuất báo cáo Excel** | Export ra file cho kế toán |

### Phase 5: 🟣 Enhancements & Scale (Cải thiện & Mở rộng) — ongoing

| Tính năng | Mô tả |
|---|---|
| **TypeScript migration** | Từ từ theo module, bắt đầu từ helper/lib |
| **Pagination cho store search** | Server-side search thay vì client-side |
| **CI/CD (GitHub Actions)** | Tự động test + lint + build |
| **Multi-warehouse** | Nhiều kho, chuyển kho |
| **Offline-first cho field sales** | Tạo đơn khi offline, sync sau |
| **Thông báo đẩy (Push notifications)** | Qua Web Push API |
| **Native mobile app** | React Native hoặc PWA nâng cao |

---

## 6. Mức Độ Sẵn Sàng Production

### Đánh giá tổng thể: ⚠️ **CHƯA SẴN SÀNG cho production thực tế**

| Tiêu chí | Đánh giá | Chi tiết |
|---|---|---|
| **Store management** | ✅ Sẵn sàng | Tính năng chính đã chín, có cache, import/export, duplicate check |
| **Product management** | ✅ Sẵn sàng | CRUD + units + conversion đầy đủ |
| **Purchase orders** | ⚠️ Gần sẵn sàng | Cần E2E + fix test + fix `.order()` bug |
| **Sales orders** | ⚠️ Gần sẵn sàng | Cần E2E + thêm payment status |
| **Inventory** | ⚠️ Gần sẵn sàng | Cần E2E + reconciliation flow test |
| **Telesale** | ✅ Sẵn sàng | Module chín nhất sau store management |
| **Admin** | ⚠️ Gần sẵn sàng | Cần polish operations dashboard |
| **Notifications** | ⚠️ Gần sẵn sàng | V2 notification feed mới thêm, cần test |
| **Total system** | ❌ **Chưa sẵn sàng** | Thiếu 3 module critical: công nợ, giao hàng, bảng giá |

### Rào cản production chính:

```
1. ❌ KHÔNG CÓ CÔNG NỢ — không thể bán chịu, không thể quản lý dòng tiền
2. ❌ KHÔNG CÓ GIAO HÀNG — không track đơn đi đâu, đã giao chưa
3. ❌ KHÔNG CÓ BẢNG GIÁ — mỗi khách mỗi giá, phải nhập tay
4. ⚠️ TEST SUITE KHÔNG XANH — 5 test fail, module mới không E2E
5. ⚠️ KHÔNG CI/CD — deploy thủ công, dễ miss regression
```

### Nếu deploy ngay chỉ với tính năng hiện tại, có thể dùng cho:

- **Giai đoạn 0 (thu thập data):** Store management + map + telesale = ✅ OK
  - Dùng để xây dựng database khách hàng
  - Telesale gọi điện chăm sóc, không cần quản lý đơn hàng
  - Phù hợp start-up NPP mới thành lập, chưa có giao dịch

- **Giai đoạn 1 (bán hàng thực tế):** ❌ KHÔNG OK
  - Thiếu công nợ → không kiểm soát được dòng tiền
  - Thiếu giao hàng → không biết đơn đã đến tay khách chưa
  - Thiếu bảng giá → mất thời gian nhập giá tay mỗi lần tạo đơn

### Kết luận Production Readiness

| Kịch bản | Ready? | Điều kiện |
|---|---|---|
| MVP demo / POC | ✅ Có thể | Cho investor hoặc khách hàng xem |
| Data collection phase | ✅ Có thể | Chỉ dùng store management + telesale |
| Internal testing (3-5 users) | ⚠️ Có thể | Fix tests trước, dùng thử inventory |
| Production thực tế (>20 users) | ❌ **Chưa** | Cần Phase 1+2+3 |
| Triển khai cho NPP quy mô >100 khách | ❌ **Chưa** | Cần tất cả phase + TypeScript + CI/CD |

---

## 7. Ưu Tiên Cụ Thể — Theo Mức Độ Impact/Effort

```
Impact
  ↑
  │  [Công nợ]           [Báo cáo]
  │    P1 🔴                P4 ⚪
  │       [Bảng giá]        [Giao hàng]
  │         P2 🟢              P3 🔵
  │           [Fix tests] [E2E] [DB indexes]
  │             P0 🔴       P0 🔴   P0 🔴
  │  [Store Mgmt]    →        [Full DMS]
  │    already done            ~3-4 tháng
  └──────────────────────────────────────────→ Effort
```

### Top 3 ưu tiên ngay lập tức:

| # | Hạng mục | Lý do | Thời gian |
|---|---|---|---|
| 1 | Fix tests + DB indexes + E2E cho inventory | Không thể phát triển trên nền móng yếu | ~1 tuần |
| 2 | **Công nợ & Thu tiền (AR)** | Module quan trọng nhất còn thiếu — NPP không thể vận hành nếu không biết khách nợ bao nhiêu | ~2-3 tuần |
| 3 | **Bảng giá & Khuyến mãi** | Giúp telesale bán hàng nhanh hơn, chuẩn hóa giá | ~2-3 tuần |

### Khuyến nghị chiến lược:

> **"Làm cho đúng, rồi mới làm cho đầy đủ."**
>
> Hiện tại hệ thống đã có skeleton tốt cho store management và telesale. Đây là nền tảng vững chắc. Tuy nhiên, để vận hành một NPP thực sự, cần tập trung vào **Công nợ** trước tiên — đây là module không thể thiếu, ảnh hưởng trực tiếp đến dòng tiền và rủi ro kinh doanh. Sau đó là **Bảng giá** và **Giao hàng**.
>
> Không nên thêm tính năng mới (VD: marketing automation, loyalty) cho đến khi 3 module cốt lõi này hoàn thành và test suite xanh.

---

## Phụ Lục: So Sánh Với Đối Thủ

| Module | Sapo | KiotViet | Haravan | Hà Công (hiện tại) | Hà Công (target sau 6 tháng) |
|---|---|---|---|---|---|
| Khách hàng + Map | ✅ | ❌ | ❌ | ✅ **Vượt trội** | ✅ |
| Telesale CRM | ❌ | ❌ | ❌ | ✅ **Độc đáo** | ✅ |
| Kho + Đơn hàng | ✅ | ✅ | ✅ | ⚠️ MVP | ✅ |
| Công nợ | ✅ | ✅ | ✅ | ❌ | ✅ P1 |
| Bảng giá | ✅ | ✅ | ✅ | ❌ | ✅ P2 |
| Giao hàng | ✅ | ✅ | ✅ | ❌ | ✅ P3 |
| Báo cáo | ✅ | ✅ | ✅ | ⚠️ Sơ sài | ✅ P4 |
| Map & Tuyến đường | ❌ | ❌ | ❌ | ✅ **Vượt trội** | ✅ |

**Lợi thế cạnh tranh của Hà Công:** Map + Telesale CRM — không đối thủ DMS nào ở Việt Nam có. Nếu hoàn thiện các module còn lại, Hà Công có thể là DMS khác biệt nhất thị trường.
