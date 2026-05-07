# Task Request

## Goal
- Chuẩn hóa thêm derived fields một lần trong search index, nhưng phải viết test sâu đầy đủ trước rồi mới implement.

## Task Type
- Refactor With Tests First

## Why
- Search/map/home hiện đã có một phần derived fields cho `name`, nhưng chưa khóa test sâu cho việc mở rộng các field chuẩn hóa khác.
- User muốn đi tiếp theo hướng này và ưu tiên test-first để chắc không đổi logic hiện có.

## In Scope
- `helper/storeSearch.js`
- `helper/homeSearch.js`
- `helper/mapSearchPanel.js`
- test search/home/map liên quan
- `docs/current-work.md`

## Out of Scope
- Không đổi business rule search ranking hiện có.
- Không đổi flow URL sync.
- Không đổi duplicate detection business rules.

## Must Preserve
- Search tiếng Việt có dấu / không dấu / phonetic / near-match vẫn giữ nguyên ưu tiên.
- Home và map tiếp tục dùng cùng logic search shared.
- Filter district/ward/type/flags giữ nguyên output hiện có.
- Không giảm độ đúng của case existing tests đang bảo vệ.

## Inputs / Repro / Expected
- Input: build index rồi search/filter ở home/map.
- Expected: index có thêm derived fields chuẩn hóa để dùng lại, giảm work lặp; output search/filter không đổi.

## Constraints
- Viết test sâu trước khi refactor.
- Không thêm dependency mới.
- Giữ UTF-8 an toàn.

## Required Verification
- Test mới cho derived fields + search/filter regression.
- `npm test -- --run __tests__/helper/storeSearch.test.js __tests__/helper/homeSearch.test.js __tests__/helper/mapSearchPanel.test.js`
- `npm test`
- `npm run lint`
- Rà checklist liên quan: `Search Flow`, `Map Flow`, `Tiếng Việt / UI Safety`.

## Definition of Done
- Có test sâu khóa derived fields mới và output cũ.
- Implementation chuẩn hóa thêm derived fields một lần.
- Full regression và lint xanh.

## Output Contract
- Báo cáo cuối phải có:
  - Goal
  - What changed
  - Files touched
  - Verification done
  - Risks or unverified parts

## Done
- Viết test sâu trước cho derived fields mới trong search index (`normalizedDistrict`, `normalizedWard`, `normalizedStoreType`).
- Viết regression test cho home/map để khóa output filter không đổi khi dùng derived fields chuẩn hóa sẵn.
- Implement chuẩn hóa thêm các field phụ ngay trong `buildStoreSearchIndex()`.
- Cho home/map dùng lại derived fields chuẩn hóa này thay vì tiếp tục dựa hoàn toàn vào raw field ở predicate/filter path.
- Chạy lại focused tests, full suite, và lint.

## Verification
- `npm test -- --run __tests__/helper/storeSearch.test.js __tests__/helper/homeSearch.test.js __tests__/helper/mapSearchPanel.test.js` passed: `3` files, `77` tests.
- `npm test` passed: `26` files, `320` tests.
- `npm run lint` passed.
- Đối chiếu checklist liên quan: `Search Flow`, `Map Flow`, `Tiếng Việt / UI Safety`.

## Risks / Next
- Tối ưu này giảm work lặp và thống nhất normalization hơn, nhưng lợi ích perf chủ yếu nằm ở filter/search path; nó không thay đổi lớn runtime map render như các tối ưu source/layer trước.
- Nếu muốn đi tiếp, bước hợp lý là rà xem còn field nào trong search/filter path vẫn đang normalize lặp lại mỗi lần query để đưa nốt vào index hoặc query meta.
