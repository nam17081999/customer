# Ã°Å¸â€”ÂºÃ¯Â¸Â Project Context - StoreVis

## Ã„ÂÃƒÂ¢y lÃƒÂ  gÃƒÂ¬?

**StoreVis** lÃƒÂ  Ã¡Â»Â©ng dÃ¡Â»Â¥ng web tra cÃ¡Â»Â©u vÃƒÂ  quÃ¡ÂºÂ£n lÃƒÂ½ danh sÃƒÂ¡ch **cÃ¡Â»Â­a hÃƒÂ ng** (tÃ¡ÂºÂ¡p hÃƒÂ³a, quÃƒÂ¡n nÃ†Â°Ã¡Â»â€ºc, quÃƒÂ¡n Ã„Æ’n, v.v.) tÃ¡ÂºÂ¡i mÃ¡Â»â„¢t sÃ¡Â»â€˜ huyÃ¡Â»â€¡n ngoÃ¡ÂºÂ¡i thÃƒÂ nh HÃƒÂ  NÃ¡Â»â„¢i.

**MÃ¡Â»Â¥c tiÃƒÂªu chÃƒÂ­nh:**
- GiÃƒÂºp ngÃ†Â°Ã¡Â»Âi dÃƒÂ¹ng tÃƒÂ¬m kiÃ¡ÂºÂ¿m cÃ¡Â»Â­a hÃƒÂ ng theo tÃƒÂªn, quÃ¡ÂºÂ­n, xÃƒÂ£, loÃ¡ÂºÂ¡i vÃƒÂ  mÃ¡Â»Â©c Ã„â€˜Ã¡Â»â„¢ Ã„â€˜Ã¡ÂºÂ§y Ã„â€˜Ã¡Â»Â§ dÃ¡Â»Â¯ liÃ¡Â»â€¡u
- HiÃ¡Â»Æ’n thÃ¡Â»â€¹ vÃ¡Â»â€¹ trÃƒÂ­ cÃ¡Â»Â­a hÃƒÂ ng trÃƒÂªn bÃ¡ÂºÂ£n Ã„â€˜Ã¡Â»â€œ
- Cho phÃƒÂ©p bÃ¡ÂºÂ¥t kÃ¡Â»Â³ ai thÃƒÂªm cÃ¡Â»Â­a hÃƒÂ ng mÃ¡Â»â€ºi (chÃ¡Â»Â admin duyÃ¡Â»â€¡t)
- Telesale theo dÃƒÂµi danh sÃƒÂ¡ch cÃ¡ÂºÂ§n gÃ¡Â»Âi vÃƒÂ  cÃ¡ÂºÂ­p nhÃ¡ÂºÂ­t kÃ¡ÂºÂ¿t quÃ¡ÂºÂ£ gÃ¡Â»Âi
- Admin duyÃ¡Â»â€¡t/quÃ¡ÂºÂ£n lÃƒÂ½ danh sÃƒÂ¡ch, xem dashboard tÃ¡Â»â€¢ng quan

**Ã„ÂÃ¡Â»â€˜i tÃ†Â°Ã¡Â»Â£ng sÃ¡Â»Â­ dÃ¡Â»Â¥ng**: app dÃƒÂ nh cho ngÃ†Â°Ã¡Â»Âi cÃƒÂ³ thÃ¡Â»Æ’ bÃ¡Â»â€¹ mÃ¡ÂºÂ¯t kÃƒÂ©m Ã¢â€ â€™ yÃƒÂªu cÃ¡ÂºÂ§u font lÃ¡Â»â€ºn, tÃ†Â°Ã†Â¡ng phÃ¡ÂºÂ£n cao.

---

## TÃƒÂªn HÃ¡Â»â€¡ ThÃ¡Â»â€˜ng

- **App name**: StoreVis
- **Database table**: `stores`, `store_reports`
- **IDB cache name**: `storevis_cache`

---

## LuÃ¡Â»â€œng ChÃƒÂ­nh

