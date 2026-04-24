# AI Task Types

File này định nghĩa loại task và mức bằng chứng tối thiểu phải có.

## Rule bắt buộc

- Mỗi task chỉ được chọn 1 `Task Type` chính trước khi bắt đầu.
- Nếu yêu cầu chứa nhiều loại việc, phải tách phase và làm lần lượt.
- `Task Type` đã chọn phải xuất hiện trong template task và phải chi phối cách verify.

## 1. Bug Fix

Dùng khi:
- hành vi đang sai
- có lỗi runtime
- có regression
- có case user làm không được dù flow đáng ra phải chạy

Bắt buộc trước khi sửa:
- mô tả được cách tái hiện
- nêu được kết quả đang có và kết quả mong muốn
- tìm root cause trước khi vá
- thêm hoặc cập nhật test tái hiện lỗi nếu vùng đó test được

Bằng chứng tối thiểu trước khi báo xong:
- test hoặc smoke test chứng minh lỗi cũ không còn
- verify flow chính bị lỗi
- verify nhanh ít nhất 1 flow gần kề nếu logic dùng chung

## 2. Refactor With Tests First

Dùng khi:
- muốn tách logic khỏi page/component
- muốn gom logic trùng dùng chung
- muốn đổi cấu trúc nhưng không được đổi behavior nghiệp vụ

Bắt buộc trước khi sửa:
- nói rõ behavior nào phải giữ nguyên
- nói rõ phần nào chỉ đổi cấu trúc, không đổi business rule
- thêm test mới hoặc xác nhận test hiện có đã khóa đủ behavior trước khi tách

Bằng chứng tối thiểu trước khi báo xong:
- test cũ và test mới vẫn xanh ở vùng bị tách
- nêu rõ logic nào đã được tách ra
- nêu rõ phần nào vẫn chưa tách

## 3. Feature

Dùng khi:
- thêm hành vi mới
- mở rộng UI/flow hiện có
- thêm support cho case chưa có trước đó

Bắt buộc trước khi sửa:
- mô tả rõ hành vi mới
- nói rõ phạm vi không làm
- ghi rõ rule cũ nào phải giữ
- chuẩn bị verification cho happy path và guardrail chính

Bằng chứng tối thiểu trước khi báo xong:
- test hoặc smoke test cho hành vi mới nếu vùng đó test được
- verify flow mới hoạt động
- verify các rule cũ quan trọng không bị phá

## 4. Review / Regression Check

Dùng khi:
- user muốn review
- user muốn kiểm tra khác biệt logic
- user muốn rà regression, rủi ro, thiếu test

Bắt buộc trước khi làm:
- xác định phạm vi review
- ưu tiên bug, regression, missing tests, rủi ro dữ liệu
- không sa vào tóm tắt dài trước khi nêu finding

Bằng chứng tối thiểu trước khi báo xong:
- finding phải có file/line rõ ràng nếu có
- nếu không có finding thì nói rõ không thấy lỗi nào trong phạm vi đã kiểm
- nêu phần chưa verify được hoặc khoảng trống test

## Cách chọn nhanh

- Có lỗi đang xảy ra hoặc user không hoàn thành được flow: `Bug Fix`
- Muốn tách logic, gom logic trùng, giữ nguyên behavior: `Refactor With Tests First`
- Muốn thêm hành vi mới hoặc mở rộng flow: `Feature`
- Muốn phân tích/rà soát mà chưa yêu cầu sửa: `Review / Regression Check`

## Output yêu cầu theo loại task

- `Bug Fix`: phải có `root cause`, `fix`, `verification`, `residual risk`
- `Refactor With Tests First`: phải có `logic đã tách`, `logic còn nằm lại`, `test bảo vệ`
- `Feature`: phải có `hành vi mới`, `guardrail giữ nguyên`, `verification`
- `Review / Regression Check`: phải có `findings first`, `assumptions`, `gaps`
