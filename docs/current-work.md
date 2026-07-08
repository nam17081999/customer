# Current Work

## Goal
Thay thế toàn bộ skill hiện có (storevis-project-execution, storevis-ai-collaboration) bằng 6 skill từ mattpocock/skills: code-review, diagnosing-bugs, handoff, grilling, tdd, improve-codebase-architecture.

## Task Type
Refactor

## In Scope
- Xoá `docs/skills/storevis-project-execution.SKILL.md`
- Xoá `docs/skills/storevis-ai-collaboration.SKILL.md`
- Thêm 6 skill mới từ mattpocock/skills (convert format Claude Code → opencode .SKILL.md)
- Cập nhật `AGENTS.md` — Default Skill Stack mới
- Cập nhật `docs/skills/README.md` — danh sách skill mới
- OpenAI skills (playwright, playwright-interactive, screenshot) giữ nguyên

## Out of Scope
- Các skill OpenAI (playwright, playwright-interactive, screenshot)
- Nội dung khác ngoài skill system

## Must Preserve
- Cấu trúc AGENTS.md (Mission, Architecture Constraints, Data Safety Rules, v.v.)
- AGENTS.md section 3 (Default Skill Stack) — chỉ đổi tên skill
- Format YAML frontmatter của .SKILL.md
- Tính tương thích với opencode `skill()` tool

## Required Verification
- `npm run lint` — 0 errors
- 6 file .SKILL.md mới có frontmatter đúng format
- AGENTS.md không còn reference skill cũ
- README.md khớp với skill thực tế

## Plan
1. Fetch nội dung 6 skill từ mattpocock/skills
2. Xoá 2 skill cũ
3. Write 6 file .SKILL.md mới (convert format)
4. Update AGENTS.md
5. Update docs/skills/README.md
6. Verify lint + nội dung

---

## Done

✅ **Fetched** — all 6 SKILL.md + reference files (tdd/tests.md + mocking.md, codebase-design/SKILL.md, HTML-REPORT.md) from mattpocock/skills
✅ **Removed** — `storevis-project-execution.SKILL.md`, `storevis-ai-collaboration.SKILL.md`
✅ **Written** — 6 new .SKILL.md files:
  - `code-review.SKILL.md` — two-axis review (Standards + Spec) via parallel sub-agents
  - `diagnosing-bugs.SKILL.md` — 6-phase debug loop (feedback loop → reproduce → hypothesise → instrument → fix → post-mortem)
  - `handoff.SKILL.md` — compact conversation → temp dir, with suggested skills
  - `grilling.SKILL.md` — one-at-a-time interview to align on plan/design
  - `tdd.SKILL.md` — red-green-refactor with inline good/bad test examples + mocking guide
  - `improve-codebase-architecture.SKILL.md` — scan → HTML report (Tailwind+Mermaid) → grill, with inline codebase-design vocabulary
✅ **Updated AGENTS.md**:
  - Section 2: points 11-12 → `grilling.SKILL.md`, `tdd.SKILL.md`
  - Section 3: default stack → `$grilling` + `$tdd`, add when needed for bugs/review/architecture/handoff
✅ **Updated docs/skills/README.md** — lists all 6 engineering skills + OpenAI skills
✅ **Updated ai-start.md** — references updated
✅ **Lint** — `npm run lint`: 0 errors

## Verification
- ✅ `npm run lint` — 0 errors
- ✅ 6 .SKILL.md files exist with correct YAML frontmatter
- ✅ No references to old `storevis-*` skills remain across the repo
- ✅ AGENTS.md default stack points to new skills
- ✅ ai-start.md updated

## Risks / Next
- **improve-codebase-architecture** references `/codebase-design` vocabulary; essential terms (module, interface, depth, seam, adapter, leverage, locality) are inlined, but the skill also references `DEEPENING.md` and `DESIGN-IT-TWICE.md` — can be fetched on demand if needed.
- **Opencode không dùng skill mới tự động.** Các .SKILL.md này được reference trong AGENTS.md nhưng opencode chỉ load skill qua tool `skill()` khi được gọi tên trong `<available_skills>`. Hiện tại system prompt chỉ có `customize-opencode` — muốn opencode nhận diện thì cần config `.opencode/` directory hoặc `opencode.json`.

---

## Task 2: Xoá audit snapshot docs + cập nhật analysis-report.md

### Goal
Dọn dẹp 3 file audit snapshot đã lạc hậu, cập nhật analysis-report.md với số liệu hiện tại.

### Task Type
Refactor (dọn docs)

### Done
- ✅ **Xoá** `form-msg-audit.md` — snapshot audit hết hạn, không tracking
- ✅ **Xoá** `ui-states-audit.md` — snapshot audit hết hạn, không tracking
- ✅ **Xoá** `audit-log-analysis.md` — snapshot audit hết hạn, không tracking
- ✅ **Cập nhật** `analysis-report.md`:
  - Ngày + ghi chú "Cập nhật: 2026-07-08"
  - Test stats: 48→60 files, 482→665 tests, 5→2 failures
  - Migrations: 13→15
  - Commits: 324→350
  - Phân tích test fail: cập nhật danh sách 2 file còn fail + ghi chú 3 file đã fix
  - Critical risks: strikethrough 4 mục đã fix
  - Priority 1: gộp còn 1 mục (fix 2 test failures), bỏ mục homeSearch đã fix

### Verification
- ✅ 3 file audit đã xoá khỏi `docs/`
- ✅ `analysis-report.md` số liệu khớp với codebase hiện tại
