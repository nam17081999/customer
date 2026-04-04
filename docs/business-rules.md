# ðŸ“‹ Quy Táº¯c Nghiá»‡p Vá»¥ - StoreVis

## 1. Tráº¡ng ThÃ¡i Cá»­a HÃ ng

| Tráº¡ng thÃ¡i | `active` | `deleted_at` | MÃ´ táº£ |
|---|---|---|---|
| Chá» duyá»‡t | `false` | `null` | User thÆ°á»ng táº¡o |
| ÄÃ£ xÃ¡c thá»±c | `true` | `null` | Admin duyá»‡t |
| ÄÃ£ xÃ³a | any | timestamp | Soft-deleted, áº©n hoÃ n toÃ n |

---

## 2. Táº¡o Cá»­a HÃ ng â€” 3 BÆ°á»›c

### BÆ°á»›c 1: TÃªn
- Chá»n **loáº¡i cá»­a hÃ ng** á»Ÿ má»™t khá»‘i riÃªng phÃ­a trÃªn Ã´ tÃªn
- Loáº¡i hiá»ƒn thá»‹ dáº¡ng nÃºt chá»n, mobile hiá»ƒn thá»‹ **2 loáº¡i / 1 hÃ ng**
- Máº·c Ä‘á»‹nh loáº¡i = `Táº¡p hÃ³a`
- GiÃ¡ trá»‹ loáº¡i láº¥y tá»« `STORE_TYPE_OPTIONS` trong `lib/constants.js`
- Báº¯t buá»™c nháº­p tÃªn
- Tá»± Ä‘á»™ng convert sang **Title Case VI** (`toTitleCaseVI()`)
- **Kiá»ƒm tra trÃ¹ng tÃªn** (báº¯t buá»™c trÆ°á»›c khi sang bÆ°á»›c 2):
  - `findNearbySimilarStores()`: bÃ¡n kÃ­nh 100m, Ã­t nháº¥t 1 tá»« khÃ³a trÃ¹ng
  - `findGlobalExactNameMatches()`: toÃ n há»‡ thá»‘ng, táº¥t cáº£ tá»« khÃ³a trÃ¹ng
  - `mergeDuplicateCandidates(near, global, lat, lng)`: gá»™p 2 nguá»“n vÃ  bá»• sung khoáº£ng cÃ¡ch cho cáº£ match toÃ n há»‡ thá»‘ng náº¿u cÃ³ tá»a Ä‘á»™
  - Náº¿u cÃ³ â†’ cáº£nh bÃ¡o + cáº§n xÃ¡c nháº­n "Váº«n táº¡o" má»›i tiáº¿p tá»¥c

### BÆ°á»›c 2: ThÃ´ng Tin
- **Báº¯t buá»™c**: Quáº­n/Huyá»‡n + XÃ£/PhÆ°á»ng (tá»« danh sÃ¡ch `DISTRICT_WARD_SUGGESTIONS`)
- **TÃ¹y chá»n**: Äá»‹a chá»‰ chi tiáº¿t, SÄT, Ghi chÃº, áº¢nh
- SÄT: format VN (`0xxx` hoáº·c `+84xxx`, 9-10 sá»‘ sau prefix)
- áº¢nh: JPEG/PNG/WebP â‰¤10MB, nÃ©n vá» â‰¤1MB trÆ°á»›c upload
- Khi bÆ°á»›c 1 Ä‘Ã£ láº¥y Ä‘Æ°á»£c GPS Ä‘á»ƒ kiá»ƒm tra trÃ¹ng, há»‡ thá»‘ng sáº½ tá»± prefill quáº­n/huyá»‡n + xÃ£/phÆ°á»ng cá»§a cá»­a hÃ ng gáº§n nháº¥t ngay trong ná»n, báº¥t ká»ƒ káº¿t quáº£ trÃ¹ng hay khÃ´ng trÃ¹ng; sang bÆ°á»›c 2 thÃ¬ field Ä‘Ã£ sáºµn sÃ ng náº¿u chÆ°a bá»‹ nháº­p tay
- CÃ³ nÃºt **LÆ°u luÃ´n** ngay táº¡i bÆ°á»›c 2 chá»‰ khi lÃ  admin hoáº·c telesale:
  - váº«n báº¯t buá»™c `Quáº­n/Huyá»‡n` + `XÃ£/PhÆ°á»ng`
  - **báº¯t buá»™c thÃªm sá»‘ Ä‘iá»‡n thoáº¡i há»£p lá»‡**
  - trÆ°á»›c khi lÆ°u pháº£i há»i xÃ¡c nháº­n viá»‡c lÆ°u cá»­a hÃ ng **khÃ´ng cÃ³ vá»‹ trÃ­**
  - khi lÆ°u theo nhÃ¡nh nÃ y, store Ä‘Æ°á»£c táº¡o vá»›i `latitude = null`, `longitude = null`