### User thÃ†Â°Ã¡Â»Âng (khÃƒÂ´ng Ã„â€˜Ã„Æ’ng nhÃ¡ÂºÂ­p)
```
Trang chÃ¡Â»Â§ (/) Ã¢â€ â€™ TÃƒÂ¬m kiÃ¡ÂºÂ¿m theo tÃƒÂªn + bÃ¡Â»â„¢ lÃ¡Â»Âc chi tiÃ¡ÂºÂ¿t
Ã¢â€ â€™ Click card Ã¢â€ â€™ xem chi tiÃ¡ÂºÂ¿t (modal)
Ã¢â€ â€™ BÃƒÂ¡o cÃƒÂ¡o cÃ¡Â»Â­a hÃƒÂ ng (tÃ¡Â»Â« modal)
Ã¢â€ â€™ Xem bÃ¡ÂºÂ£n Ã„â€˜Ã¡Â»â€œ (/map)
Ã¢â€ â€™ ThÃƒÂªm cÃ¡Â»Â­a hÃƒÂ ng (/store/create) Ã¢â€ â€™ chÃ¡Â»Â duyÃ¡Â»â€¡t
```

### Telesale (Ã„â€˜ÃƒÂ£ Ã„â€˜Ã„Æ’ng nhÃ¡ÂºÂ­p)
```
Ã„ÂÃ„Æ’ng nhÃ¡ÂºÂ­p (/login)
Ã¢â€ â€™ Dashboard (/account)
Ã¢â€ â€™ Xem danh sÃƒÂ¡ch Ã†Â°u tiÃƒÂªn gÃ¡Â»Âi (/telesale/overview)
Ã¢â€ â€™ GÃ¡Â»Âi khÃƒÂ¡ch hÃƒÂ ng Ã¢â€ â€™ chÃ¡Â»â€˜t kÃ¡ÂºÂ¿t quÃ¡ÂºÂ£ (/telesale/call/[id])
```

### Admin (Ã„â€˜ÃƒÂ£ Ã„â€˜Ã„Æ’ng nhÃ¡ÂºÂ­p)
```
Ã„ÂÃ„Æ’ng nhÃ¡ÂºÂ­p (/login)
Ã¢â€ â€™ Dashboard (/account) Ã¢â€ â€™ DuyÃ¡Â»â€¡t stores (/store/verify)
Ã¢â€ â€™ MÃƒÂ n telesale (/telesale/overview)
Ã¢â€ â€™ NhÃ¡ÂºÂ­p dÃ¡Â»Â¯ liÃ¡Â»â€¡u (/store/import)
Ã¢â€ â€™ XuÃ¡ÂºÂ¥t dÃ¡Â»Â¯ liÃ¡Â»â€¡u (/store/export)
Ã¢â€ â€™ DuyÃ¡Â»â€¡t bÃƒÂ¡o cÃƒÂ¡o cÃ¡Â»Â­a hÃƒÂ ng (/store/reports)
Ã¢â€ â€™ SÃ¡Â»Â­a store (/store/edit/[id])
Ã¢â€ â€™ BÃ¡Â»â€¢ sung dÃ¡Â»Â¯ liÃ¡Â»â€¡u cÃƒÂ²n thiÃ¡ÂºÂ¿u cho store (`/store/edit/[id]?mode=supplement`, public cÃ…Â©ng mÃ¡Â»Å¸ Ã„â€˜Ã†Â°Ã¡Â»Â£c)
Ã¢â€ â€™ ThÃƒÂªm store Ã¢â€ â€™ active ngay
```

---

## CÃƒÂ¡c File Quan TrÃ¡Â»Âng NhÃ¡ÂºÂ¥t

