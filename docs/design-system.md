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
| Text phụ | `text-base text-gray-600 dark:text-gray-400` | 19px ✅ |
| Label nhỏ | `text-sm` | ~16px (min chấp nhận được) |
| ❌ Không dùng | `text-xs`, `text-[11px]` | <14px — vi phạm |

**Base font**: `globals.css` → `font-size: 19px` (mobile), `21px` (≥640px)

---

## Color Palette

### Light Mode
```
--background: #ffffff
--foreground: #171717
```

### Dark Mode
```
--background: #0a0a0a
--foreground: #ededed
```

### Màu Semantic

| Mục đích | Light | Dark |
|---|---|---|
| Background | `bg-gray-50` | `bg-black` |
| Card surface | `bg-white` | `bg-gray-950` |
| Border | `border-gray-200` | `border-gray-800` |
| **Text chính** | `text-gray-900` | `text-gray-100` |
| **Text phụ (min)** | `text-gray-600` | `text-gray-400` |
| **⚠️ Không dùng** | `text-gray-400` (light) | dễ bị mờ |
| Primary action | `bg-gray-900 text-white` | `bg-gray-100 text-gray-900` |
| Success | `bg-green-50 border-green-100` | `bg-green-950/30` |
| Warning | `bg-amber-50 border-amber-100` | `bg-amber-950/30` |
| Error | `bg-red-50 border-red-200 text-red-700` | `bg-red-950/30` |
| Active nav mobile | `text-blue-600` | `text-blue-400` |

---

## Layout

- **Max-width**: `max-w-screen-md mx-auto` (768px)
- **Padding**: `px-3 sm:px-4` | `py-3 sm:py-4`
- **Navbar height**: `h-14` (56px)
- **Page content height** (trừ navbar): `h-[calc(100dvh-3.5rem)]`
- **iOS safe area**: `.safe-area-bottom { padding-bottom: env(safe-area-inset-bottom) }`

---

## Navigation

### Desktop (≥ 640px)
- Sticky top: `bg-white/70 backdrop-blur-md`
- Link pill active: `bg-gray-900 text-white border-transparent`
- Link pill inactive: `text-gray-600 border-gray-300 hover:bg-gray-50`

### Mobile (< 640px)
- Fixed bottom tab bar: `bg-white/95 backdrop-blur-md border-t`
- Icon **w-5 h-5** + label `text-[9px]` (chú ý: label nhỏ ở đây là acceptable vì chỉ supplementary)
- Active: `text-blue-600`

---

## UI Components (Atoms)

### Button
```
default: bg-gray-900 text-white h-9 px-4
sm:      h-7 px-3 text-xs
lg:      h-11 px-8
outline: border border-gray-300
ghost:   hover:bg-gray-100
```
- Nút hành động chính trong form: `h-11` (44px) hoặc `h-12` (48px)

### Input
- `h-9 rounded-md border border-gray-300 text-base px-3`
- **Font ≥ 16px bắt buộc** để tránh iOS auto-zoom

### Card
- `rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950`

### Dialog/Modal
- Content: `rounded-2xl bg-white dark:bg-gray-950 max-h-[90vh]`

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

### Custom Map Markers (Canvas)
- Circle bg: `#1f2937` | border: white
- Label bg: `rgba(255,255,255,0.94)` | text: `#0f172a`
- Highlighted: ring `#38bdf8` (sky-400)

---

## Responsive

| Breakpoint | Behavior |
|---|---|
| `<640px` | Bottom tab bar, compact padding, no autofocus |
| `≥640px` | Top navbar, wider padding, autofocus input (desktop only) |
| Map sidebar | Chỉ khi `(hover: hover) and (pointer: fine)` |
