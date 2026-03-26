# 🎨 Design System - StoreVis

## Nguyên Tắc Ưu Tiên

> **Ứng dụng dành cho người có thể mắt kém.** Mọi thiết kế phải ưu tiên:
> - Font tối thiểu **16px** cho text phụ, **18px** cho nội dung chính
> - Tương phản cao (không dùng gray nhạt cho text)
> - Nút bấm lớn (tối thiểu 44px height)
> - Không dùng `text-xs` hay `text-[11px]` cho thông tin quan trọng

---

## Typography

| Cấp | Class | px (mobile 19px base) |
|---|---|---|
| H1 trang | `text-xl font-bold` | ~23px |
| H2 section | `text-lg font-semibold` | ~21px |
| H3 card title | `text-base font-semibold` | 19px ✅ |
| Body text | `text-base` | 19px ✅ |
| Text phụ | `text-gray-400` | 19px ✅ |
| Label nhỏ | `text-sm` | ~16px (min chấp nhận được) |
| ❌ Không dùng | `text-xs`, `text-[11px]` | <14px — vi phạm |

**Base font**: `globals.css` → `font-size: 19px` (mobile), `21px` (≥640px)

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
| Active nav mobile | `text-blue-400` | Tab đang chọn |
| Step/Tag active | `bg-blue-600` | Trạng thái đang chọn |
| Step/Tag inactive | `bg-gray-800 border-gray-700` | Trạng thái chưa chọn (cố định) |

---

## Layout

- **Max-width**: `max-w-screen-md mx-auto` (768px)
- **Padding**: `px-3 sm:px-4` | `py-3 sm:py-4`
- **Navbar height**: `h-14` (56px)
- **Page content height** (trừ navbar): `h-[calc(100dvh-3.5rem)]`
- **iOS safe area**: `.safe-area-bottom { padding-bottom: env(safe-area-inset-bottom) }`

---

### Desktop (≥ 640px)
- Sticky top: `bg-black/60 backdrop-blur-md`
- Link pill active: `bg-gray-50 text-gray-900 border-transparent`
- Link pill inactive: `text-gray-400 border-gray-700 hover:bg-gray-800`
- Admin nav: hiển thị **badge số lượng** cho mục **Xác thực** và **Báo cáo** (pending).

### Mobile (< 640px)
- Fixed bottom tab bar: `bg-gray-950/95 backdrop-blur-md border-t border-gray-800`
- Icon **w-5 h-5** + label `text-[9px]`
- Active: `text-blue-400`
- Create/Edit form: nút hành động chính (Tiếp theo/Lưu) dùng **mobile fixed action bar** nằm ngay **trên** bottom tab bar để luôn hiển thị; nội dung form cần `pb-32` để tránh bị che.
- Admin tab: hiển thị **badge số lượng** (pending) trong tab **Duyệt** và **Báo cáo**.

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
- Floating GPS button: góc phải dưới, `bg-slate-950/90`, viền `border-slate-600/70`, hover `sky`

### Form Tạo Cửa Hàng — Loại Cửa Hàng
- Khối `Loại cửa hàng` tách riêng khỏi `Tên cửa hàng`
- Dùng grid `2 cột` cả trên mobile để hiển thị nhanh toàn bộ loại
- Trạng thái đang chọn dùng tông xanh biển (`border-blue-500 bg-blue-500/10 text-blue-100`)

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
| `<640px` | Bottom tab bar, compact padding, no autofocus |
| `≥640px` | Top navbar, wider padding, autofocus input (desktop only) |
| Map sidebar | Chỉ khi `(hover: hover) and (pointer: fine)` |
