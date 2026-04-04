# ðŸŽ¨ Design System - StoreVis

## NguyÃªn Táº¯c Æ¯u TiÃªn

> **á»¨ng dá»¥ng dÃ nh cho ngÆ°á»i cÃ³ thá»ƒ máº¯t kÃ©m.** Má»i thiáº¿t káº¿ pháº£i Æ°u tiÃªn:
> - Font tá»‘i thiá»ƒu **16px** cho text phá»¥, **18px** cho ná»™i dung chÃ­nh
> - TÆ°Æ¡ng pháº£n cao (khÃ´ng dÃ¹ng gray nháº¡t cho text)
> - NÃºt báº¥m lá»›n (tá»‘i thiá»ƒu 44px height)
> - KhÃ´ng dÃ¹ng `text-xs` hay `text-[11px]` cho thÃ´ng tin quan trá»ng

---

## Typography

| Cáº¥p | Class | px (mobile 19px base) |
|---|---|---|
| H1 trang | `text-xl font-bold` | ~23px |
| H2 section | `text-lg font-semibold` | ~21px |
| H3 card title | `text-base font-semibold` | 19px âœ… |
| Body text | `text-base` | 19px âœ… |
| Text phá»¥ | `text-gray-400` | 19px âœ… |
| Label nhá» | `text-sm` | ~16px (min cháº¥p nháº­n Ä‘Æ°á»£c) |
| âŒ KhÃ´ng dÃ¹ng | `text-xs`, `text-[11px]` | <14px â€” vi pháº¡m |

**Base font**: `globals.css` â†’ `font-size: 19px` (mobile), `21px` (â‰¥640px)

---

### Color Palette (Default Dark Mode)

Dá»± Ã¡n sá»­ dá»¥ng **Dark Mode duy nháº¥t**. KhÃ´ng cÃ³ cháº¿ Ä‘á»™ Light Mode.

```css
--background: #0a0a0a;
--foreground: #ededed;
```

### MÃ u Semantic

| Má»¥c Ä‘Ã­ch | GiÃ¡ trá»‹ (Dark) | MÃ´ táº£ |
|---|---|---|
| Background | `bg-black` | Ná»n toÃ n trang |
| Card surface | `bg-gray-950` | Bá» máº·t card, modal |
| Border | `border-gray-800` | ÄÆ°á»ng viá»n ngÄƒn cÃ¡ch |
| **Text chÃ­nh** | `text-gray-100` | Ná»™i dung quan trá»ng |
| **Text phá»¥ (min)** | `text-gray-400` | ChÃº thÃ­ch, thÃ´ng tin phá»¥ |
| **âš ï¸ KhÃ´ng dÃ¹ng** | `text-gray-600` | QuÃ¡ tá»‘i trÃªn ná»n Ä‘en |
| Primary action | `bg-gray-50 text-gray-900` | NÃºt báº¥m ná»•i báº­t (máº·c Ä‘á»‹nh) |
| Success | `bg-green-950/30` | ThÃ´ng bÃ¡o thÃ nh cÃ´ng |
| Warning | `bg-amber-950/30` | Cáº£nh bÃ¡o |
| Error | `bg-red-950/30` | Lá»—i |
| Active nav mobile | `text-blue-400` | Tab Ä‘ang chá»n |
| Step/Tag active | `bg-blue-600` | Tráº¡ng thÃ¡i Ä‘ang chá»n |
| Step/Tag inactive | `bg-gray-800 border-gray-700` | Tráº¡ng thÃ¡i chÆ°a chá»n (cá»‘ Ä‘á»‹nh) |

---

## Layout

- **Max-width**: `max-w-screen-md mx-auto` (768px)
- **Padding**: `px-3 sm:px-4` | `py-3 sm:py-4`
- **Navbar height**:
  - Desktop top nav: `h-12` (48px)
  - Mobile bottom tab: `h-14` (56px)