### BÆ°á»›c 3: Vá»‹ TrÃ­
- Auto láº¥y GPS khi vÃ o bÆ°á»›c 3
- User cÃ³ thá»ƒ: kÃ©o map / paste Google Maps link / láº¥y GPS má»›i
- Náº¿u lÃ  admin vÃ  Ä‘ang dÃ¹ng mobile, pháº§n dÃ¡n **Google Maps link** hiá»ƒn thá»‹ máº·c Ä‘á»‹nh ngay dÆ°á»›i báº£n Ä‘á»“
- **Æ¯u tiÃªn tá»a Ä‘á»™**: edited map > GPS ban Ä‘áº§u > GPS hiá»‡n táº¡i

### Khi Submit
1. Duplicate check láº§n cuá»‘i báº±ng tá»a Ä‘á»™ final
2. Upload áº£nh â†’ `imageFilename`
3. INSERT Supabase (`active = isAdmin`, lÆ°u thÃªm `store_type`)
4. `appendStoreToCache(newStore)`
5. Ngoáº¡i lá»‡: náº¿u **LÆ°u luÃ´n** á»Ÿ bÆ°á»›c 2 thÃ¬ bá» duplicate check cuá»‘i theo tá»a Ä‘á»™, vÃ¬ store chÆ°a cÃ³ vá»‹ trÃ­

---

## 2b. Chá»‰nh sá»­a & BÃ¡o cÃ¡o (Edit/Report)

### Chá»‰nh sá»­a (Admin)
- **Báº¯t buá»™c**: Quáº­n/Huyá»‡n + XÃ£/PhÆ°á»ng khi **chá»‰nh sá»­a**.
- LÆ°u xong: Æ°u tiÃªn cáº­p nháº­t cache local rá»“i dispatch `storevis:stores-changed`.
- Náº¿u má»Ÿ `/store/edit/[id]?mode=supplement`:
  - luÃ´n báº¯t Ä‘áº§u tá»« **bÆ°á»›c 1**
  - chá»‰ cho nháº­p dá»¯ liá»‡u cÃ²n thiáº¿u, dá»¯ liá»‡u Ä‘Ã£ cÃ³ thÃ¬ bá»‹ khÃ³a
  - náº¿u store chÆ°a cÃ³ vá»‹ trÃ­ thÃ¬ flow cÃ³ **3 bÆ°á»›c**
  - náº¿u store Ä‘Ã£ cÃ³ vá»‹ trÃ­ thÃ¬ flow chá»‰ cÃ³ **2 bÆ°á»›c**, bÆ°á»›c 2 hoÃ n thÃ nh luÃ´n
  - khi vÃ o **bÆ°á»›c 3** cá»§a store chÆ°a cÃ³ vá»‹ trÃ­, trang sáº½ tá»± láº¥y GPS hiá»‡n táº¡i má»™t láº§n
  - náº¿u lÃ  admin Ä‘Ã£ Ä‘Äƒng nháº­p thÃ¬ submit update trá»±c tiáº¿p `stores`
  - náº¿u chÆ°a Ä‘Äƒng nháº­p thÃ¬ submit táº¡o `store_reports.report_type = 'edit'` Ä‘á»ƒ admin duyá»‡t

