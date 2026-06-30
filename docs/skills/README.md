# NPP Hà Công Skill Pack

Bộ skill nội bộ cho NPP Hà Công gồm 2 phần:

- `storevis-project-execution.SKILL.md`: Luật code và guardrails theo đúng architecture/business/design/database của NPP Hà Công.
- `storevis-ai-collaboration.SKILL.md`: Khung cộng tác với AI để giao việc rõ, báo cáo rõ, verify rõ.

## OpenAI skills đã thêm

Các skill từ `openai/skills` được lưu trong `docs/skills/openai/`:

- `openai/playwright`: Tự động hóa browser thật cho navigation, form filling, snapshots, screenshots, data extraction, UI-flow debugging.
- `openai/playwright-interactive`: Debug UI/browser/Electron tương tác nhanh qua phiên browser bền vững.
- `openai/screenshot`: Chụp màn hình desktop/app/window/region khi cần kiểm tra visual hoặc khi browser-specific capture không đủ.

## Cách dùng khuyến nghị

Dùng đồng thời hai skill StoreVis trong mọi task kỹ thuật:

`Dùng $storevis-project-execution + $storevis-ai-collaboration cho task này.`

Nếu task có text tiếng Việt nhiều hoặc flow dễ lỗi encoding, bổ sung:

`+ $lean-vietnamese-dev-flow`

Nếu task liên quan UI/thiết kế/regression visual, bổ sung một hoặc nhiều skill OpenAI:

`+ $playwright + $playwright-interactive + $screenshot`
