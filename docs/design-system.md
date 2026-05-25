# 🎨 Design System - NPP Hà Công

## Ngôn Ngữ Thiết Kế Theo Thiết Bị

Dự án tách 2 ngôn ngữ thiết kế:

- **Mobile (<640px)**: giữ ngôn ngữ hiện tại, ưu tiên chữ lớn, nút lớn, thao tác chạm, ít mật độ.
- **Desktop (>=640px)**: dùng ngôn ngữ riêng kiểu admin/workbench, mật độ cao hơn, nhiều cột/bảng hơn, chữ gọn hơn nhưng vẫn đủ tương phản và không dưới 16px cho nội dung quan trọng.

Rule: các guideline cũ về chữ lớn và tap target là **mặc định cho mobile**. Desktop không copy nguyên layout mobile phóng to; desktop phải tận dụng chiều ngang, bảng, sidebar, toolbar, filter ngang và các khối dữ liệu dày hơn.

## Nguyên Tắc Ưu Tiên

> **Ứng dụng dành cho người có thể mắt kém.** Mọi thiết kế phải ưu tiên:
> - Font tối thiểu **16px** cho text phụ, **18px** cho nội dung chính
> - Tương phản cao (không dùng gray nhạt cho text)
> - Nút bấm lớn (tối thiểu 44px height)
> - Không dùng `text-xs` hay `text-[11px]` cho thông tin quan trọng

Áp dụng cụ thể:

- Mobile: nội dung chính ưu tiên 18-19px trở lên, nút chạm tối thiểu 44px.
- Desktop: nội dung chính có thể dùng 16-17px, bảng/danh sách có thể dày hơn; hành động chính vẫn nên cao 40-44px.

## Scrollable Lists & Tables

- Khi một danh sách/bảng tự cuộn trong panel/card, chỉ vùng list được `overflow-y-auto`; không thêm page-level scroll nếu màn hình đang dùng layout một màn.
- Header của danh sách/bảng cuộn phải được ghim bằng `sticky top-0` với `z-index` đủ cao và nền opaque theo dark theme để nội dung không chồng chữ.
- Header phải giữ text đủ tương phản và không nhỏ hơn mức typography desktop/mobile tương ứng.
- Khi tạo mới hoặc sửa list có header cột, luôn kiểm tra trạng thái dữ liệu dài hơn viewport để xác nhận header vẫn đứng yên khi cuộn.

---

## Typography Mobile

| Cấp | Class | px (mobile 19px base) |
|---|---|---|
| H1 trang | `text-xl font-bold` | ~23px |
| H2 section | `text-lg font-semibold` | ~21px |
| H3 card title | `text-base font-semibold` | 19px ✅ |
| Body text | `text-base` | 19px ✅ |
| Text phụ | `text-gray-400` | 19px ✅ |
| Label nhỏ | `text-sm` | ~16px (min chấp nhận được) |
| ❌ Không dùng | `text-xs`, `text-[11px]` | <14px — vi phạm |

**Mobile base font**: `globals.css` → `font-size: 19px` cho `<640px`.

## Typography Desktop

Desktop dùng hệ thống gọn hơn để phục vụ admin, đơn hàng, tồn kho, bảng dữ liệu:

| Cấp | Class gợi ý | px (desktop 16px base) |
|---|---|---|
| H1 trang | `text-2xl font-bold` | 24px |
| H2 section | `text-xl font-semibold` | 20px |
| H3 panel/card | `text-lg font-semibold` | 18px |
| Body text | `text-base` | 16px |
| Metadata/label | `text-sm` | 14px, chỉ dùng cho phụ trợ |
| Table cell | `text-base` hoặc `text-sm` nếu không phải thông tin trọng yếu | 16px / 14px |

Desktop không dùng `text-xs` cho dữ liệu quan trọng như giá, số lượng, tên khách hàng, tên hàng, trạng thái đơn.

---

### Color Palette (Default Dark Mode)

Dự án sử dụng **Dark Mode duy nhất**. Không có chế độ Light Mode.

```css
--background: #0a0a0a;
--foreground: #ededed;
```

### Màu Semantic