### BÃ¡o cÃ¡o (User) â€” trong `StoreDetailModal`
User cÃ³ 2 lá»±a chá»n:

1) **Sá»­a thÃ´ng tin** (gá»­i Ä‘á» xuáº¥t chá»‰nh sá»­a)
   - **Báº¯t buá»™c**: Quáº­n/Huyá»‡n + XÃ£/PhÆ°á»ng.
   - CÃ¡c trÆ°á»ng gá»­i: `name`, `address_detail`, `ward`, `district`, `phone`, `note`, `latitude`, `longitude`.
   - Chuáº©n hÃ³a `toTitleCaseVI()` cho tÃªn + Ä‘á»‹a chá»‰.
   - Náº¿u **khÃ´ng cÃ³ thay Ä‘á»•i** â†’ khÃ´ng cho gá»­i.

2) **Chá»‰ bÃ¡o cÃ¡o** (khÃ´ng sá»­a)
   - Chá»n **má»™t hoáº·c nhiá»u lÃ½ do**:
     - Sai Ä‘á»‹a chá»‰
     - Sai vá»‹ trÃ­
     - Sai sá»‘ Ä‘iá»‡n thoáº¡i
     - áº¢nh khÃ´ng Ä‘Ãºng
   - **KhÃ´ng** yÃªu cáº§u áº£nh minh chá»©ng.

**Tráº¡ng thÃ¡i bÃ¡o cÃ¡o**: `pending` â†’ `approved` hoáº·c `rejected`.

### Admin duyá»‡t bÃ¡o cÃ¡o
- **BÃ¡o cÃ¡o sá»­a**: cáº­p nháº­t `stores` theo `proposed_changes`, sau Ä‘Ã³ cáº­p nháº­t cache local + dispatch `storevis:stores-changed`.
- **BÃ¡o cÃ¡o lÃ½ do**: chá»‰ Ä‘Ã¡nh dáº¥u Ä‘Ã£ xá»­ lÃ½ (`approved`), **khÃ´ng** sá»­a dá»¯ liá»‡u.
- NÃºt **Chá»‰ Ä‘Æ°á»ng** á»Ÿ mÃ n admin **chá»‰ hiá»‡n** khi **cÃ³ thay Ä‘á»•i tá»a Ä‘á»™** (lat/lng).

---

## 3. TÃ¬m Kiáº¿m â€” Client-side

**Thuáº­t toÃ¡n scoring** (filter trÃªn `allStores` Ä‘Ã£ cache):

| Score | Äiá»u kiá»‡n |
|---|---|
| 2 | TÃªn chá»©a chuá»—i tÃ¬m kiáº¿m (cÃ³/khÃ´ng dáº¥u) |
| 1 | Táº¥t cáº£ tá»« cá»§a query xuáº¥t hiá»‡n trong tÃªn |
| 0 | Ãt nháº¥t 1 tá»« xuáº¥t hiá»‡n |
| loáº¡i | KhÃ´ng cÃ³ tá»« nÃ o |

**Sort**: score desc â†’ khoáº£ng cÃ¡ch asc â†’ active first â†’ created_at desc

**Máº·c Ä‘á»‹nh khi chÆ°a nháº­p tiÃªu chÃ­ tÃ¬m kiáº¿m**:
- Náº¿u `q` rá»—ng vÃ  chÆ°a chá»n bá»™ lá»c â†’ hiá»ƒn thá»‹ **toÃ n bá»™ cá»­a hÃ ng**
- Váº«n sáº¯p xáº¿p theo khoáº£ng cÃ¡ch **gáº§n â†’ xa**

**LÃ m má»›i vá»‹ trÃ­ ngÆ°á»i dÃ¹ng**:
- Trang `/` tá»± láº¥y láº¡i vá»‹ trÃ­ sau má»—i `3 phÃºt` khi app Ä‘ang má»Ÿ
- Khi ngÆ°á»i dÃ¹ng quay láº¡i tab/trang (`visibilitychange`, `focus`, `pageshow`), vá»‹ trÃ­ cÅ©ng Ä‘Æ°á»£c refresh láº¡i

