# Task Request

## Goal
- Ẩn phần bản đồ trong `StoreDetailModal` theo mặc định; chỉ hiện khi người dùng bấm mở và có thể bấm lại để ẩn đi.

## Task Type
- Feature

## Why
- Giảm chiều cao modal, giúp phần thông tin chính dễ đọc hơn.
- Tránh tải quá nhiều nội dung bản đồ ngay khi mở chi tiết cửa hàng.
- Giữ trải nghiệm gọn, chủ động, hợp lý hơn trên mobile.

## In Scope
- UI/UX phần mini map trong `components/store-detail-modal.jsx`.
- Trạng thái mở/đóng của mini map trong modal detail.
- Cách render `StoreDetailMiniMap` khi người dùng bật phần bản đồ.

## Out of Scope
- Không đổi logic bản đồ đầy đủ ở trang `/map`.
- Không đổi dữ liệu cửa hàng hay logic route.
- Không refactor lớn modal detail ngoài phần map block.

## Must Preserve
- Nếu cửa hàng không có tọa độ thì không hiện block mở bản đồ vô nghĩa.
- Nút `Bản đồ`/`Chỉ đường` hiện có vẫn hoạt động như cũ.
- Mini map khi được mở vẫn hiển thị đúng như hiện tại.
- UI dark theme, dễ bấm, rõ trạng thái mở/đóng.

## Inputs / Repro / Expected
- Input: mở `StoreDetailModal` với cửa hàng có tọa độ.
- Expected: mini map mặc định đang ẩn; có nút/card để bấm `Xem bản đồ`; bấm lần nữa thì thu gọn lại.

## Constraints
- Ưu tiên sửa tối thiểu trong modal detail.
- UI/UX phải rõ ràng trên mobile trước.

## Required Verification
- `npm.cmd run lint`
- Smoke review code cho `StoreDetailModal`.
- Đối chiếu checklist: `Store Detail / Actions`, `Map / Geolocation`, `Tiếng Việt / UI Safety`.

## Definition of Done
- Modal detail không tự hiện mini map nữa.
- Người dùng có thể chủ động mở/đóng mini map dễ hiểu.
- Không ảnh hưởng các action khác trong modal.

## Plan
- Xác định chỗ render mini map trong modal.
- Thiết kế block toggle mở/đóng hợp lý.
- Patch modal detail với trạng thái collapse.
- Chạy lint và cập nhật kết quả.

## Done
- Đổi mini map trong `StoreDetailModal` sang dạng thu gọn mặc định.
- Thêm card toggle full-width với mô tả ngắn, icon mũi tên và trạng thái mở/đóng rõ ràng.
- Reset trạng thái mở bản đồ khi đóng modal hoặc khi đổi sang store khác để tránh giữ state cũ.

## Verification
- `npm.cmd run lint` passed.
- Smoke review code: block bản đồ chỉ render khi store có tọa độ; action khác trong modal giữ nguyên.
- Đối chiếu checklist trong phạm vi liên quan: `Store Detail / Actions`, `Map / Geolocation`, `Tiếng Việt / UI Safety`.

## Risks / Next
- Chưa có e2e riêng cho toggle mini map trong modal detail.
- Nếu muốn, bước tiếp theo có thể thêm animation mở/đóng nhẹ hoặc lưu trạng thái mở tạm thời theo session, nhưng hiện tại mình giữ bản tối giản để tránh phức tạp UI.