- **Page content height** (trá»« navbar): `h-[calc(100dvh-3.5rem)]`
- **iOS safe area**: `.safe-area-bottom { padding-bottom: env(safe-area-inset-bottom) }`
- **á»”n Ä‘á»‹nh layout desktop**: dÃ¹ng `scrollbar-gutter: stable` trÃªn `html` Ä‘á»ƒ trÃ¡nh xÃª dá»‹ch khi Ä‘á»•i trang cÃ³/khÃ´ng cÃ³ scrollbar

---

### Desktop (â‰¥ 640px)
- Sticky top: `bg-slate-950/82 backdrop-blur-xl`
- Brand giá»¯ nguyÃªn bÃªn trÃ¡i, nav links giá»¯ nguyÃªn bÃªn pháº£i
- Tab active: chá»‰ sÃ¡ng chá»¯/icon + váº¡ch máº£nh phÃ­a dÆ°á»›i, khÃ´ng dÃ¹ng ná»n ná»•i báº­t
- Tab inactive: `text-slate-300`, hover sÃ¡ng nháº¹, spacing gá»n
- Admin nav: hiá»ƒn thá»‹ **badge sá»‘ lÆ°á»£ng** cho má»¥c **XÃ¡c thá»±c** vÃ  **BÃ¡o cÃ¡o** (pending).

### Mobile (< 640px)
- Fixed bottom tab bar: `bg-gray-950/95 backdrop-blur-md border-t border-gray-800`
- Icon **w-5 h-5** + label `text-[9px]`
- Active: `text-blue-400`
- Create/Edit form: nÃºt hÃ nh Ä‘á»™ng chÃ­nh (Tiáº¿p theo/LÆ°u) dÃ¹ng **mobile fixed action bar** náº±m ngay **trÃªn** bottom tab bar Ä‘á»ƒ luÃ´n hiá»ƒn thá»‹; ná»™i dung form cáº§n `pb-32` Ä‘á»ƒ trÃ¡nh bá»‹ che.
- Admin tab: hiá»ƒn thá»‹ **badge sá»‘ lÆ°á»£ng** (pending) trong tab **Duyá»‡t** vÃ  **BÃ¡o cÃ¡o**.

---

### Button
```
default: bg-gray-50 text-gray-900 h-11 px-6 (Ná»•i báº­t trÃªn ná»n tá»‘i)
secondary: bg-gray-800 text-gray-50 h-11 px-6
sm:      h-7 px-3 text-xs
lg:      h-12 px-8
outline: border border-gray-700 text-gray-100 hover:bg-gray-800
ghost:   hover:bg-gray-800 text-gray-100
link:    text-gray-50 underline
```
- NÃºt **ÄÄƒng xuáº¥t**: `variant="outline" text-red-400 border-red-900/50` (cÃ³ viá»n Ä‘á» máº£nh).
- NÃºt hÃ nh Ä‘á»™ng chÃ­nh trong form: `h-11` (44px) hoáº·c `h-12` (48px)
- NÃºt FAB GPS trÃªn báº£n Ä‘á»“: `h-10 w-10 rounded-full`

### Input
- `h-11 rounded-xl border border-gray-700 bg-gray-900 text-gray-100 px-3`
- **Font â‰¥ 16px báº¯t buá»™c** Ä‘á»ƒ trÃ¡nh iOS auto-zoom

### Search Panel (`/`)
- NÃºt `Lá»c` náº±m bÃªn pháº£i Ã´ tÃ¬m kiáº¿m
- TrÃªn mobile, panel lá»c Æ°u tiÃªn gá»n:
  - `Quáº­n / Huyá»‡n` vÃ  `XÃ£ / PhÆ°á»ng` dÃ¹ng `select` Ä‘Æ¡n
  - CÃ¡c nhÃ³m filter chá»n nhiá»u hiá»ƒn thá»‹ dáº¡ng lÆ°á»›i `2 cá»™t`
  - Panel cÃ³ `max-height` vÃ  tá»± cuá»™n bÃªn trong, khÃ´ng Ä‘Æ°á»£c kÃ©o ngang
  - Footer thao tÃ¡c (`XÃ³a lá»c`, `Thu gá»n`) pháº£i giá»¯ Ä‘Æ°á»£c má»™t hÃ ng chá»¯ trÃªn desktop