**Bá»™ lá»c chi tiáº¿t trÃªn `/`**:
- CÃ³ nÃºt **Lá»c** náº±m bÃªn pháº£i Ã´ tÃ¬m kiáº¿m
- CÃ³ thá»ƒ káº¿t há»£p nhiá»u bá»™ lá»c cÃ¹ng lÃºc
- `Quáº­n / Huyá»‡n`: chá»n **1**
- `XÃ£ / PhÆ°á»ng`: chá»n **1**
- `Loáº¡i cá»­a hÃ ng`: chá»n nhiá»u
- `Chi tiáº¿t dá»¯ liá»‡u`: chá»n nhiá»u (`CÃ³ sá»‘ Ä‘iá»‡n thoáº¡i`, `CÃ³ áº£nh`, `KhÃ´ng cÃ³ vá»‹ trÃ­`)
- TrÃªn mobile, panel lá»c Ä‘Æ°á»£c rÃºt gá»n:
  - `Quáº­n / Huyá»‡n` vÃ  `XÃ£ / PhÆ°á»ng` dÃ¹ng `select`
  - CÃ¡c nhÃ³m cÃ²n láº¡i hiá»ƒn thá»‹ dáº¡ng lÆ°á»›i 2 cá»™t
  - Footer thao tÃ¡c náº±m gá»n trong panel, khÃ´ng Ä‘Æ°á»£c lÃ m trÃ n ngang

**Tiáº¿ng Viá»‡t khÃ´ng dáº¥u**: dÃ¹ng `removeVietnameseTones()` Ä‘á»ƒ chuáº©n hÃ³a cáº£ query láº«n tÃªn store.

**TÆ°Æ¡ng Ä‘Æ°Æ¡ng phÃ¡t Ã¢m**: khi chuáº©n hÃ³a search, coi cÃ¡c cáº·p/cá»¥m phá»¥ Ã¢m sau lÃ  tÆ°Æ¡ng Ä‘Æ°Æ¡ng Ä‘á»ƒ ngÆ°á»i dÃ¹ng gÃµ sai chÃ­nh táº£ váº«n tÃ¬m ra káº¿t quáº£:
- s â†” x
- ch â†” tr
- ng â†” ngh
- d â†” gi â†” r
- l â†” n (trá»« â€œng/nhâ€ Ä‘á»ƒ trÃ¡nh Ä‘Ã¨ lÃªn Ã¢m ng/nh)

HÃ m há»— trá»£: `normalizeVietnamesePhonetics()` (Ä‘Æ°á»£c dÃ¹ng á»Ÿ trang tÃ¬m kiáº¿m vÃ  mÃ n xÃ¡c thá»±c admin).

---

## 4. Báº£n Äá»“

- Tile: OpenStreetMap (khÃ´ng cáº§n key)
- Default center: `[105.6955684, 21.0768617]` (HÃ  Ná»™i)
- Markers: canvas tÃ¹y chá»‰nh (house icon + label)
- Click marker â†’ `StoreDetailModal`
- Hover (desktop) â†’ popup tÃªn + Ä‘á»‹a chá»‰
- **Filter sidebar**:
  - Khu vá»±c: Quáº­n â†’ XÃ£; pháº£i chá»n xÃ£ má»›i filter stores
  - Loáº¡i cá»­a hÃ ng: chá»n nhiá»u