| Mục đích | Giá trị (Dark) | Mô tả |
|---|---|---|
| Background | `bg-black` | Nền toàn trang |
| Card surface | `bg-gray-950` | Bề mặt card, modal |
| Border | `border-gray-800` | Đường viền ngăn cách |
| **Text chính** | `text-gray-100` | Nội dung quan trọng |
| **Text phụ (min)** | `text-gray-400` | Chú thích, thông tin phụ |
| **⚠️ Không dùng** | `text-gray-600` | Quá tối trên nền đen |
| Primary action | `bg-gray-50 text-gray-900` | Nút bấm nổi bật (mặc định) |
| Success | `bg-green-950/30` | Thông báo thành công |
| Warning | `bg-amber-950/30` | Cảnh báo |
| Error | `bg-red-950/30` | Lỗi |
| Active nav mobile | `text-blue-400` | Tab ?"??~ang chọn |
| Step/Tag active | `bg-blue-600` | Trạng thái đang chọn |
| Step/Tag inactive | `bg-gray-800 border-gray-700` | Trạng thái chưa chọn (cố định) |

---

## Layout Mobile

- **Max-width**: `max-w-screen-md mx-auto` (768px)
- **Padding**: `px-3 sm:px-4` | `py-3 sm:py-4`
- **Navbar height**:
  - Desktop top nav: `h-12` (48px)
  - Mobile bottom tab: `h-14` (56px)
- **Page content height** (trừ navbar): `h-[calc(100dvh-3.5rem)]`
- **iOS safe area**: `.safe-area-bottom { padding-bottom: env(safe-area-inset-bottom) }`
- **Ổn định layout desktop**: dùng `scrollbar-gutter: stable` trên `html` để tránh xê dịch khi đổi trang có/không có scrollbar

---

### Desktop (≥ 640px)
- Desktop là **workbench/admin layout**, không phải mobile layout phóng to.
- Base font: `16px` ở `>=640px`, `17px` ở màn rất rộng (`>=1280px`).
- Page shell admin/order/inventory ưu tiên `max-w-6xl` hoặc `max-w-7xl`, không bị bó vào `max-w-screen-md` nếu cần bảng/danh sách.
- Sticky top nav: `bg-slate-950/82 backdrop-blur-xl`, gọn, chiều cao khoảng `48px`.
- Nội dung desktop dùng nhiều cột, bảng, filter ngang, toolbar trên cùng.
- Card/panel desktop nên gọn: `rounded-md`, border mảnh, padding `p-4` hoặc `p-5`.
- Không đặt card lồng card nếu chỉ để chia section; dùng panel/border/table row.
- Desktop có thể dùng table/list dense, nhưng giá, số lượng, trạng thái, tên khách hàng/hàng hóa vẫn phải dễ đọc.
- Admin nav hiện ưu tiên luồng vận hành thường ngày; các màn quản trị ít dùng có thể đặt trong `/account`.

### Mobile (< 640px)
- Fixed bottom tab bar: `bg-gray-950/95 backdrop-blur-md border-t border-gray-800`
- Icon **w-5 h-5** + label `text-[9px]`
- Active: `text-blue-400`
- Create/Edit form: nút hành động chính (Tiếp theo/Lưu) dùng **mobile fixed action bar** nằm ngay **trên** bottom tab bar để luôn hiển thị; nội dung form cần `pb-32` để tránh bị che.
- Mobile nav giữ ít mục, ưu tiên thao tác thường ngày. Các màn quản trị ít dùng có thể nằm trong `/account`.

Mobile tiếp tục dùng ngôn ngữ cũ: màn một cột, vùng bấm lớn, text lớn, ít thông tin mỗi hàng, ưu tiên thao tác tuần tự.

---

### Button
```
default: bg-gray-50 text-gray-900 h-11 px-6 (Nổi bật trên nền tối)
secondary: bg-gray-800 text-gray-50 h-11 px-6
sm:      h-7 px-3 text-xs
lg:      h-12 px-8
outline: border border-gray-700 text-gray-100 hover:bg-gray-800
ghost:   hover:bg-gray-800 text-gray-100
link:    text-gray-50 underline
```
- Nút **Đăng xuất**: `variant="outline" text-red-400 border-red-900/50` (có viền đỏ mảnh).
- Nút hành động chính trong form: `h-11` (44px) hoặc `h-12` (48px)
- Nút FAB GPS trên bản đồ: `h-10 w-10 rounded-full`

### Input
- `h-11 rounded-xl border border-gray-700 bg-gray-900 text-gray-100 px-3`
- **Font ≥ 16px bắt buộc** để tránh iOS auto-zoom

