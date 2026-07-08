# NPP Hà Công Skill Pack

Bộ skill nội bộ cho NPP Hà Công (chuyển đổi từ mattpocock/skills).

## Engineering skills

- `grilling.SKILL.md`: Phỏng vấn user để làm rõ yêu cầu/thiết kế trước khi code.
- `tdd.SKILL.md`: Test-driven development — red-green-refactor loop.
- `code-review.SKILL.md`: Review code theo 2 trục Standards + Spec, chạy song song.
- `diagnosing-bugs.SKILL.md`: 6-phase debug loop cho bug cứng đầu và performance regression.
- `improve-codebase-architecture.SKILL.md`: Scan codebase, tạo HTML report, đề xuất deepening opportunities.
- `handoff.SKILL.md`: Bàn giao context giữa các session.

## OpenAI skills

Các skill từ `openai/skills` được lưu trong `docs/skills/openai/`:

- `openai/playwright`: Tự động hóa browser — navigation, form filling, snapshots, data extraction.
- `openai/playwright-interactive`: Debug UI/browser tương tác qua phiên browser bền vững.
- `openai/screenshot`: Chụp màn hình desktop/app/window/region.

## Cách dùng khuyến nghị

`Dùng $grilling + $tdd cho task này.`

Thêm khi cần:

`+ $diagnosing-bugs + $code-review + $improve-codebase-architecture + $handoff`

Nếu task có text tiếng Việt nhiều:

`+ $lean-vietnamese-dev-flow`

Nếu task liên quan UI/visual regression, bổ sung OpenAI skills:

`+ $playwright + $playwright-interactive + $screenshot`