- Chá»‰ hiá»ƒn thá»‹ trÃªn báº£n Ä‘á»“ cÃ¡c store cÃ³ tá»a Ä‘á»™ há»£p lá»‡; store khÃ´ng cÃ³ vá»‹ trÃ­ khÃ´ng Ä‘Æ°á»£c render marker hay xuáº¥t hiá»‡n trong search suggestion cá»§a `/map`
- Highlight marker khi Ä‘Æ°á»£c chá»n: ring `#38bdf8`
- Auto-fix lat/lng náº¿u bá»‹ reversed (swap khi lat náº±m ngoÃ i [-90,90])
- Tá»« modal chi tiáº¿t, nÃºt **Báº£n Ä‘á»“** chuyá»ƒn sang `/map` kÃ¨m `storeId + lat/lng`
- Khi Ä‘i theo luá»“ng nÃ y, `/map` má»Ÿ gáº§n Ä‘Ãºng vá»‹ trÃ­ cá»­a hÃ ng trÆ°á»›c rá»“i highlight marker sau khi táº£i dá»¯ liá»‡u
- KhÃ´ng tá»± má»Ÿ modal chi tiáº¿t trÃªn `/map`
- CÃ³ nÃºt **vá» vá»‹ trÃ­ Ä‘ang Ä‘á»©ng** á»Ÿ gÃ³c pháº£i dÆ°á»›i, dÃ¹ng GPS hiá»‡n táº¡i rá»“i `flyTo()`
- Khi vÃ o `/map`, hiá»ƒn thá»‹ thÃªm **cháº¥m xanh** cho vá»‹ trÃ­ hiá»‡n táº¡i cá»§a ngÆ°á»i dÃ¹ng

**Tháº» chi tiáº¿t cá»­a hÃ ng**:
- Trong `StoreDetailModal`, `loáº¡i cá»­a hÃ ng` hiá»ƒn thá»‹ phÃ­a trÃªn tÃªn
- DÃ¹ng cá»¡ chá»¯ nhá» hÆ¡n tÃªn Ä‘á»ƒ giá»¯ hierarchy
- Náº¿u store chÆ°a cÃ³ tá»a Ä‘á»™ thÃ¬ hiá»ƒn thá»‹ nhÃ£n **ChÆ°a cÃ³ vá»‹ trÃ­**
- Náº¿u store cÃ²n thiáº¿u dá»¯ liá»‡u quan trá»ng thÃ¬ cÃ³ nÃºt **Bá»• sung** Ä‘á»ƒ má»Ÿ `/store/edit/[id]?mode=supplement`
- á»ž mÃ n táº¡o store, duplicate panel cÃ³ thá»ƒ hiá»‡n nÃºt **Bá»• sung** Ä‘á»ƒ má»Ÿ supplement flow cá»§a store nghi trÃ¹ng

---

## 5. XÃ¡c Thá»±c (Admin)

- `/store/verify`: danh sÃ¡ch `active = false`, bulk select + verify
- XÃ¡c thá»±c: `UPDATE stores SET active = true WHERE id IN (...)`
- Soft delete: `UPDATE stores SET deleted_at = now()`
- Sau xÃ¡c thá»±c/xÃ³a: cáº­p nháº­t cache local + dispatch `storevis:stores-changed`

---

## 6. Telesale

- Chá»‰ cá»­a hÃ ng `is_potential = true` vÃ  cÃ³ `phone` má»›i xuáº¥t hiá»‡n á»Ÿ mÃ n telesale.
- Guest báº¥m gá»i thÃ¬ gá»i tháº³ng.
- `telesale/admin` báº¥m gá»i sáº½ cÃ³ 2 lá»±a chá»n:
  - `Chá»‰ gá»i`
  - `Gá»i lÃªn Ä‘Æ¡n`
- `Gá»i lÃªn Ä‘Æ¡n` sáº½:
  - gá»i ra sá»‘ Ä‘iá»‡n thoáº¡i
  - cáº­p nháº­t `last_called_at`
  - tá»± chuyá»ƒn store sang `is_potential = true`
  - Ä‘iá»u hÆ°á»›ng sang `/telesale/call/[id]` Ä‘á»ƒ chá»‘t káº¿t quáº£ gá»i
