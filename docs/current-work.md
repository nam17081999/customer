# Task Request

## Goal
- Lấy icon gọi điện của thẻ cửa hàng ở màn tìm kiếm để dùng cho modal chi tiết cửa hàng.

## Task Type
- Feature

## Why
- Icon gọi điện trong modal detail cần đồng bộ hình dáng với card tìm kiếm.

## In Scope
- Tìm SVG icon gọi điện trong card tìm kiếm.
- Thay SVG gọi điện trong modal detail bằng cùng path/icon đó.
- Giữ nguyên màu sắc, style, link `tel:`, aria-label và behavior của modal detail.

## Out of Scope
- Không đổi logic gọi điện, telesale dialog, card tìm kiếm, modal layout.
- Không đổi text tiếng Việt hoặc action khác.

## Must Preserve
- Button/link gọi điện trong modal vẫn mở `tel:` đúng số.
- Màu/kích thước theo style hiện tại của modal giữ nguyên.
- Search card không bị đổi thêm.

## Inputs / Repro / Expected
- Repro: modal detail đang dùng icon điện thoại khác với card tìm kiếm.
- Expected: modal detail dùng cùng hình icon gọi điện như card tìm kiếm.

## Constraints
- Sửa tối thiểu.
- Không thêm dependency.

## Required Verification
- Chạy lint sau khi sửa.
- Smoke review code: chỉ thay SVG icon trong modal detail, không đổi `href`/handler.
- Đối chiếu checklist `Store Detail / Actions`, `Search Flow`, `Tiếng Việt / UI Safety`.

## Definition of Done
- Icon gọi điện trong modal detail đồng bộ với card tìm kiếm.
- Behavior và style không đổi.
- Có bằng chứng kiểm chứng mới.

## Plan
- So sánh icon gọi điện ở search card và modal detail.
- Thay path SVG trong modal detail.
- Chạy lint và review diff.
- Cập nhật kết quả task.

## Done
- Xác định card tìm kiếm dùng icon phone filled với path bắt đầu `M6.62 10.79...`.
- Thay cả icon phone ở dòng thông tin số điện thoại và icon trong nút gọi của modal detail sang cùng path này.
- Dùng `fill="currentColor"` để giữ màu từ class hiện tại: `text-gray-500` cho icon thông tin và `text-gray-400` cho nút gọi.
- Giữ nguyên `href={buildTelHref(phoneValue)}`, `aria-label`, layout và behavior gọi điện.

## Verification
- `npm.cmd run lint` passed.
- `git diff --check` không báo lỗi whitespace.
- Smoke review code: chỉ thay SVG trong modal detail; không đổi search card, telesale dialog, `tel:` link hoặc action khác.
- Đã đối chiếu checklist: `Store Detail / Actions`, `Search Flow`, `Tiếng Việt / UI Safety` ở phạm vi UI/icon.

## Risks / Next
- Chưa mở browser kiểm tra trực quan; nên xem nhanh modal detail có nhiều số điện thoại để confirm icon hiển thị đúng.