### Search Panel (`/`)
- Nút `Lọc` nằm bên phải ô tìm kiếm
- Trên mobile, panel lọc ưu tiên gọn:
  - `Quận / Huyện` và `Xã / Phường` dùng `select` đơn
  - Các nhóm filter chọn nhiều hiển thị dạng lưới `2 cột`
  - Panel có `max-height` và tự cuộn bên trong, không được kéo ngang
  - Footer thao tác (`Xóa lọc`, `Thu gọn`) phải giữ được một hàng chữ trên desktop

### Import Preview (`/store/import`)
- Dùng bố cục 1 cột, `max-w-screen-md`, giống các màn admin khác
- Phần đầu màn có 2 CTA rõ ràng:
  - `Tải file mẫu`
  - `Chọn file CSV`
- Preview từng dòng phải dễ quét:
  - tên store nổi bật bằng `text-base font-semibold`
  - địa chỉ và metadata dùng `text-sm`
  - trạng thái dùng badge màu rõ: xanh / vàng / đỏ
- Danh sách lỗi và nghi trùng phải tách thành từng block riêng, không dồn thành một đoạn dài khó đọc
- Các số liệu tổng quan (`Tổng dòng`, `Sẵn sàng nhập`, `Nghi trùng`, `Lỗi dữ liệu`) hiển thị dạng card ngắn ở đầu preview

### Card
- `rounded-xl border border-gray-800 bg-gray-950`

### Dialog/Modal
- Content: `rounded-2xl bg-gray-950 max-h-[90vh] border border-gray-800`

### Toast/Msg (components/ui/msg.jsx)
- Fixed top bar, auto-hide sau 2500ms
- success/error/info/warning

---

## Trang Bản Đồ (`/map`) — Dark Theme Cố Định

Trang map luôn dark (không theo system preference):
- Background: `bg-slate-950 text-slate-100`
- Search overlay: `bg-slate-900/80 backdrop-blur-md ring-1 ring-white/15`
- Search button: `bg-sky-500 text-slate-950`
- Filter district active: `bg-sky-500/20 text-sky-300`
- Filter ward active: `bg-emerald-500/20 text-emerald-300`
- Filter store type active: `tông violet`
- Floating GPS button: góc phải dưới, `bg-slate-950/90`, viền `border-slate-600/70`, hover `sky`
- Hiển thị thêm chấm xanh vị trí người dùng trên bản đồ

### `/map` Interaction Updates
- Nút hướng trên `/map`: khi bật sẽ xoay bản đồ theo hướng người dùng, khóa kéo bản đồ, và vẫn giữ zoom; khi tắt thì trả về thao tác bình thường
- Dữ liệu vị trí và hướng người dùng trên `/map` được cập nhật định kỳ mỗi 3 giây khi màn hình đang mở
- Modal tuyến đường trên mobile phải nằm trên cụm nút điều hướng dưới cùng và không bị khuyết phần trên
- Nút ẩn/hiện cửa hàng ngoài tuyến chỉ còn đặt trong modal tuyến đường
- Nút vị trí không hiển thị loading, chỉ còn hành vi quay về vị trí hiện tại

### Store Detail Modal
- `Loại cửa hàng` hiển thị phía trên `Tên cửa hàng`
- Dùng `text-sm` hoặc tương đương để hierarchy rõ ràng, không cạnh tranh với title

### Màn Tạo/Form — Desktop Pattern
Màn `/store/create` là mẫu chuẩn cho các màn tạo mới hoặc form tuần tự trên desktop.

- Dùng layout tập trung, không kéo rộng toàn màn: ưu tiên `max-w-screen-md` hoặc gần tương đương khi form là luồng nhập tuần tự.
- Nền trang giữ `bg-black`; nội dung nằm trong một cột chính, khoảng cách đều `space-y-3` đến `space-y-5`, không cần thêm hero/card trang trí.
- Step indicator nằm trên form để người dùng biết đang ở bước nào; không đặt thêm heading lớn nếu step đã đủ ngữ cảnh.
- Field quan trọng dùng `Label` rõ ràng, `Input` cao khoảng `h-11`, chữ `text-base`, label `text-sm` chỉ để phân cấp.
- Nhóm lựa chọn như `Loại cửa hàng` dùng button grid gọn, trạng thái active có border/nền xanh nhẹ; tránh dropdown nếu số lựa chọn ít và cần quét nhanh.
- CTA desktop nằm trong luồng form ở cuối bước, không fixed; dùng hàng ngang `sm:flex` với nút quay lại dạng icon và nút chính `flex-1`.
- Các thông báo trạng thái trong bước dùng panel nhỏ, viền rõ, màu semantic nhẹ; không dùng modal/toast cho trạng thái tạm thời trong form.
- Bản đồ trong form giữ chiều cao lớn (`~65vh`) để chọn vị trí chính xác; trên desktop trường dán Google Maps link hiển thị ngay dưới bản đồ.
- Khi cần màn form desktop mới, ưu tiên tái dùng `StoreStepFormLayout` hoặc mô phỏng đúng cấu trúc của nó trước khi tạo layout mới.
- Chỉ dùng layout desktop rộng nhiều cột khi form cần so sánh dữ liệu song song; với flow nhập tuần tự, giữ cột giữa như `/store/create` để thao tác ổn định và ít phân tán.