- Khi lÆ°u káº¿t quáº£ gá»i:
  - cáº­p nháº­t `last_call_result`
  - cáº­p nháº­t `last_call_result_at`
  - cáº­p nháº­t `sales_note`
  - náº¿u lÃ  `da_len_don` thÃ¬ cáº­p nháº­t thÃªm `last_order_reported_at`
- Danh sÃ¡ch Æ°u tiÃªn gá»i sáº¯p theo:
  1. store chÆ°a gá»i
  2. store Ä‘Ã£ gá»i nhÆ°ng chÆ°a cáº­p nháº­t káº¿t quáº£ trong vÃ²ng 30 phÃºt
  3. `goi_lai_sau`
  4. `khong_nghe`
  5. `con_hang`
  6. `da_len_don`
- `con_hang` chá»‰ hiá»‡n láº¡i trong danh sÃ¡ch Æ°u tiÃªn khi láº§n cáº­p nháº­t káº¿t quáº£ Ä‘Ã³ Ä‘Ã£ quÃ¡ 2 ngÃ y.
- `da_len_don` chá»‰ hiá»‡n láº¡i trong danh sÃ¡ch Æ°u tiÃªn khi láº§n bÃ¡o Ä‘Æ¡n Ä‘Ã³ Ä‘Ã£ quÃ¡ 3 ngÃ y.

---

## 7. PhÃ¡t Hiá»‡n TrÃ¹ng TÃªn

Bá» qua cÃ¡c tá»« chung khi so sÃ¡nh (`IGNORED_NAME_TERMS`):
> "cá»­a hÃ ng", "táº¡p hoÃ¡", "quÃ¡n nÆ°á»›c", "cafe", "siÃªu thá»‹", "quÃ¡n", "shop", "mart", vÃ  nhiá»u loáº¡i khÃ¡c

**VÃ­ dá»¥**: "Cá»­a hÃ ng Minh Anh" â†’ tá»« khÃ³a so sÃ¡nh lÃ  **"Minh Anh"**

**Khoáº£ng cÃ¡ch trong duplicate check**:
- Chá»‰ store cÃ³ `latitude` vÃ  `longitude` há»£p lá»‡ má»›i Ä‘Æ°á»£c gáº¯n `distance`
- Store khÃ´ng cÃ³ vá»‹ trÃ­ váº«n cÃ³ thá»ƒ xuáº¥t hiá»‡n trong match toÃ n há»‡ thá»‘ng, nhÆ°ng **khÃ´ng Ä‘Æ°á»£c hiá»ƒn thá»‹ khoáº£ng cÃ¡ch giáº£**

---

## 8. Äá»‹a LÃ½

6 huyá»‡n trong `lib/constants.js`: HoÃ i Äá»©c, Äan PhÆ°á»£ng, PhÃºc Thá», Báº¯c Tá»« LiÃªm, Nam Tá»« LiÃªm, Quá»‘c Oai (~100+ xÃ£/phÆ°á»ng).

Huyá»‡n ngoÃ i danh sÃ¡ch: user nháº­p tay (khÃ´ng cÃ³ dropdown suggestion).

---

## 9. Authentication

- Supabase Email/Password â€” khÃ´ng cÃ³ Ä‘Äƒng kÃ½
- `AuthContext.js`: `user`, `loading`, `signIn`, `signOut`, `role`, `isAdmin`, `isTelesale`, `isAuthenticated`
- Route protection:
  - trang admin chá»‰ dÃ nh cho `admin`
  - trang telesale dÃ nh cho `telesale/admin`
- `role` láº¥y tá»« metadata Supabase; náº¿u tÃ i khoáº£n cÅ© chÆ°a cÃ³ metadata thÃ¬ fallback thÃ nh `admin`

---

## 10. Image Upload Flow

```
1. Compress (browser-image-compression): max 1MB, 1600px, JPEG 0.8
2. POST /api/upload-image (multipart)
3. Server: ImageKit SDK upload (private key)
4. Response: { name, fileId, ...}
5. LÆ°u `name` vÃ o DB (image_url)
6. Náº¿u insert DB lá»—i â†’ DELETE áº£nh Ä‘Ã£ upload (rollback)
```

