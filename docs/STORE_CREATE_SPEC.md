# Store Create Screen Specification (v1.3)

## Purpose
Màn hình thêm cửa hàng cho phép người dùng đã đăng nhập tạo cửa hàng mới với các thông tin bắt buộc tối thiểu và một số thông tin tùy chọn mở rộng.

## Version
- v1.3 (2025-08-16): Thêm cơ chế prefill trường tên từ query param `?name=` khi mở màn hình tạo; sau khi tạo thành công phải xoá param `name` khỏi URL (shallow replace) để không prefill lần tiếp theo.
- v1.2 (2025-08-16): Chuẩn hoá kích thước font tất cả input & textarea về 14px (Tailwind `text-sm`) đồng nhất trên mọi kích thước màn hình.
- v1.1 (2025-08-15): Thêm rule chuẩn hoá địa chỉ: nếu người dùng nhập toàn bộ lowercase thì tự động chuyển Title Case trước khi lưu.
- v1.0 (2025-08-15): Khởi tạo tài liệu ban đầu.

## Các trường dữ liệu
| Trường | Bắt buộc | Mô tả | Ghi chú |
|--------|----------|-------|---------|
| name | Yes | Tên cửa hàng hiển thị | Prefill từ query `?name=` nếu có, chuẩn hóa Title Case trước khi lưu (toTitleCaseVI) |
| address | Yes | Địa chỉ văn bản | Có auto-fill bằng geolocation hoặc reverse geocode từ link (nếu toàn lowercase sẽ auto Title Case) |
| image_url | Yes | Tên file ảnh trên ImageKit | Ảnh nén trước khi upload (image/jpeg) |
| phone | No | Số điện thoại liên hệ | Chỉ hiển thị khi bật phần "Thêm thông tin khác" |
| note | No | Ghi chú (giờ mở cửa, lưu ý...) | Tùy chọn |
| gmapLink (UI only) | No | Link Google Maps gốc người dùng dán | Dùng để suy ra toạ độ + reverse geocode |
| latitude / longitude | Implicit | Toạ độ cửa hàng | Ưu tiên parse từ gmapLink; fallback geolocation |

## Hành vi bắt buộc (Immutable Rules)
1. Người dùng CHƯA đăng nhập: toàn màn hiển thị thông báo yêu cầu đăng nhập, không render form.
2. Các trường bắt buộc: name, address, image (file). Thiếu một trong ba → chặn submit với alert.
3. Chuẩn hoá tên: luôn chuyển sang Title Case trước khi lưu và tính name_search bằng removeVietnameseTones.
4. Chuẩn hoá địa chỉ: nếu toàn bộ chuỗi address người dùng nhập là lowercase (address === address.toLowerCase()) thì trước khi insert sẽ chuyển sang Title Case (toTitleCaseVI) và cập nhật lại state để phản hồi trực quan.
5. Toạ độ:
   - Nếu có gmapLink: cố gắng parse trực tiếp (regex nhiều pattern) → mở rộng short link → trích search text → Google Geocoding → (fallback) bỏ qua nếu thất bại.
   - Nếu không có gmapLink: dùng geolocation của trình duyệt (nếu bị từ chối → lỗi và dừng).
6. Reverse geocode từ gmapLink (khi parse được lat/lng) sẽ cập nhật address nếu thành công.
7. Auto-fill địa chỉ tự động một lần khi mount nếu address đang trống và user tồn tại.
8. Ảnh luôn được thử nén (browser-image-compression) trước upload; lỗi nén thì dùng ảnh gốc.
9. Upload lỗi → hiển thị alert và không lưu DB.
10. Lưu DB lỗi → cố gắng xoá ảnh vừa upload (best-effort) và alert lỗi.
11. Sau khi tạo thành công: form reset & hiển thị Msg success tự ẩn (không dùng alert).
12. Phần tuỳ chọn (phone, note, gmapLink) MẶC ĐỊNH ẩn, chỉ mở khi người dùng bấm nút toggle.
13. Không refetch hay reload trang sau khi tạo — chỉ reset state cục bộ.
14. Placeholder phải là dữ liệu mẫu thực tế để hướng dẫn nhập.
15. (v1.2) Kích thước font của TẤT CẢ input, file input, textarea, phone, note, gmapLink: cố định 14px (`text-sm`) trên mọi breakpoint để đảm bảo đồng nhất mật độ thị giác.
16. (v1.3) Prefill tên từ query `?name=` nếu tồn tại khi mount; SAU KHI tạo thành công phải xoá param `name` khỏi URL (shallow) để không prefill lần sau.