### Import Preview (`/store/import`)
- DÃ¹ng bá»‘ cá»¥c 1 cá»™t, `max-w-screen-md`, giá»‘ng cÃ¡c mÃ n admin khÃ¡c
- Pháº§n Ä‘áº§u mÃ n cÃ³ 2 CTA rÃµ rÃ ng:
  - `Táº£i file máº«u`
  - `Chá»n file CSV`
- Preview tá»«ng dÃ²ng pháº£i dá»… quÃ©t:
  - tÃªn store ná»•i báº­t báº±ng `text-base font-semibold`
  - Ä‘á»‹a chá»‰ vÃ  metadata dÃ¹ng `text-sm`
  - tráº¡ng thÃ¡i dÃ¹ng badge mÃ u rÃµ: xanh / vÃ ng / Ä‘á»
- Danh sÃ¡ch lá»—i vÃ  nghi trÃ¹ng pháº£i tÃ¡ch thÃ nh tá»«ng block riÃªng, khÃ´ng dá»“n thÃ nh má»™t Ä‘oáº¡n dÃ i khÃ³ Ä‘á»c
- CÃ¡c sá»‘ liá»‡u tá»•ng quan (`Tá»•ng dÃ²ng`, `Sáºµn sÃ ng nháº­p`, `Nghi trÃ¹ng`, `Lá»—i dá»¯ liá»‡u`) hiá»ƒn thá»‹ dáº¡ng card ngáº¯n á»Ÿ Ä‘áº§u preview

### Card
- `rounded-xl border border-gray-800 bg-gray-950`

### Dialog/Modal
- Content: `rounded-2xl bg-gray-950 max-h-[90vh] border border-gray-800`

### Toast/Msg (components/ui/msg.jsx)
- Fixed top bar, auto-hide sau 2500ms
- success/error/info/warning

---

## Trang Báº£n Äá»“ (`/map`) â€” Dark Theme Cá»‘ Äá»‹nh

Trang map luÃ´n dark (khÃ´ng theo system preference):
- Background: `bg-slate-950 text-slate-100`
- Search overlay: `bg-slate-900/80 backdrop-blur-md ring-1 ring-white/15`
- Search button: `bg-sky-500 text-slate-950`
- Filter district active: `bg-sky-500/20 text-sky-300`
- Filter ward active: `bg-emerald-500/20 text-emerald-300`
- Filter store type active: `tÃ´ng violet`
- Floating GPS button: gÃ³c pháº£i dÆ°á»›i, `bg-slate-950/90`, viá»n `border-slate-600/70`, hover `sky`
- Hiá»ƒn thá»‹ thÃªm cháº¥m xanh vá»‹ trÃ­ ngÆ°á»i dÃ¹ng trÃªn báº£n Ä‘á»“

### Store Detail Modal
- `Loáº¡i cá»­a hÃ ng` hiá»ƒn thá»‹ phÃ­a trÃªn `TÃªn cá»­a hÃ ng`
- DÃ¹ng `text-sm` hoáº·c tÆ°Æ¡ng Ä‘Æ°Æ¡ng Ä‘á»ƒ hierarchy rÃµ rÃ ng, khÃ´ng cáº¡nh tranh vá»›i title

### Form Táº¡o Cá»­a HÃ ng â€” Loáº¡i Cá»­a HÃ ng
- Khá»‘i `Loáº¡i cá»­a hÃ ng` tÃ¡ch riÃªng khá»i `TÃªn cá»­a hÃ ng`
- DÃ¹ng grid `2 cá»™t` cáº£ trÃªn mobile Ä‘á»ƒ hiá»ƒn thá»‹ nhanh toÃ n bá»™ loáº¡i
- Tráº¡ng thÃ¡i Ä‘ang chá»n dÃ¹ng tÃ´ng xanh biá»ƒn (`border-blue-500 bg-blue-500/10 text-blue-100`)