---

## 11. Xuáº¥t Dá»¯ Liá»‡u

- MÃ n export Excel/CSV pháº£i xuáº¥t **táº¥t cáº£ cá»­a hÃ ng Ä‘ang cÃ³** (`deleted_at IS NULL`)
- File Excel/CSV **khÃ´ng phá»¥ thuá»™c** cá»­a hÃ ng cÃ³ sá»‘ Ä‘iá»‡n thoáº¡i hay khÃ´ng
- File danh báº¡ `.vcf` váº«n chá»‰ xuáº¥t cÃ¡c cá»­a hÃ ng cÃ³ sá»‘ Ä‘iá»‡n thoáº¡i há»£p lá»‡
- Khi táº£i dá»¯ liá»‡u export tá»« Supabase, cáº§n Ä‘á»c theo trang Ä‘á»ƒ khÃ´ng bá»‹ há»¥t báº£n ghi khi sá»‘ lÆ°á»£ng store lá»›n

---

## 12. Nháº­p Dá»¯ Liá»‡u

- `/store/import` lÃ  mÃ n admin Ä‘á»ƒ nháº­p nhiá»u cá»­a hÃ ng tá»« file `.csv`
- MÃ n nÃ y pháº£i cÃ³ nÃºt táº£i **file máº«u** Ä‘á»ƒ ngÆ°á»i dÃ¹ng Ä‘iá»n Ä‘Ãºng cá»™t
- CÃ¡c cá»™t báº¯t buá»™c cá»§a file máº«u:
  - `TÃªn cá»­a hÃ ng`
  - `XÃ£ / PhÆ°á»ng`
  - `Quáº­n / Huyá»‡n`
- CÃ¡c cá»™t tÃ¹y chá»n:
  - `Loáº¡i cá»­a hÃ ng`
- `Äá»‹a chá»‰ chi tiáº¿t`
  - `Sá»‘ Ä‘iá»‡n thoáº¡i`
  - `Ghi chÃº`
  - `VÄ© Ä‘á»™`
  - `Kinh Ä‘á»™`
- Khi táº£i file lÃªn, UI pháº£i render **preview theo tá»«ng dÃ²ng** Ä‘á»ƒ admin kiá»ƒm tra trÆ°á»›c khi nháº­p
- Má»—i dÃ²ng preview cáº§n hiá»ƒn thá»‹:
  - dá»¯ liá»‡u Ä‘Ã£ chuáº©n hÃ³a
  - tráº¡ng thÃ¡i `Sáºµn sÃ ng nháº­p` / `Nghi trÃ¹ng` / `Lá»—i dá»¯ liá»‡u`
  - danh sÃ¡ch lá»—i hoáº·c cáº£nh bÃ¡o
  - tá»‘i Ä‘a 3 store nghi trÃ¹ng trong há»‡ thá»‘ng náº¿u cÃ³
- Logic kiá»ƒm tra trÃªn preview:
  - thiáº¿u cá»™t báº¯t buá»™c trong header â†’ cháº·n import
  - thiáº¿u `TÃªn cá»­a hÃ ng` / `XÃ£ / PhÆ°á»ng` / `Quáº­n / Huyá»‡n` â†’ lá»—i
  - `Loáº¡i cá»­a hÃ ng` pháº£i khá»›p `STORE_TYPE_OPTIONS`; Ä‘á»ƒ trá»‘ng thÃ¬ dÃ¹ng `DEFAULT_STORE_TYPE`
  - `Sá»‘ Ä‘iá»‡n thoáº¡i` náº¿u cÃ³ thÃ¬ pháº£i Ä‘Ãºng format VN
  - `VÄ© Ä‘á»™` vÃ  `Kinh Ä‘á»™` pháº£i Ä‘i theo cáº·p; náº¿u cÃ³ thÃ¬ pháº£i há»£p lá»‡
  - trÃ¹ng trong chÃ­nh file â†’ tráº¡ng thÃ¡i `Nghi trÃ¹ng`
  - nghi trÃ¹ng vá»›i há»‡ thá»‘ng hiá»‡n cÃ³ â†’ tráº¡ng thÃ¡i `Nghi trÃ¹ng`
