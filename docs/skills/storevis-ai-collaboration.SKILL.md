---
name: storevis-ai-collaboration
description: Dùng để chuẩn hóa cách AI trao đổi, phân rã task, báo cáo tiến độ, kiểm chứng, và ra quyết định nhanh khi phát triển StoreVis.
---

# StoreVis AI Collaboration

Skill này tập trung vào cách AI làm việc với bạn để tăng tốc, giảm vòng lặp, và giữ tính nhất quán.

## Mục tiêu

- Nhận task rõ, tách việc rõ, làm xong tới nơi.
- Giảm hỏi lại không cần thiết.
- Trả kết quả ngắn gọn nhưng đủ để quyết định nhanh.

## Cách AI xử lý task

1. Tóm tắt lại mục tiêu trong 1-2 câu.
2. Chốt giả định hợp lý nếu thiếu thông tin không rủi ro cao.
3. Chỉ hỏi lại khi thiếu dữ liệu khiến triển khai dễ sai logic.
4. Chia task thành các bước nhỏ có thể kiểm chứng.
5. Làm xong bước nào thì verify bước đó.

## Rule khi cần hỏi lại

- Chỉ hỏi nếu câu trả lời làm thay đổi thiết kế/logic cốt lõi.
- Mỗi lần hỏi tối đa 1-3 câu ngắn, trực tiếp.
- Nếu có thể suy luận an toàn từ docs/code thì tự quyết và ghi rõ giả định.

## Output contract cho mọi phản hồi kỹ thuật

- `Mục tiêu`: AI hiểu cần đạt điều gì.
- `Thay đổi`: AI đã sửa gì.
- `File`: file liên quan.
- `Kiểm chứng`: lệnh/test/smoke test đã chạy.
- `Rủi ro`: điểm chưa chắc hoặc chưa test được.
- `Bước tiếp`: chỉ nêu nếu thật sự cần hành động tiếp.

## Rule quản lý scope

- Không mở rộng yêu cầu ngoài task user đưa.
- Không trộn refactor lớn vào bugfix nhỏ.
- Nếu thấy vấn đề ngoài scope, chỉ note ngắn ở phần rủi ro hoặc đề xuất tiếp theo.

## Rule chất lượng trước khi kết thúc

- Không kết luận “xong” nếu chưa có bằng chứng verify mới.
- Nếu không chạy được test/lint phải nêu rõ lý do.
- Ưu tiên bằng chứng thực tế trên flow bị tác động.

## Prompt template gợi ý cho user

### Template tính năng

`Dùng $storevis-project-execution + $storevis-ai-collaboration. Thêm tính năng [X] ở [route/file], yêu cầu [Y], xong khi [điều kiện done].`

### Template bugfix

`Dùng $storevis-project-execution + $storevis-ai-collaboration. Sửa bug [mô tả], tái hiện bằng [bước], expected [kỳ vọng], không làm đổi [phạm vi không được đổi].`

### Template review

`Dùng $storevis-project-execution + $storevis-ai-collaboration. Review thay đổi ở [file/PR], tập trung vào regression, data safety, performance, accessibility.`

