# Current Work

## Goal
- Rà soát dependency/package của project: tìm package cũ, cập nhật an toàn, phát hiện package không dùng để xóa nếu có bằng chứng, và sửa các vấn đề cấu hình/package hygiene rõ ràng.

## Task Type
- Refactor With Tests First

## Why
- User yêu cầu kiểm tra package cũ, update, xóa package không dùng, và chỉnh phần chưa tốt.
- Dependency update có thể gây regression build/lint/test nên cần làm có kiểm chứng và không mở rộng sang refactor UI/business.

## In Scope
- `package.json`
- `package-lock.json`
- Dependency/devDependency hiện có.
- Cấu hình/lệnh package hygiene nếu phát hiện vấn đề trực tiếp liên quan.
- Kiểm chứng lint/test/build phù hợp sau thay đổi.

## Out of Scope
- Không đổi business logic search/create/edit/map/report.
- Không refactor code ứng dụng chỉ vì dependency update, trừ khi bắt buộc để tương thích phiên bản mới.
- Không thêm dependency mới nếu không cần.
- Không xóa package chỉ dựa vào tool báo cáo khi repo dùng dynamic import, framework config, hoặc CLI script cần package đó.

## Must Preserve
- Next.js Pages Router hiện tại.
- React/Next/Tailwind/MapLibre/Supabase flows vẫn build/lint/test được.
- Map/search/store cache behavior không đổi.
- File tiếng Việt vẫn UTF-8.
- Không phá các thay đổi đang có trong working tree từ task trước.

## Inputs / Repro / Expected
- Input: `package.json`, `package-lock.json`, npm registry, usage trong source/scripts/tests/e2e/config.
- Expected:
  - Danh sách package outdated rõ ràng.
  - Update package hợp lý và lockfile đồng bộ.
  - Xóa dependency thật sự không dùng nếu có bằng chứng.
  - Báo rõ package nào giữ lại dù tool nghi unused và lý do.

## Constraints
- `npm outdated` mặc định đang lỗi do quyền/cache `~/.npm`; dùng cache cục bộ thay vì sửa cache user.
- Ưu tiên update có thể verify trong một lượt.
- Không dùng lệnh phá hủy git hoặc xóa thay đổi user.

## Required Verification
- `npm run lint`
- `npm run test`
- `npm run build` nếu dependency framework/runtime thay đổi.
- `npm run text:check`
- `git diff --check`
- Checklist: `Checklist chung`, `Tiếng Việt / UI Safety`; thêm flow checklist nếu phải sửa code runtime.

## Definition of Done
- Package outdated đã được rà bằng npm registry với cache cục bộ.
- Dependency unused đã được kiểm bằng tool và rà tay usage quan trọng.
- `package.json`/`package-lock.json` đồng bộ sau thay đổi.
- Verification pass hoặc failure được ghi rõ nguyên nhân.

## Plan
- Chạy `npm outdated` bằng cache cục bộ.
- Chạy dependency usage check (`depcheck`) bằng cache cục bộ và đối chiếu với `rg`.
- Chọn update/remove tối thiểu, tránh major breaking nếu không có bằng chứng an toàn.
- Chạy install/update để đồng bộ lockfile.
- Chạy lint/test/build/text/diff checks.
- Cập nhật kết quả và rủi ro còn lại.

## Done
- Đã chạy `npm outdated` bằng cache cục bộ vì cache mặc định `~/.npm` bị lỗi quyền/EEXIST.
- Đã xóa dependency không dùng `@react-google-maps/api`; source hiện không import package này, map picker đang dùng MapLibre và Google Maps link được xử lý bằng URL/API riêng.
- Đã cập nhật package trong major hiện tại:
  - `@radix-ui/react-dialog` `^1.1.14` -> `^1.1.15`
  - `@radix-ui/react-slot` `^1.2.3` -> `^1.2.4`
  - `@supabase/supabase-js` `^2.54.0` -> `^2.105.4`
  - `next` `^15.5.12` -> `^15.5.18`
  - `react-virtuoso` `^4.14.0` -> `^4.18.6`
  - `tailwind-merge` `^3.3.1` -> `^3.5.0`
  - `@eslint/eslintrc` `^3` -> `^3.3.5`
  - `@tailwindcss/postcss` `^4` -> `^4.3.0`
  - `@vitest/coverage-v8` `^4.1.4` -> `^4.1.5`
  - `eslint` `^9` -> `^9.39.4`
  - `eslint-config-next` `15.4.6` -> `^15.5.18`
  - `tailwindcss` `^4` -> `^4.3.0`
  - `vitest` `^4.1.4` -> `^4.1.5`
- Đã chạy `npm audit fix` không force; giảm audit từ 7 issues xuống còn 2 moderate.
- Đã giữ lại các package bị `depcheck` nghi unused nhưng thực tế dùng qua config/CSS:
  - `@tailwindcss/postcss` trong `postcss.config.mjs`
  - `tailwindcss` qua `@import "tailwindcss"` trong `app/globals.css`
  - `eslint-config-next` qua `compat.extends("next/core-web-vitals")` trong `eslint.config.mjs`
- Đã không nâng major các package còn lại (`next@16`, `eslint@10`, `maplibre-gl@5`, `lucide-react@1`, `react@19.2`, `react-dom@19.2`) vì đây là migration có rủi ro cao hơn, không cần để hoàn tất update an toàn trong scope này.

## Verification
- `npm run lint` ✅
- `npm run test` ✅ (30 files, 364 tests)
- `npm run build` ✅ (Next.js 15.5.18 build thành công)
- `npm run text:check` ✅
- `git diff --check` ✅
- `npx playwright test e2e/store-map.spec.js -g "storeId chỉ highlight"` ✅
- `npx playwright test e2e/store-search.spec.js -g "trang chủ load|tìm kiếm tiếng Việt"` ✅ (lần chạy song song trước đó bị `EADDRINUSE` do trùng port, chạy lại riêng pass)
- `npm_config_cache=/tmp/codex-npm-cache npx --yes depcheck --json` ✅ không còn dependency runtime unused; còn devDependency config false positives đã đối chiếu thủ công.
- Checklist:
  - `Checklist chung`: đã nêu scope, không đổi convention, không refactor ngoài package hygiene, đã chạy lint/test/build/smoke.
  - `Tiếng Việt / UI Safety`: không sửa UI copy; `text:check` pass.

## Risks / Next
- `npm audit` còn 2 moderate từ `next -> postcss` nội bộ. `npm audit fix --force` đề xuất hạ `next` về `9.3.3` nên không áp dụng. Cần theo dõi bản Next 15/16 vá advisory này hoặc lên Next 16 bằng task migration riêng.
- `npm outdated` còn major updates: `next@16`, `eslint@10`, `maplibre-gl@5`, `lucide-react@1`, `react/react-dom@19.2`. Chưa nâng trong task này để tránh breaking changes trên map/render/build.
- `npm ls --depth=0` vẫn hiển thị một số optional wasm packages là `extraneous` trong `node_modules` (`@emnapi/*`, `@napi-rs/wasm-runtime`, `@tybys/wasm-util`). Chúng đến từ optional wasm bindings trong lockfile của Tailwind/rolldown/unrs; `npm prune` không xóa và build/test pass.