## Luồng xử lý Submit
1. Validate bắt buộc.
2. Xác định toạ độ (gmapLink → parse/expand/geocode | else geolocation).
3. Nén ảnh → upload → nhận name (filename) & fileId.
4. Chuẩn hoá name + build name_search.
5. Insert bản ghi (name, name_search, address, note, phone, image_url, latitude, longitude).
6. Nếu insert fail → xoá ảnh (DELETE /api/upload-image) → alert fail.
7. Thành công → showSuccess=true (Msg) → reset form state.

## UI / UX Nguyên tắc
- Chiều rộng tối đa: max-w-screen-md căn giữa, mobile-first.
- Label kích thước text-sm.
- (v1.2) Tất cả input & textarea dùng `text-sm` (14px) đồng bộ để tránh cảm giác font lệch giữa các trường; chấp nhận khả năng iOS có thể phóng to nếu hệ thống áp dụng policy <16px (được coi là trade-off thiết kế hiện tại).
- Address dùng textarea đa dòng (resize-y) vì địa chỉ dài, min height ~72px.
- Nút "Tự động lấy địa chỉ" bên dưới textarea, full width trên mobile.
- Toggle tuỳ chọn dùng variant ghost, biểu tượng + / − đổi theo trạng thái.
- Msg success: xuất hiện top-center, fade+slide+scale, width ~92%, max-w-md, tự ẩn sau 2.5s.
- Trạng thái xử lý gmapLink hiển thị viền input (xanh lá khi success, đỏ khi error) và message nhỏ 11px.

## Trạng thái Google Maps Link
| Status | Điều kiện | UI |
|--------|----------|----|
| '' (empty) | gmapLink trống | Không hiển thị message |
| processing | Người dùng dừng nhập 400ms | (Không đổi viền) có thể thêm spinner tương lai |
| success | Parse / geocode thành công | Viền xanh + message xanh (nếu có) |
| error | Không parse được hoặc geocode fail | Viền đỏ + message đỏ |

## Tương tác & Edge Cases
- Người dùng đổi gmapLink liên tục: debounced 400ms, mỗi lần thay đổi hủy lần trước.
- Parse lat/lng: so sánh với lastParsedRef để tránh reverseGeocode lặp khi cùng toạ độ.
- Nếu reverse geocode từ link thành công sẽ ghi đè address hiện tại (vì giả định chính xác hơn).
- Nếu người dùng đã tự sửa address sau khi parse → thay đổi gmapLink mới vẫn có thể ghi đè (chấp nhận theo rule đơn giản; tương lai có thể khóa). 
- Khi geolocation bị từ chối và không có link → thông báo lỗi và dừng.
- Prefill name: chỉ diễn ra một lần khi load nếu hiện diện query `name`. Sau success phải xoá để tránh prefill cho lần tiếp.

## Hiệu năng & Tối ưu (Future Ideas - Non Binding)
- Cache kết quả geocode forward (text → lat/lng) bằng sessionStorage theo key.
- AbortController cho request geocode khi người dùng nhập link mới nhanh.
- Component riêng cho Upload với preview và nén song song.

## Kiểm thử Nhanh (Checklist)
- [ ] Chưa đăng nhập thấy prompt login.
- [ ] Đăng nhập, auto-fill address chạy (nếu quyền OK).
- [ ] Thiếu ảnh → chặn submit.
- [ ] Có link maps ngắn (maps.app.goo.gl/...) được expand & parse.
- [ ] Link chứa !3d...!4d parse đúng.
- [ ] Link chỉ có @lat,lng parse đúng.
- [ ] Link /place/<name>/... reverse geocode ok (Google key cho phép).
- [ ] Toggle tuỳ chọn ẩn/hiện không làm mất dữ liệu đã nhập.
- [ ] Submit thành công hiển thị Msg và biến mất sau ~2.5s.
- [ ] Khi Msg ẩn đi không gây layout jump form.
- [ ] (v1.2) Tất cả input & textarea hiển thị cùng một cỡ chữ 14px.
- [ ] Query `?name=...` có mặt → input tên được prefill.
- [ ] Sau khi tạo thành công, URL không còn query `name`.

## Không được thay đổi tự do
Các mục trong phần "Immutable Rules" chỉ thay đổi nếu bump version (v1.3, v1.4...) kèm lý do.

---
End of v1.3