### Form Táº¡o Cá»­a HÃ ng â€” BÆ°á»›c 3 / Google Maps Link
- TrÃªn mobile, náº¿u lÃ  admin thÃ¬ pháº§n dÃ¡n **Google Maps link** hiá»ƒn thá»‹ máº·c Ä‘á»‹nh ngay dÆ°á»›i báº£n Ä‘á»“
- KhÃ´ng dÃ¹ng khung bao riÃªng cho pháº§n nÃ y; chá»‰ giá»¯ label, input, nÃºt hÃ nh Ä‘á»™ng vÃ  dÃ²ng hÆ°á»›ng dáº«n
- TrÃªn desktop, pháº§n dÃ¡n link váº«n hiá»ƒn thá»‹ sáºµn dÆ°á»›i báº£n Ä‘á»“

### Báº£n Ä‘á»“ trong Form (Create/Edit) â€” Light Theme Exception
Äá»ƒ Ä‘áº£m báº£o Ä‘á»™ rÃµ nÃ©t khi ngÆ°á»i dÃ¹ng chá»n vá»‹ trÃ­ chÃ­nh xÃ¡c:
- Sá»­ dá»¥ng prop `dark={false}` cho `StoreLocationPicker` hoáº·c `LocationPicker`.
- Báº£n Ä‘á»“ hiá»ƒn thá»‹ mÃ u sáº¯c nguyÃªn báº£n (SÃ¡ng).
- Lá»›p phá»§ khi khÃ³a báº£n Ä‘á»“ (Dim overlay) sá»­ dá»¥ng mÃ u tráº¯ng má» `rgba(255,255,255,0.55)`.
- Zoom máº·c Ä‘á»‹nh: `17`.
- MÃ n sá»­a: báº£n Ä‘á»“ **máº·c Ä‘á»‹nh khÃ³a**, cÃ³ nÃºt **Má»Ÿ khÃ³a/KhÃ³a** vÃ  **Láº¥y láº¡i vá»‹ trÃ­**.

---

## Responsive

| Breakpoint | Behavior |
|---|---|
| `<640px` | Bottom tab bar, compact padding, no autofocus |
| `â‰¥640px` | Top navbar, wider padding, autofocus input (desktop only) |
| Map sidebar | Chá»‰ khi `(hover: hover) and (pointer: fine)` |

---

## Dialog Accessibility

- Má»i `DialogContent` pháº£i cÃ³:
  - `DialogTitle`
  - `DialogDescription` hoáº·c `aria-describedby` Ä‘Æ°á»£c xá»­ lÃ½ rÃµ rÃ ng
- KhÃ´ng dÃ¹ng chá»‰ `h3` / `p` thÆ°á»ng cho dialog xÃ¡c nháº­n náº¿u thiáº¿u primitive accessibility cá»§a Radix.
- Vá»›i dialog xÃ¡c nháº­n admin:
  - title ngáº¯n, rÃµ hÃ nh Ä‘á»™ng
  - description giáº£i thÃ­ch káº¿t quáº£ cá»§a thao tÃ¡c
  - nÃºt xÃ¡c nháº­n/há»§y pháº£i dÃ¹ng tiáº¿ng Viá»‡t rÃµ nghÄ©a

## Vietnamese Copy Safety

- UI copy tiáº¿ng Viá»‡t pháº£i Ä‘Æ°á»£c lÆ°u trá»±c tiáº¿p báº±ng `UTF-8`.
- Náº¿u cÃ³ nghi ngá» lá»—i dáº¥u, Æ°u tiÃªn kiá»ƒm tra trÃªn browser trÆ°á»›c khi rewrite file.
- `.editorconfig` cá»§a repo lÃ  má»™t pháº§n cá»§a design hygiene Ä‘á»ƒ trÃ¡nh lá»‡ch encoding giá»¯a cÃ¡c editor.

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