### Form Tạo Cửa Hàng — Loại Cửa Hàng
- Khối `Loại cửa hàng` tách riêng khỏi `Tên cửa hàng`
- Dùng grid `2 cột` cả trên mobile để hiển thị nhanh toàn bộ loại
- Trạng thái đang chọn dùng tông xanh biển (`border-blue-500 bg-blue-500/10 text-blue-100`)

### Form Tạo Cửa Hàng — Bước 3 / Google Maps Link
- Trên mobile, nếu là admin thì phần dán **Google Maps link** hiển thị mặc định ngay dưới bản đồ
- Không dùng khung bao riêng cho phần này; chỉ giữ label, input, nút hành động và dòng hướng dẫn
- Trên desktop, phần dán link vẫn hiển thị sẵn dưới bản đồ

### Bản đồ trong Form (Create/Edit) — Light Theme Exception
Để đảm bảo độ rõ nét khi người dùng chọn vị trí chính xác:
- Sử dụng prop `dark={false}` cho `StoreLocationPicker` hoặc `LocationPicker`.
- Bản đồ hiển thị màu sắc nguyên bản (Sáng).
- Lớp phủ khi khóa bản đồ (Dim overlay) sử dụng màu trắng mờ `rgba(255,255,255,0.55)`.
- Zoom mặc định: `17`.
- Màn sửa: bản đồ **mặc định khóa**, có nút **Mở khóa/Khóa** và **Lấy lại vị trí**.

---

## Responsive

| Breakpoint | Behavior |
|---|---|
| `<640px` | Mobile language: bottom tab bar, large text, touch-first controls, no autofocus |
| `≥640px` | Desktop workbench language: top navbar, 16px base, wider content, denser tables/forms, autofocus allowed |
| Map sidebar | Chỉ khi `(hover: hover) and (pointer: fine)` |

---

## Dialog Accessibility

- Mọi `DialogContent` phải có:
  - `DialogTitle`
  - `DialogDescription` hoặc `aria-describedby` được xử lý rõ ràng
- Không dùng chỉ `h3` / `p` thường cho dialog xác nhận nếu thiếu primitive accessibility của Radix.
- Với dialog xác nhận admin:
  - title ngắn, rõ hành động
  - description giải thích kết quả của thao tác
  - nút xác nhận/hủy phải dùng tiếng Việt rõ nghĩa

## Vietnamese Copy Safety

- UI copy tiếng Việt phải được lưu trực tiếp bằng `UTF-8`.
- Nếu có nghi ngờ lỗi dấu, ưu tiên kiểm tra trên browser trước khi rewrite file.
- `.editorconfig` của repo là một phần của design hygiene để tránh lệch encoding giữa các editor.

---
## Search Page Copy Rules

- Các label điều hướng và tìm kiếm trên navbar/search page là copy lõi, không được để lỗi dấu tiếng Việt.
- Các nhãn sau cần giữ nguyên chính tả khi chỉnh sửa UI:
  - `Tìm kiếm`
  - `Lọc`
  - `Mở bộ lọc chi tiết`
  - `Quận / Huyện`
  - `Xã / Phường`
  - `Chi tiết dữ liệu`
  - `Không có vị trí`
  - `Tiềm năng`
  - `Xóa lọc`
  - `Thu gọn`
  - `Không tìm thấy cửa hàng`
  - `Hết kết quả`
- Sau khi sửa copy tiếng Việt ở các khu vực này, cần kiểm tra trực tiếp trên UI hoặc ít nhất qua diff UTF-8 sạch, không chỉ dựa vào terminal Windows.
