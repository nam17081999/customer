# Task Request

## Goal
- Giảm trường hợp `Lấy lại vị trí` nhảy rất xa vị trí thật bằng cách cải thiện thuật toán chọn mẫu GPS trong `getBestPosition()`, theo hướng:
  - không chốt quá sớm ở mẫu đầu tiên
  - lọc trường hợp nhảy xa bất thường
  - ưu tiên chất lượng cao hơn cho refresh path

## Task Type
- Bug Fix

## Why
- Hiện tại refresh GPS đôi lúc trả về vị trí rất xa vị trí thật dù user đang đứng yên.
- Nguyên nhân nghi ngờ lớn nhất nằm ở cách `getBestPosition()` chọn mẫu dựa quá nhiều vào `accuracy` và early-exit quá sớm.

## In Scope
- `helper/geolocation.js`
- helper geolocation phụ nếu cần
- test helper geolocation liên quan
- `helper/locationPolicy.js` nếu cần chỉnh refresh policy nhẹ
- `docs/current-work.md`

## Out of Scope
- Không đổi business rule create/edit/report submit.
- Không đổi base map component.
- Không refactor controller flow lớn.

## Must Preserve
- `Lấy lại vị trí` vẫn là fresh read.
- Bootstrap step 3 vẫn tách với refresh policy.
- Không làm hỏng các case GPS tốt đang hoạt động bình thường.
- Nếu không đủ dữ liệu tốt hơn, vẫn phải trả được kết quả hợp lý thay vì treo vô hạn.

## Inputs / Repro / Expected
- Repro: bấm `Lấy lại vị trí`, có lúc vị trí bị nhảy xa bất thường.
- Expected:
  - thuật toán không chốt ngay ở mẫu đầu chỉ vì accuracy đạt ngưỡng
  - nếu mẫu mới nhảy xa bất thường so với mẫu tốt hiện có thì cần thận trọng hơn
  - refresh path ưu tiên đúng hơn nhanh

## Constraints
- Test-first thật sự.
- Không thêm dependency mới.
- Giữ thay đổi tập trung ở thuật toán geolocation.

## Required Verification
- Test mới cho helper/chọn mẫu geolocation.
- `npm test -- --run __tests__/helper/geolocation.test.js`
- `npm test`
- `npm run lint`
- `npm run build`

## Definition of Done
- Có test khóa case chốt sớm sai và jump bất thường.
- `getBestPosition()` chọn mẫu an toàn hơn cho refresh path.
- Full test/lint/build xanh.

## Output Contract
- Báo cáo cuối phải có:
  - Goal
  - What changed
  - Files touched
  - Verification done
  - Risks or unverified parts
