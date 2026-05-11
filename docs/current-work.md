# Current Work

## Goal
- Fix luồng từ search CTA sang `/store/create?name=...&step=2` không tự điền `Quận / Huyện` và `Xã / Phường` theo vị trí hiện tại; thêm test regression cho case này.

## Task Type
- Bug Fix

## Why
- Deep-link vào bước 2 đang bỏ qua bước 1 duplicate/GPS path, nên không gọi auto-fill địa bàn từ tọa độ như luồng bấm `Tiếp theo` từ bước 1.

## In Scope
- `helper/useStoreCreateController.js`
- E2E create/search tests liên quan `step=2`.
- `docs/current-work.md`

## Out of Scope
- Không đổi duplicate rule.
- Không đổi submit/create/cache.
- Không đổi map/location picker step 3.
- Không đổi DB/schema.

## Must Preserve
- Deep-link step 2 vẫn prefill tên và vào đúng bước 2.
- User vẫn có thể sửa/chọn tay quận/xã.
- Nếu không lấy được vị trí thì không chặn bước 2.
- Create flow validate bước 2 như cũ.
- UTF-8 tiếng Việt sạch.

## Inputs / Repro / Expected
- Repro: vào `/store/create?name=Minh%20Anh&step=2` với geolocation e2e có tọa độ thuộc `Hoài Đức / An Khánh`.
- Current: bước 2 trống quận/xã.
- Expected: bước 2 tự chọn `Hoài Đức` và `An Khánh`.

## Constraints
- Không thêm dependency.
- Dùng helper geolocation/location policy hiện có.

## Required Verification
- `npm run test -- __tests__/helper/storeCreateFlow.test.js`
- `npm run test:e2e -- e2e/store-create.spec.js e2e/store-search.spec.js`
- `npm run lint`
- `npm run text:check`
- `git diff --check`
- Checklist: Create Flow, Search Flow, Map Flow, Tiếng Việt / UI Safety.

## Definition of Done
- Root cause xác định.
- Deep-link step 2 tự fill district/ward khi lấy được vị trí.
- Có test khóa behavior.
- Verification pass hoặc ghi rõ rủi ro.

## Plan
- Thêm effect chỉ chạy 1 lần cho deep-link step 2 để lấy tọa độ hiện tại và gọi `autoFillDistrictWardFromCoordinates()`.
- Không block UI nếu GPS fail.
- Thêm e2e assert `Hoài Đức` + `An Khánh` được selected ở step 2.
- Chạy focused tests/checks.

## Done
- Root cause: deep-link `?step=2` chỉ set `currentStep=2`, bỏ qua nhánh bước 1 gọi GPS + `autoFillDistrictWardFromCoordinates()`.
- Fix: khi route query có `name` và `step=2`, controller lấy vị trí hiện tại 1 lần bằng policy duplicate/location hiện có, lưu tọa độ check, rồi gọi auto-fill quận/xã. Nếu GPS fail thì không chặn form.
- E2E `deeplink từ search vào bước 2...` đã assert `Hoài Đức` và `Đức Thượng` được chọn tự động theo boundary seed từ tọa độ test.
- Giữ test back/next: quay về bước 1 vẫn giữ tên; bấm next lại về bước 2 và vẫn giữ quận/xã đã auto-fill.

## Verification
- Pass: `npm run test -- __tests__/helper/storeCreateFlow.test.js`
- Pass: `npm run test:e2e -- e2e/store-create.spec.js e2e/store-search.spec.js` (`16 passed`)
- Pass: `npm run lint`
- Pass: `npm run text:check`
- Pass: `git diff --check`
- Checklist verified:
  - Create Flow: deep-link step 2, auto-fill địa bàn, back/next, duplicate reset after name edit.
  - Search Flow: CTA click route vẫn pass browser back/forward.
  - Map Flow: chỉ dùng geolocation/resolver hiện có; không đổi step 3 map.
  - Tiếng Việt / UI Safety: text check pass.

## Risks / Next
- Chưa chạy toàn bộ e2e suite; đã chạy focused search/create.