- Náº¿u nghi trÃ¹ng vá»›i há»‡ thá»‘ng, admin cÃ³ thá»ƒ:
  - `Táº¡o má»›i`
  - hoáº·c chá»n má»™t cá»­a hÃ ng nghi trÃ¹ng cá»¥ thá»ƒ rá»“i chá»n `Giá»¯ dá»¯ liá»‡u cÅ©` hoáº·c `Láº¥y dá»¯ liá»‡u má»›i`
- Vá»›i hai lá»±a chá»n trÃªn:
  - field chá»‰ cÃ³ á»Ÿ má»™t bÃªn thÃ¬ váº«n Ä‘Æ°á»£c giá»¯ láº¡i
  - field cÃ³ á»Ÿ cáº£ hai bÃªn thÃ¬ theo lá»±a chá»n `Giá»¯ dá»¯ liá»‡u cÅ©` hoáº·c `Láº¥y dá»¯ liá»‡u má»›i`
- Chá»‰ cÃ¡c dÃ²ng `Sáºµn sÃ ng nháº­p` má»›i Ä‘Æ°á»£c xá»­ lÃ½:
  - `Táº¡o má»›i` â†’ insert vÃ o `stores`
  - chá»n store nghi trÃ¹ng + `Giá»¯ dá»¯ liá»‡u cÅ©` / `Láº¥y dá»¯ liá»‡u má»›i` â†’ update store Ä‘Ã£ chá»n theo rule trÃªn
- Bulk import xong pháº£i:
  - cáº­p nháº­t cache local hoáº·c fallback `invalidateStoreCache()`
  - dispatch `storevis:stores-changed`
  - táº£i láº¡i danh sÃ¡ch store hiá»‡n cÃ³ Ä‘á»ƒ cÃ¡c láº§n import sau so trÃ¹ng Ä‘Ãºng

---

## 13. Quy Táº¯c Tiáº¿ng Viá»‡t & Dialog XÃ¡c Nháº­n

- Text tiáº¿ng Viá»‡t hiá»ƒn thá»‹ cho user/admin pháº£i giá»¯ Ä‘Ãºng dáº¥u trong source vÃ  trÃªn UI.
- Náº¿u terminal hiá»ƒn thá»‹ sai dáº¥u, chÆ°a Ä‘Æ°á»£c coi Ä‘Ã³ lÃ  báº±ng chá»©ng file source bá»‹ há»ng.
- Khi sá»­a text tiáº¿ng Viá»‡t:
  - Æ°u tiÃªn patch nhá»
  - kiá»ƒm tra láº¡i báº±ng `git diff`
  - náº¿u lÃ  text trÃªn mÃ n hÃ¬nh thÃ¬ nÃªn reload mÃ n Ä‘Ã³ Ä‘á»ƒ xÃ¡c nháº­n
- CÃ¡c dialog xÃ¡c nháº­n trong mÃ n admin pháº£i luÃ´n cÃ³:
  - tiÃªu Ä‘á» rÃµ rÃ ng
  - mÃ´ táº£ ngáº¯n giáº£i thÃ­ch hÃ nh Ä‘á»™ng sáº¯p thá»±c hiá»‡n
- Hai mÃ n Ã¡p dá»¥ng báº¯t buá»™c:
  - `/store/verify`
  - `/store/reports`

## 14. Tạo Store Theo Role

- Nếu người tạo là `telesale`, store mới được tạo trực tiếp trong `stores` sẽ mặc định có `is_potential = true`.
- Rule này áp dụng cho cả:
  - luồng tạo đủ 3 bước
  - nhánh `Lưu luôn` ở bước 2
- `guest` và `admin` giữ nguyên hành vi cũ, không tự bật `is_potential` chỉ vì vừa tạo store.