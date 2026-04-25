# Task Request

## Goal
- Làm cho website khi được thêm ra màn hình chính trên iPhone hiển thị theo kiểu giống Safari thay vì giao diện full-screen standalone khác biệt.

## Task Type
- Bug Fix

## Why
- Hiện tại cùng một trang `/map` nhưng khi mở bằng biểu tượng trên màn hình chính iPhone thì giao diện khác Safari.
- Root cause cần xử lý ở cấu hình PWA/display mode để 2 môi trường hiển thị nhất quán như yêu cầu.

## In Scope
- `docs/current-work.md`
- `public/manifest.json`
- `pages/_app.js`
- Có thể chạm rất nhỏ tới meta PWA liên quan iPhone nếu cần để bỏ standalone mode.

## Out of Scope
- Không sửa logic map, route, search, geolocation, cache.
- Không redesign component hay thay đổi layout Safari hiện tại.
- Không thêm dependency hoặc refactor cấu trúc app.

## Must Preserve
- Ứng dụng vẫn mở bình thường trên iPhone, Safari và các môi trường khác.
- Các route hiện tại, navbar, map flow, accessibility và tiếng Việt phải giữ nguyên.
- Không làm hỏng manifest/icon hiện có ngoài phần display mode cần đổi.

## Inputs / Repro / Expected
- Repro: trên iPhone, thêm web vào màn hình chính rồi mở từ icon; giao diện nhận được giống ảnh 1. Mở cùng trang bằng Safari thì giống ảnh 2.
- Current: bản mở từ màn hình chính đang chạy ở chế độ app standalone nên khác layout/browser chrome so với Safari.
- Expected: bản mở từ màn hình chính cũng hiển thị như Safari, càng đồng nhất càng tốt với ảnh 2.

## Constraints
- Sửa tối thiểu, ưu tiên đúng root cause.
- Không vá CSS riêng cho từng màn hình nếu nguyên nhân là cấu hình PWA/display mode.

## Required Verification
- Kiểm tra lại `public/manifest.json` và `pages/_app.js` để xác nhận không còn ép iPhone vào standalone mode.
- Chạy `npm.cmd exec eslint pages/_app.js`.
- Parse lại `public/manifest.json` để xác nhận JSON hợp lệ.
- Đối chiếu checklist các mục liên quan `Map Flow`, `Navigation / layout mobile`, `Tiếng Việt / UI Safety`.

## Definition of Done
- Root cause được xác định rõ là chế độ standalone PWA.
- Cấu hình app không còn ép iPhone home-screen chạy giao diện standalone khác Safari.
- Không có thay đổi ngoài scope.

## Plan
- Ghi lại task bugfix hiện tại vào working memory.
- Bỏ cấu hình standalone khiến iPhone mở như app riêng.
- Kiểm tra nhanh manifest/meta và cập nhật kết quả verify.

## Done
- Xác định root cause là cấu hình PWA đang ép home-screen app chạy ở chế độ standalone qua `public/manifest.json` và iPhone web-app meta trong `pages/_app.js`.
- Đã đổi `display` trong `public/manifest.json` từ `standalone` sang `browser` để khi mở từ màn hình chính ưu tiên hành vi giống Safari.
- Đã bỏ các meta `mobile-web-app-capable`, `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style` trong `pages/_app.js` để không tiếp tục ép iPhone vào app shell riêng.

## Verification
- `npm.cmd exec eslint pages/_app.js` passed.
- `node -e "JSON.parse(require('fs').readFileSync('public/manifest.json','utf8')); console.log('manifest ok')"` passed.
- Đã smoke review scope thay đổi: không đụng logic map, route, navbar, cache; chỉ đổi cấu hình display/meta.
- Đã đối chiếu checklist: `Map Flow`, `Navigation / layout mobile`, `Tiếng Việt / UI Safety` ở mức scope code thay đổi.

## Risks / Next
- Sau khi deploy, iPhone có thể cần xóa biểu tượng cũ khỏi màn hình chính rồi thêm lại để nhận manifest/meta mới.
- Nếu Safari hoặc iOS còn cache manifest cũ, có thể cần reload mạnh hoặc chờ cache cập nhật trước khi retest.