| File | Vai trÃƒÂ² |
|---|---|
| `lib/storeCache.js` | Cache trung tÃƒÂ¢m Ã¢â‚¬â€ Ã„â€˜Ã¡Â»Âc/ghi/invalidate |
| `lib/constants.js` | Danh sÃƒÂ¡ch huyÃ¡Â»â€¡n/xÃƒÂ£ cÃ¡Â»â€˜ Ã„â€˜Ã¡Â»â€¹nh |
| `helper/duplicateCheck.js` | PhÃƒÂ¡t hiÃ¡Â»â€¡n cÃ¡Â»Â­a hÃƒÂ ng trÃƒÂ¹ng tÃƒÂªn |
| `helper/geolocation.js` | LÃ¡ÂºÂ¥y GPS, compass |
| `pages/store/create.js` | Form tÃ¡ÂºÂ¡o cÃ¡Â»Â­a hÃƒÂ ng 3 bÃ†Â°Ã¡Â»â€ºc |
| `pages/store/edit/[id].js` | ChÃ¡Â»â€°nh sÃ¡Â»Â­a store + chÃ¡ÂºÂ¿ Ã„â€˜Ã¡Â»â„¢ `supplement` theo step Ã„â€˜Ã¡Â»Æ’ chÃ¡Â»â€° bÃ¡Â»â€¢ sung dÃ¡Â»Â¯ liÃ¡Â»â€¡u cÃƒÂ²n thiÃ¡ÂºÂ¿u |
| `pages/store/import.js` | NhÃ¡ÂºÂ­p nhiÃ¡Â»Âu store tÃ¡Â»Â« CSV mÃ¡ÂºÂ«u, preview lÃ¡Â»â€”i vÃƒÂ  nghi trÃƒÂ¹ng trÃ†Â°Ã¡Â»â€ºc khi insert |
| `pages/store/export.js` | XuÃ¡ÂºÂ¥t CSV toÃƒÂ n bÃ¡Â»â„¢ store Ã„â€˜ang cÃƒÂ³ + VCF theo sÃ¡Â»â€˜ Ã„â€˜iÃ¡Â»â€¡n thoÃ¡ÂºÂ¡i |
| `pages/store/reports.js` | Admin duyÃ¡Â»â€¡t bÃƒÂ¡o cÃƒÂ¡o cÃ¡Â»Â­a hÃƒÂ ng |
| `pages/telesale/overview.js` | Danh sÃƒÂ¡ch Ã†Â°u tiÃƒÂªn gÃ¡Â»Âi + thÃ¡Â»â€˜ng kÃƒÂª telesale |
| `pages/telesale/call/[id].js` | MÃƒÂ n riÃƒÂªng Ã„â€˜Ã¡Â»Æ’ chÃ¡Â»â€˜t kÃ¡ÂºÂ¿t quÃ¡ÂºÂ£ cuÃ¡Â»â„¢c gÃ¡Â»Âi |
| `pages/map.js` | BÃ¡ÂºÂ£n Ã„â€˜Ã¡Â»â€œ MapLibre, custom markers, focus theo query, nÃƒÂºt vÃ¡Â»Â GPS, chÃ¡ÂºÂ¥m xanh vÃ¡Â»â€¹ trÃƒÂ­ hiÃ¡Â»â€¡n tÃ¡ÂºÂ¡i, sidebar lÃ¡Â»Âc |
| `pages/index.js` | TÃƒÂ¬m kiÃ¡ÂºÂ¿m local vÃ¡Â»â€ºi scoring, bÃ¡Â»â„¢ lÃ¡Â»Âc chi tiÃ¡ÂºÂ¿t, refresh vÃ¡Â»â€¹ trÃƒÂ­ Ã„â€˜Ã¡Â»â€¹nh kÃ¡Â»Â³, filter `KhÃƒÂ´ng cÃƒÂ³ vÃ¡Â»â€¹ trÃƒÂ­` |
| `components/navbar.jsx` | Top nav desktop tÃ¡Â»â€˜i giÃ¡ÂºÂ£n + bottom tab mobile |
| `components/store-detail-modal.jsx` | Modal chi tiÃ¡ÂºÂ¿t + bÃƒÂ¡o cÃƒÂ¡o + nÃƒÂºt chuyÃ¡Â»Æ’n sang /map + loÃ¡ÂºÂ¡i cÃ¡Â»Â­a hÃƒÂ ng phÃƒÂ­a trÃƒÂªn tÃƒÂªn + nÃƒÂºt `BÃ¡Â»â€¢ sung` |
| `lib/authz.js` | Helpers quyÃ¡Â»Ân theo `role` Ã„â€˜Ã¡Â»Æ’ Ã¡ÂºÂ©n/hiÃ¡Â»â€¡n hÃƒÂ nh Ã„â€˜Ã¡Â»â„¢ng Ã„â€˜ÃƒÂºng vai trÃƒÂ² |

---

## PhÃ¡Â»Â¥ ThuÃ¡Â»â„¢c NgoÃ¡ÂºÂ¡i Vi

