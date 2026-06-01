# Current Work

## Goal
- Thêm skill `design-taste-frontend` từ repo taste-skill vào workspace để dùng chung.

## Task Type
feature

## Why
- Người dùng yêu cầu thêm taste-skill vào dự án để dùng cho các task UI/thiết kế.

## In Scope
- Tạo skill file tại `.github/skills/design-taste-frontend/SKILL.md`.
- Cập nhật `docs/skills/README.md` để ghi nhận skill mới.
- Cập nhật `docs/current-work.md` theo template.

## Out of Scope
- Không chỉnh sửa code app, UI, business logic, schema, cache rules.
- Không thêm dependency runtime.

## Must Preserve
- Pages Router và alias import `@/`.
- Quy tắc cache, search, map, và UTF-8 tiếng Việt.
- Không thay đổi flow nghiệp vụ hiện có.

## Inputs / Expected
- Input: https://github.com/Leonxlnx/taste-skill, install name `design-taste-frontend`.
- Expected: skill file có frontmatter hợp lệ và nằm đúng path workspace.

## Constraints
- Dùng cấu trúc chuẩn `.github/skills/<name>/SKILL.md` theo hướng dẫn agent-customization.

## Required Verification
- Kiểm tra file mới tồn tại và frontmatter hợp lệ.
- Regression checklist: Checklist chung cho mọi task.

## Definition of Done
- Skill file được thêm đúng path với nội dung đầy đủ.
- `docs/skills/README.md` được cập nhật.

## Output Contract
- Goal
- What changed
- Files touched
- Verification done
- Risks or unverified parts

## Plan
1. Lấy nội dung skill `design-taste-frontend` từ repo taste-skill.
2. Tạo `.github/skills/design-taste-frontend/SKILL.md`.
3. Cập nhật `docs/skills/README.md`.
4. Xác nhận file và nội dung hợp lệ.

## Done
- Thêm skill `design-taste-frontend` vào `.github/skills/design-taste-frontend/SKILL.md`.
- Cập nhật `docs/skills/README.md` để ghi nhận skill mới.

## Verification
- Đã kiểm tra file skill mới và frontmatter hợp lệ.

## Risks / Next
- Chưa chạy lint/test (không chạm code runtime).
