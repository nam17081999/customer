# Current Work

## Goal
- Follow up PR review thread: normalize quick-create `name` query from search CTA so extra internal whitespace is collapsed before navigating to `/store/create`.

## Task Type
- Bug Fix

## Why
- Search create CTA currently sends `name: searchTerm.trim()`, while CTA visibility logic already uses normalized words.
- This can create inconsistent URL/form prefill (e.g. `tap hoa   minh anh`) compared with search normalization behavior.

## In Scope
- `helper/useHomeSearchController.js`
- Unit tests around search CTA href generation if needed.
- `docs/current-work.md`

## Out of Scope
- Không đổi create flow step/deeplink behavior ngoài normalize query name.
- Không đổi duplicate/search ranking rules.
- Không đổi cache/map/auth logic.

## Must Preserve
- CTA vẫn chỉ hiện theo rule hiện tại.
- CTA vẫn điều hướng `/store/create?step=2`.
- Deep-link prefill name vẫn hoạt động.
- UTF-8 tiếng Việt sạch.

## Inputs / Repro / Expected
- Repro: nhập `tap hoa   minh anh` ở search, bấm CTA `Tạo cửa hàng`.
- Current: query `name` có thể chứa nhiều khoảng trắng liên tiếp.
- Expected: query `name` được normalize thành single-space words (vd `tap hoa minh anh`).

## Constraints
- Sửa tối thiểu, không thêm dependency.
- Tận dụng helper normalize hiện có.

## Required Verification
- `npm run lint`
- `npm run test -- __tests__/helper/homeSearch.test.js`
- `npm run test -- __tests__/helper/storeCreateFlow.test.js`
- `npm run text:check`
- `git diff --check`
- Checklist: Search Flow, Create Flow, Tiếng Việt / UI Safety.

## Definition of Done
- Query `name` từ CTA được normalize nhất quán với search meta.
- Test liên quan pass.
- Không regression flow search/create đã thêm trước đó.

## Plan
- Chạy baseline lint/test/build để ghi nhận trạng thái trước khi sửa.
- Áp dụng fix nhỏ ở `createStoreHref`.
- Bổ sung/điều chỉnh test unit cho normalize query.
- Chạy focused verification và cập nhật kết quả.

## Done
- Root cause: `createStoreHref.query.name` chỉ dùng `trim()`, nên giữ nguyên khoảng trắng thừa ở giữa khi bấm CTA từ search.
- Fix: thêm helper `normalizeCreateStoreName()` để collapse whitespace (trim + split/join 1-space) và dùng helper này khi tạo deeplink `/store/create?name=...&step=2`.
- Test: bổ sung unit test khóa behavior normalize query name, gồm edge cases rỗng/toàn khoảng trắng/tab/newline.

## Verification
- Baseline trước khi sửa:
  - Pass: `npm run lint`
  - Pass: `npm run test`
  - Fail (môi trường): `npm run build` lỗi mạng `getaddrinfo ENOTFOUND fonts.googleapis.com` khi fetch `next/font` (Geist/Geist Mono).
- Sau khi sửa:
  - Pass: `npm run test -- __tests__/helper/homeSearch.test.js __tests__/helper/storeCreateFlow.test.js`
  - Pass: `npm run test -- __tests__/helper/homeSearch.test.js`
  - Pass: `npm run lint`
  - Pass: `npm run text:check`
  - Pass: `git diff --check`
  - Fail (môi trường): `npm run test:e2e -- e2e/store-search.spec.js` không khởi động web server vì thiếu env `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Checklist verified:
  - Search Flow: normalize query name cho CTA deeplink, không đổi rule hiện/ẩn CTA.
  - Create Flow: deeplink `step=2` giữ nguyên.
  - Tiếng Việt / UI Safety: text check pass.

## Risks / Next
- Chưa có bằng chứng e2e mới trong sandbox do thiếu env Supabase; cần chạy lại `e2e/store-search.spec.js` trên CI hoặc môi trường có đủ env để xác nhận UI flow end-to-end.