| Service | DÃƒÂ¹ng cho | BiÃ¡ÂºÂ¿n env |
|---|---|---|
| Supabase | Database + Auth | `NEXT_PUBLIC_SUPABASE_URL`, `ANON_KEY` |
| ImageKit.io | CDN Ã¡ÂºÂ£nh | `NEXT_PUBLIC_IMAGE_BASE_URL`, public/private key |
| Google Maps API | Location picker (create/edit form) | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` |
| OpenStreetMap | Tile bÃ¡ÂºÂ£n Ã„â€˜Ã¡Â»â€œ (/map) | KhÃƒÂ´ng cÃ¡ÂºÂ§n key |

---

## PhÃ¡ÂºÂ¡m Vi Ã„ÂÃ¡Â»â€¹a LÃƒÂ½

6 huyÃ¡Â»â€¡n tÃ¡ÂºÂ¡i HÃƒÂ  NÃ¡Â»â„¢i: **HoÃƒÂ i Ã„ÂÃ¡Â»Â©c, Ã„Âan PhÃ†Â°Ã¡Â»Â£ng, PhÃƒÂºc ThÃ¡Â»Â, BÃ¡ÂºÂ¯c TÃ¡Â»Â« LiÃƒÂªm, Nam TÃ¡Â»Â« LiÃƒÂªm, QuÃ¡Â»â€˜c Oai**.
Danh sÃƒÂ¡ch xÃƒÂ£/phÃ†Â°Ã¡Â»Âng cÃ¡Â»â€˜ Ã„â€˜Ã¡Â»â€¹nh trong `lib/constants.js`.

---

## 21 Ã„ÂiÃ¡Â»Âu CÃ¡ÂºÂ§n BiÃ¡ÂºÂ¿t Khi Code

1. **KhÃƒÂ´ng gÃ¡Â»Âi Supabase trÃ¡Â»Â±c tiÃ¡ÂºÂ¿p Ã„â€˜Ã¡Â»Æ’ Ã„â€˜Ã¡Â»Âc stores** Ã¢â‚¬â€ luÃƒÂ´n qua `getOrRefreshStores()`
2. **`image_url` lÃƒÂ  tÃƒÂªn file**, khÃƒÂ´ng phÃ¡ÂºÂ£i URL Ã¢â‚¬â€ full URL = `BASE_URL + image_url`
3. **Soft delete** Ã¢â‚¬â€ dÃƒÂ¹ng `deleted_at`, khÃƒÂ´ng bao giÃ¡Â»Â `DELETE` query
4. **`active = true`** chÃ¡Â»â€° khi admin tÃ¡ÂºÂ¡o hoÃ¡ÂºÂ·c admin duyÃ¡Â»â€¡t
5. **KhÃƒÂ´ng cÃƒÂ³ cÃ¡Â»â„¢t `name_search`** trong DB Ã¢â‚¬â€ khÃƒÂ´ng thÃƒÂªm field nÃƒÂ y khi insert
6. **Pages Router** Ã¢â‚¬â€ file Ã„â€˜Ã¡ÂºÂ·t trong `pages/`, khÃƒÂ´ng phÃ¡ÂºÂ£i `app/`
7. **TailwindCSS v4** Ã¢â‚¬â€ cÃƒÂº phÃƒÂ¡p `@import "tailwindcss"` trong globals.css
8. **Dark mode**: Ã¡Â»Â¨ng dÃ¡Â»Â¥ng chÃ¡ÂºÂ¡y **Dark Mode duy nhÃ¡ÂºÂ¥t**. KhÃƒÂ´ng cÃƒÂ³ Light Mode.
9. **MapTheme**: Trang bÃ¡ÂºÂ£n Ã„â€˜Ã¡Â»â€œ dÃƒÂ¹ng bÃ¡Â»â„¢ lÃ¡Â»Âc tÃ¡Â»â€˜i (`.dark-map-filter`). RiÃƒÂªng cÃƒÂ¡c form nhÃ¡ÂºÂ­p liÃ¡Â»â€¡u (`create/edit`) dÃƒÂ¹ng bÃ¡ÂºÂ£n Ã„â€˜Ã¡Â»â€œ **SÃƒÂ¡ng** (`dark={false}`) Ã„â€˜Ã¡Â»Æ’ nhÃƒÂ¬n lÃ¡Â»â„¢ trÃƒÂ¬nh rÃƒÂµ hÃ†Â¡n.
10. **Font tÃ¡Â»â€˜i thiÃ¡Â»Æ’u `text-base` (16px)** Ã¢â‚¬â€ app cho ngÃ†Â°Ã¡Â»Âi mÃ¡ÂºÂ¯t kÃƒÂ©m, khÃƒÂ´ng dÃƒÂ¹ng `text-xs`/`text-[11px]` cho thÃƒÂ´ng tin quan trÃ¡Â»Âng.
11. **BÃ¡ÂºÂ£n Ã„â€˜Ã¡Â»â€œ quay theo hÃ†Â°Ã¡Â»â€ºng**: CÃ¡ÂºÂ§n gÃ¡Â»Âi `requestCompassHeading()` TRÃ†Â¯Ã¡Â»Å¡C `await` trong hÃƒÂ m xÃ¡Â»Â­ lÃƒÂ½ click/thao tÃƒÂ¡c thÃƒÂ¬ mÃ¡Â»â€ºi qua Ã„â€˜Ã†Â°Ã¡Â»Â£c quyÃ¡Â»Ân User Gesture cÃ¡Â»Â§a iOS/Safari.
12. **Trang `/` cÃƒÂ³ bÃ¡Â»â„¢ lÃ¡Â»Âc chi tiÃ¡ÂºÂ¿t**: quÃ¡ÂºÂ­n/xÃƒÂ£ lÃƒÂ  single-select; loÃ¡ÂºÂ¡i/cÃƒÂ³ SÃ„ÂT/cÃƒÂ³ Ã¡ÂºÂ£nh/khÃƒÂ´ng cÃƒÂ³ vÃ¡Â»â€¹ trÃƒÂ­ lÃƒÂ  multi-select.
13. **Trang `/` tÃ¡Â»Â± lÃƒÂ m mÃ¡Â»â€ºi GPS**: vÃƒÂ o trang, sau mÃ¡Â»â€”i 3 phÃƒÂºt, vÃƒÂ  khi quay lÃ¡ÂºÂ¡i tab/trang.
14. **Trang `/map` cÃƒÂ³ chÃ¡ÂºÂ¥m xanh vÃ¡Â»â€¹ trÃƒÂ­ hiÃ¡Â»â€¡n tÃ¡ÂºÂ¡i** ngoÃƒÂ i marker cÃ¡Â»Â­a hÃƒÂ ng, vÃƒÂ  khÃƒÂ´ng hiÃ¡Â»Æ’n thÃ¡Â»â€¹ store khÃƒÂ´ng cÃƒÂ³ tÃ¡Â»Âa Ã„â€˜Ã¡Â»â„¢.
15. **`/store/create` bÃ†Â°Ã¡Â»â€ºc 2 cÃƒÂ³ nhÃƒÂ¡nh `LÃ†Â°u luÃƒÂ´n`**: bÃ¡ÂºÂ¯t buÃ¡Â»â„¢c phone hÃ¡Â»Â£p lÃ¡Â»â€¡, cho phÃƒÂ©p lÃ†Â°u store chÃ†Â°a cÃƒÂ³ vÃ¡Â»â€¹ trÃƒÂ­, cÃƒÂ³ confirm trÃ†Â°Ã¡Â»â€ºc khi lÃ†Â°u.
16. **`/store/create` bÃ†Â°Ã¡Â»â€ºc 1-2**: bÃ†Â°Ã¡Â»â€ºc 1 Ã„â€˜ÃƒÂ£ lÃ¡ÂºÂ¥y GPS Ã„â€˜Ã¡Â»Æ’ check trÃƒÂ¹ng; kÃ¡ÂºÂ¿t quÃ¡ÂºÂ£ nÃƒÂ y Ã„â€˜Ã†Â°Ã¡Â»Â£c dÃƒÂ¹ng Ã„â€˜Ã¡Â»Æ’ prefill quÃ¡ÂºÂ­n/huyÃ¡Â»â€¡n + xÃƒÂ£/phÃ†Â°Ã¡Â»Âng cÃ¡Â»Â§a cÃ¡Â»Â­a hÃƒÂ ng gÃ¡ÂºÂ§n nhÃ¡ÂºÂ¥t trong nÃ¡Â»Ân trÃ†Â°Ã¡Â»â€ºc khi sang bÃ†Â°Ã¡Â»â€ºc 2.
17. **Duplicate check**: store khÃƒÂ´ng cÃƒÂ³ tÃ¡Â»Âa Ã„â€˜Ã¡Â»â„¢ vÃ¡ÂºÂ«n cÃƒÂ³ thÃ¡Â»Æ’ xuÃ¡ÂºÂ¥t hiÃ¡Â»â€¡n Ã¡Â»Å¸ match toÃƒÂ n hÃ¡Â»â€¡ thÃ¡Â»â€˜ng nhÃ†Â°ng khÃƒÂ´ng Ã„â€˜Ã†Â°Ã¡Â»Â£c cÃƒÂ³ `distance` giÃ¡ÂºÂ£.
18. **Duplicate panel**: candidate cÃƒÂ²n thiÃ¡ÂºÂ¿u dÃ¡Â»Â¯ liÃ¡Â»â€¡u cÃƒÂ³ thÃ¡Â»Æ’ cÃƒÂ³ nÃƒÂºt `BÃ¡Â»â€¢ sung` Ã„â€˜Ã¡Â»Æ’ mÃ¡Â»Å¸ `/store/edit/[id]?mode=supplement`.
19. **`/store/edit/[id]?mode=supplement`**: luÃƒÂ´n bÃ¡ÂºÂ¯t Ã„â€˜Ã¡ÂºÂ§u tÃ¡Â»Â« bÃ†Â°Ã¡Â»â€ºc 1, khÃƒÂ³a dÃ¡Â»Â¯ liÃ¡Â»â€¡u Ã„â€˜ÃƒÂ£ cÃƒÂ³, chÃ¡Â»â€° cho nhÃ¡ÂºÂ­p phÃ¡ÂºÂ§n thiÃ¡ÂºÂ¿u; nÃ¡ÂºÂ¿u store Ã„â€˜ÃƒÂ£ cÃƒÂ³ vÃ¡Â»â€¹ trÃƒÂ­ thÃƒÂ¬ flow chÃ¡Â»â€° cÃƒÂ²n 2 bÃ†Â°Ã¡Â»â€ºc, nÃ¡ÂºÂ¿u chÃ†Â°a cÃƒÂ³ vÃ¡Â»â€¹ trÃƒÂ­ thÃƒÂ¬ bÃ†Â°Ã¡Â»â€ºc 3 sÃ¡ÂºÂ½ tÃ¡Â»Â± lÃ¡ÂºÂ¥y GPS mÃ¡Â»â„¢t lÃ¡ÂºÂ§n; ngÃ†Â°Ã¡Â»Âi chÃ†Â°a Ã„â€˜Ã„Æ’ng nhÃ¡ÂºÂ­p gÃ¡Â»Â­i `store_report`, admin thÃƒÂ¬ cÃ¡ÂºÂ­p nhÃ¡ÂºÂ­t trÃ¡Â»Â±c tiÃ¡ÂºÂ¿p.
20. **Layout desktop**: dÃƒÂ¹ng `scrollbar-gutter: stable` Ã„â€˜Ã¡Â»Æ’ trÃƒÂ¡nh xÃƒÂª dÃ¡Â»â€¹ch khi chuyÃ¡Â»Æ’n giÃ¡Â»Â¯a trang cÃƒÂ³/khÃƒÂ´ng cÃƒÂ³ scrollbar.
21. **`/store/import`**: dÃƒÂ¹ng file mÃ¡ÂºÂ«u CSV, parse Ã¡Â»Å¸ client vÃƒÂ  preview theo tÃ¡Â»Â«ng dÃƒÂ²ng trÃ†Â°Ã¡Â»â€ºc khi insert; khÃƒÂ´ng import thÃ¡ÂºÂ³ng file chÃ†Â°a qua kiÃ¡Â»Æ’m tra.
22. **`/store/import` nghi trÃƒÂ¹ng**: mÃ¡Â»â€”i dÃƒÂ²ng cÃƒÂ³ thÃ¡Â»Æ’ chÃ¡Â»Ân `TÃ¡ÂºÂ¡o mÃ¡Â»â€ºi`, hoÃ¡ÂºÂ·c phÃ¡ÂºÂ£i chÃ¡Â»Ân 1 cÃ¡Â»Â­a hÃƒÂ ng nghi trÃƒÂ¹ng cÃ¡Â»Â¥ thÃ¡Â»Æ’ trÃ†Â°Ã¡Â»â€ºc rÃ¡Â»â€œi mÃ¡Â»â€ºi chÃ¡Â»Ân `GiÃ¡Â»Â¯ dÃ¡Â»Â¯ liÃ¡Â»â€¡u cÃ…Â©` hoÃ¡ÂºÂ·c `LÃ¡ÂºÂ¥y dÃ¡Â»Â¯ liÃ¡Â»â€¡u mÃ¡Â»â€ºi`.
23. **Bulk import**: khi update vÃƒÂ o cÃ¡Â»Â­a hÃƒÂ ng nghi trÃƒÂ¹ng, field chÃ¡Â»â€° cÃƒÂ³ Ã¡Â»Å¸ mÃ¡Â»â„¢t bÃƒÂªn vÃ¡ÂºÂ«n Ã„â€˜Ã†Â°Ã¡Â»Â£c giÃ¡Â»Â¯ lÃ¡ÂºÂ¡i; field cÃƒÂ³ Ã¡Â»Å¸ cÃ¡ÂºÂ£ hai bÃƒÂªn thÃƒÂ¬ theo lÃ¡Â»Â±a chÃ¡Â»Ân `GiÃ¡Â»Â¯ dÃ¡Â»Â¯ liÃ¡Â»â€¡u cÃ…Â©` / `LÃ¡ÂºÂ¥y dÃ¡Â»Â¯ liÃ¡Â»â€¡u mÃ¡Â»â€ºi`; xong phÃ¡ÂºÂ£i cÃ¡ÂºÂ­p nhÃ¡ÂºÂ­t cache local hoÃ¡ÂºÂ·c fallback `invalidateStoreCache()`, rÃ¡Â»â€œi dispatch `storevis:stores-changed`.
24. **Role hiÃ¡Â»â€¡n tÃ¡ÂºÂ¡i**: `guest`, `telesale`, `admin`; `telesale/admin` vÃƒÂ o Ã„â€˜Ã†Â°Ã¡Â»Â£c `/account` vÃƒÂ  `/telesale/overview`, cÃƒÂ²n `admin` mÃ¡Â»â€ºi cÃƒÂ³ cÃƒÂ¡c mÃƒÂ n quÃ¡ÂºÂ£n trÃ¡Â»â€¹ dÃ¡Â»Â¯ liÃ¡Â»â€¡u.
25. **Telesale queue**: chÃ¡Â»â€° lÃ¡ÂºÂ¥y store `is_potential` cÃƒÂ³ `phone`; Ã†Â°u tiÃƒÂªn riÃƒÂªng cho store Ã„â€˜ÃƒÂ£ gÃ¡Â»Âi nhÃ†Â°ng chÃ†Â°a cÃ¡ÂºÂ­p nhÃ¡ÂºÂ­t kÃ¡ÂºÂ¿t quÃ¡ÂºÂ£ trong vÃƒÂ²ng 30 phÃƒÂºt, dÃƒÂ¹ng `last_call_result_at` Ã„â€˜Ã¡Â»Æ’ phÃƒÂ¢n biÃ¡Â»â€¡t.

---

## Convention & Naming

| ThÃƒÂ nh phÃ¡ÂºÂ§n | Convention |
|---|---|
| TÃƒÂªn cÃ¡Â»Â­a hÃƒÂ ng | Title Case tiÃ¡ÂºÂ¿ng ViÃ¡Â»â€¡t (`toTitleCaseVI()`) |
| Ã„ÂÃ¡Â»â€¹a chÃ¡Â»â€° | Title Case (ward, district, address_detail) |
| File component | kebab-case `.jsx` |
| File page/lib/helper | kebab-case hoÃ¡ÂºÂ·c camelCase `.js` |
| Custom event | `storevis:stores-changed` |
| IDB database (cache) | `storevis_cache` |
| Editor config | `.editorconfig` (UTF-8, LF) |

---

## Guardrail TiÃ¡ÂºÂ¿ng ViÃ¡Â»â€¡t

- Repo cÃƒÂ³ `.editorconfig` Ã„â€˜Ã¡Â»Æ’ ÃƒÂ©p mÃ¡ÂºÂ·c Ã„â€˜Ã¡Â»â€¹nh `UTF-8` vÃƒÂ  `LF`.
- Khi sÃ¡Â»Â­a file cÃƒÂ³ tiÃ¡ÂºÂ¿ng ViÃ¡Â»â€¡t, Ã†Â°u tiÃƒÂªn patch nhÃ¡Â»Â thay vÃƒÂ¬ rewrite cÃ¡ÂºÂ£ file.
- KhÃƒÂ´ng dÃƒÂ¹ng cÃƒÂ¡ch ghi file dÃ¡Â»â€¦ lÃƒÂ m vÃ¡Â»Â¡ encoding nÃ¡ÂºÂ¿u chÃ†Â°a kiÃ¡Â»Æ’m soÃƒÂ¡t rÃƒÂµ Ã„â€˜Ã¡ÂºÂ§u ra.
- KhÃƒÂ´ng kÃ¡ÂºÂ¿t luÃ¡ÂºÂ­n file hÃ¡Â»Âng chÃ¡Â»â€° vÃƒÂ¬ terminal Windows hiÃ¡Â»Æ’n thÃ¡Â»â€¹ sai dÃ¡ÂºÂ¥u; cÃ¡ÂºÂ§n Ã„â€˜Ã¡Â»â€˜i chiÃ¡ÂºÂ¿u thÃƒÂªm bÃ¡ÂºÂ±ng `git diff` hoÃ¡ÂºÂ·c UI thÃ¡Â»Â±c tÃ¡ÂºÂ¿.
- Hai mÃƒÂ n admin dÃ¡Â»â€¦ lÃ¡Â»â„¢ lÃ¡Â»â€”i tiÃ¡ÂºÂ¿ng ViÃ¡Â»â€¡t ra UI lÃƒÂ :
  - `/store/verify`
  - `/store/reports`

---

## Telesale Minimal DB Update

Ban toi gian cho telesale su dung 6 cot tren `stores`:

- `is_potential`
- `last_called_at`
- `last_call_result`
- `last_call_result_at`
- `last_order_reported_at`
- `sales_note`

MÃƒÂ n telesale Ã„â€˜ang dÃƒÂ¹ng route:

- `/telesale/overview`
- `/telesale/call/[id]`

Script SQL cap nhat moi truong duoc luu tai:

- `docs/sql/2026-04-01-add-store-telesale-columns.sql`

---

## Search UX Notes (2026-04)

- Search hiá»‡n giá»¯ tráº¡ng thÃ¡i theo cáº£ URL vÃ  `sessionStorage`.
- NgÆ°á»i dÃ¹ng Ä‘ang tÃ¬m dá»Ÿ, chuyá»ƒn sang trang khÃ¡c rá»“i báº¥m láº¡i tab `TÃ¬m kiáº¿m`, pháº£i quay vá» Ä‘Ãºng search trÆ°á»›c Ä‘Ã³.
- CÃ¡c tiÃªu chÃ­ Ä‘ang Ä‘Æ°á»£c giá»¯ gá»“m:
  - tá»« khÃ³a (`q`)
  - quáº­n/huyá»‡n (`district`)
  - xÃ£/phÆ°á»ng (`ward`)
  - loáº¡i cá»­a hÃ ng (`types`)
  - cÃ¡c cá» chi tiáº¿t dá»¯ liá»‡u (`flags`)
- Khi thay Ä‘á»•i text hoáº·c filter trong lÃºc Ä‘ang cuá»™n sÃ¢u á»Ÿ danh sÃ¡ch, danh sÃ¡ch pháº£i tá»± trá»Ÿ vá» Ä‘áº§u Ä‘á»ƒ ngÆ°á»i dÃ¹ng nhÃ¬n tháº¥y káº¿t quáº£ má»›i ngay.

## Vietnamese Copy Note

- CÃ¡c thay Ä‘á»•i gáº§n Ä‘Ã¢y á»Ÿ search/navbar Ä‘Ã£ tá»«ng phÃ¡t sinh lá»—i tiáº¿ng Viá»‡t do ghi file sai encoding.
- Vá»›i cÃ¡c file UI cÃ³ tiáº¿ng Viá»‡t hiá»ƒn thá»‹ trá»±c tiáº¿p nhÆ° `pages/index.js` vÃ  `components/navbar.jsx`, cáº§n giá»¯ UTF-8 khÃ´ng BOM vÃ  kiá»ƒm tra láº¡i text sau khi sá»­a.
## Create Role Note

- Khi `telesale` tạo cửa hàng mới ở `/store/create`, cửa hàng đó mặc định là `tiềm năng` (`is_potential = true`).
- Rule này đi theo payload tạo store, nên áp dụng đồng nhất cho cả tạo đầy đủ vị trí và `Lưu luôn` không có vị trí.