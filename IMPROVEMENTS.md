# Improvements Roadmap

Tài liệu này tổng hợp các hướng nâng cấp đã được chuẩn hóa cho repo.

## 1. Kiến trúc

- Giữ page routes trong `pages/` cho các màn chính.
- Dọn các route hybrid không cần thiết để giảm chỗ phải bảo trì song song.
- Giữ docs route và docs structure đồng bộ với code.

## 2. Hiệu năng

- Giảm cảnh báo lint và các file ngoài source chính bị quét nhầm.
- Ưu tiên tối ưu các màn nặng như search, create-store, map, và order detail.
- Theo dõi các component dùng ảnh lớn để chuyển sang tối ưu hóa phù hợp khi cần.

## 3. Docs & Vận hành

- Giữ README trỏ đúng file có thật.
- Tài liệu setup phải nói rõ package manager và biến môi trường.
- Các checklist vận hành nên đi cùng quy trình verify để tránh báo xong nhưng thiếu bằng chứng.

## Trạng thái hiện tại

- `/login` đã được chuẩn hóa về Pages Router.
- `.claude/worktrees` đã được loại khỏi lint.
- README đã được sửa link và hướng dẫn cài đặt.