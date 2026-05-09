# Current Work

## Goal
- Áp dụng feedback review cho PR hiện tại: chỉnh lại phạm vi task document cho đúng với bugfix `/map?storeId=...` và loại bỏ state update dư thừa gây render churn.

## Task Type
- Bug Fix

## Why
- Reviewer chỉ ra 2 điểm chưa nhất quán:
  - `docs/current-work.md` mô tả `Out of Scope` sai vì thực tế PR có thay đổi behavior `/map`.
  - `pages/map.js` có `setHighlightedStoreId` bị gọi dư trong effect khi `flyToStore()` đã xử lý.

## In Scope
- `docs/current-work.md` (cập nhật scope đúng với map bugfix).
- `pages/map.js` (loại bỏ state update dư trong effect focus theo `storeId`).
- Verify lint/test liên quan map sau chỉnh sửa.

## Out of Scope
- Không thay đổi business rule khác ngoài bugfix `/map?storeId` đã có trong PR.
- Không mở rộng dependency/package hygiene.
- Không refactor map flow ngoài phần state update dư thừa.

## Must Preserve
- `/map` vẫn nhận query `storeId`, `lat`, `lng` như hiện tại.
- Luồng vào `/map?storeId=...` chỉ focus/highlight store, không auto-fill search gây lọc marker.
- Không thay đổi rule render marker/suggestion (chỉ store có tọa độ hợp lệ).
- Không phá lint/test hiện có.

## Inputs / Repro / Expected
- Repro: vào `/map?storeId=<id-hợp-lệ>` khi dữ liệu map đã tải.
- Current: effect set highlight 2 lần (`effect` + `flyToStore`), và task doc ghi sai phạm vi.
- Expected:
  - Highlight chỉ set 1 lần qua `flyToStore`.
  - `docs/current-work.md` phản ánh đúng là có map behavior bugfix trong phạm vi.

## Constraints
- Sửa nhỏ, đúng trọng tâm feedback.
- Giữ UTF-8 cho file docs có tiếng Việt.

## Required Verification
- `npm run lint`
- `npm run test`
- Focus smoke test map (test đã có cho case `storeId chỉ highlight`).
- Checklist áp dụng: `Checklist chung`, `Map Flow`, `Tiếng Việt / UI Safety`.

## Definition of Done
- Cả 2 feedback trong thread đã được xử lý bằng thay đổi code/docs tối thiểu.
- Có bằng chứng verify mới cho thay đổi.

## Plan
- Cập nhật `docs/current-work.md` để scope đúng với map bugfix.
- Xóa `setHighlightedStoreId(initialStoreId)` dư trong effect ở `pages/map.js`.
- Chạy lint + test liên quan map.
- Cập nhật `Done`, `Verification`, `Risks / Next`.

## Done
- Đã cập nhật phạm vi task trong `current-work` để phản ánh đúng bugfix map theo `storeId`.
- Đã bỏ gọi dư `setHighlightedStoreId(initialStoreId)` trong effect của `/map`; highlight giờ chỉ set qua `flyToStore()`.

## Verification
- `npm run lint` ✅
- `npm run test` ✅ (30 files, 364 tests)
- `NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=test-key npx playwright test e2e/store-map.spec.js -g "storeId chỉ highlight"` ✅
- Checklist:
  - `Checklist chung`: đã cập nhật scope, không mở rộng refactor, có verify mới.
  - `Map Flow`: đã verify case `/map?storeId=...` vẫn chỉ highlight/focus, không auto-fill search.
  - `Tiếng Việt / UI Safety`: file docs tiếng Việt giữ UTF-8, sửa cục bộ.

## Risks / Next
- `npm run build` vẫn lỗi trong sandbox vì không resolve được `fonts.googleapis.com` (hạn chế môi trường mạng), không phải regression từ thay đổi hiện tại.
