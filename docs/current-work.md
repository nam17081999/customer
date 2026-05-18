# Current Work

## Goal
- Khôi phục màu header navbar và modal chi tiết store về palette cũ sau regression gần đây.

## Task Type
- Bug Fix

## Why
- User báo ngoài thẻ store, modal detail và header navbar cũng bị chỉnh màu.
- Cần so sánh lịch sử gần đây, xác định class màu bị đổi, sửa tối thiểu.

## In Scope
- Header/navbar đang render trên desktop/mobile.
- Modal chi tiết store mở từ Search card.
- So sánh 2-3 commit gần đây và dirty diff để tìm palette đổi.
- Sửa class màu/card/modal/header liên quan trực tiếp.

## Out of Scope
- Đổi search logic, filter, cache, store mutation.
- Đổi layout/navbar route, permission, modal actions/report/supplement behavior.
- Refactor lớn hoặc đổi design system.
- Thêm dependency.

## Must Preserve
- Pages Router và route hiện có.
- Store detail modal actions: gọi điện, bản đồ, bổ sung/sửa, báo cáo.
- Search card click mở modal đúng.
- Dark theme, contrast, font readable, touch target mobile.
- UTF-8 tiếng Việt.
- Không revert unrelated dirty changes.

## Inputs / Repro / Expected
- Input: user báo màu modal detail và header navbar bị đổi.
- Current: cần xác nhận qua diff/history/render.
- Expected: navbar + modal dùng lại palette cũ theo design system/trước regression, trên desktop và mobile.

## Constraints
- Dùng `apply_patch`.
- Patch nhỏ, giữ behavior.
- Tôn trọng dirty worktree hiện có.

## Required Verification
- `npm run lint`
- `npm run text:check`
- `git diff --check`
- Smoke/render `/` desktop/mobile, mở detail modal nếu có data.
- Checklist:
  - Checklist chung cho mọi task
  - Search Flow
  - Edit / Supplement / Report
  - Tiếng Việt / UI Safety

## Definition of Done
- Root cause palette navbar/modal xác định.
- Header navbar và modal detail được khôi phục màu.
- Lint/text/diff pass hoặc ghi rõ blocker.
- Có bằng chứng smoke desktop/mobile.

## Plan
- Diff `components/layout/app-navbar.jsx`, `components/navbar.jsx`, `components/store-detail-modal.jsx` với 2-3 commit gần đây.
- Tìm class `slate/neutral` thay cho `gray/black` hoặc màu surface cũ.
- Patch scoped.
- Smoke desktop/mobile + modal detail.

## Done
- Checked recent history/diff for `components/layout/app-navbar.jsx` and `components/store-detail-modal.jsx`.
- Restored navbar colors:
  - desktop header: `bg-slate-950/82`, `text-slate-*`
  - mobile bottom nav: `bg-gray-950/95`, `border-gray-800`, `text-gray-*`
- Restored Store Detail Modal colors:
  - mobile modal/header/info/actions: `gray-*`
  - desktop modal shell/map aside: `slate-*`
  - removed unintended `neutral-*` / `zinc-*` palette from navbar/modal.
- Kept existing refactor/subcomponent/router/action behavior intact.

## Verification
- Pass: `npm run lint`
  - 0 errors.
  - 1 existing warning remains in `pages/orders/[id].js:272` for external `<img>`.
- Pass: `npm run text:check`
  - No mojibake detected.
- Pass: `git diff --check`.
- Pass: desktop smoke render at `http://localhost:3001/`
  - Navbar computed with `bg-slate-950/82`.
  - Detail modal opened from first store card and rendered `slate/gray` shell.
  - Screenshot: `/tmp/store-search-modal-desktop.png`.
- Pass: mobile smoke render at `http://localhost:3001/`
  - Detail modal opened from first store card and rendered `gray` mobile shell/header/actions.
  - Screenshot: `/tmp/store-search-modal-mobile.png`.
- Checklist verified:
  - Checklist chung cho mọi task: scoped fix, docs reread, no dependency added, lint/text/diff checked.
  - Search Flow: card click/open modal behavior smoke-tested; search logic unchanged.
  - Edit / Supplement / Report: modal action buttons still render; action logic unchanged.
  - Tiếng Việt / UI Safety: UTF-8 scan passed; contrast/surface checked visually on desktop/mobile.

## Risks / Next
- Did not run full `npm run test`; fix is CSS palette-only plus visual smoke.
- Worktree has pre-existing unrelated modified files; intentionally touched for this request:
  - `components/layout/app-navbar.jsx`
  - `components/search-store-card.jsx`
  - `components/store-detail-modal.jsx`
  - `docs/current-work.md`
