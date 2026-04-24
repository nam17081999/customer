# AI Task Template

Template này là đầu vào chuẩn cho mọi phiên AI trên repo này.

Mục tiêu:
- giữ đúng scope
- giảm quên yêu cầu sau phiên dài
- buộc task có tiêu chí kiểm chứng trước khi làm

## Rule bắt buộc

- Mọi task phải có 1 bản mô tả theo template này trước khi AI bắt đầu implement hoặc review.
- Nếu user không gửi theo template, AI phải tự chuẩn hóa yêu cầu hiện có về đúng cấu trúc này trước khi sửa code/docs.
- `Task Type` bắt buộc lấy từ `docs/ai-task-types.md`.
- Các mục `Goal`, `In Scope`, `Out of Scope`, `Must Preserve`, `Required Verification` là tối thiểu; thiếu thì AI phải tự làm rõ từ docs/code hoặc hỏi thêm khi rủi ro cao.
- Nội dung cốt lõi của template phải được phản ánh lại trong `docs/current-work.md`.

## Template dùng hằng ngày

```md
# Task Request

## Goal
- Việc cần đạt được là gì.

## Task Type
- Chọn đúng 1 loại chính từ `docs/ai-task-types.md`.

## Why
- Vấn đề hiện tại là gì.
- Tại sao cần làm bây giờ.

## In Scope
- Các flow, route, file, hoặc hành vi được phép chạm vào.

## Out of Scope
- Những gì không được mở rộng sang trong task này.

## Must Preserve
- Các rule nghiệp vụ, UX, data safety, cache, search, map, auth, accessibility phải giữ nguyên.

## Inputs / Repro / Expected
- Bugfix: cách tái hiện, kết quả đang có, kết quả mong muốn.
- Feature/refactor: đầu vào chính, hành vi mong muốn, giới hạn rõ ràng.

## Constraints
- Giới hạn kỹ thuật hoặc quy trình cần giữ.

## Required Verification
- Lệnh, test, smoke test, hoặc checklist section bắt buộc phải có trước khi báo xong.

## Definition of Done
- Điều kiện nào thì task mới được coi là hoàn thành.

## Output Contract
- Báo cáo cuối phải có:
  - Goal
  - What changed
  - Files touched
  - Verification done
  - Risks or unverified parts
```

## AI start checklist

Trước khi sửa file, AI phải làm đủ các bước sau:
1. Chọn `Task Type`.
2. Chuẩn hóa task theo template này.
3. Cập nhật `docs/current-work.md`.
4. Chọn section cần verify trong `docs/regression-checklist.md`.
5. Chỉ bắt đầu implement sau khi 4 bước trên đã rõ.

## Khi task bị trộn nhiều loại

- Nếu 1 yêu cầu chứa nhiều loại task, AI phải tách thành phase.
- Mỗi phase chỉ có 1 `Task Type` chính.
- Không gộp `bugfix + refactor + feature` thành 1 lần làm nếu bằng chứng verify cho từng phần khác nhau.
