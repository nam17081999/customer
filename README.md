# StoreVis - Ứng dụng Quản lý Cửa hàng

> Ứng dụng quản lý và theo dõi cửa hàng cho đội ngũ sales/kinh doanh

## ✨ Tính năng chính

- 🔍 **Tìm kiếm thông minh**: Tìm cửa hàng theo tên (hỗ trợ tiếng Việt có/không dấu)
- 📍 **GPS & Bản đồ**: Tự động lấy vị trí, tính khoảng cách, hiển thị trên bản đồ
- 📷 **Upload ảnh**: Chụp và nén ảnh tự động, lưu trữ an toàn
- 🗺️ **Google Maps**: Parse link Google Maps tự động điền thông tin
- 🌙 **Dark mode**: Giao diện tối/sáng thân thiện mắt
- 📱 **Mobile-first**: Tối ưu cho thiết bị di động

## 🚀 Quick Start

```bash
# Clone & install
npm install

# Setup environment
copy .env.example .env.local
# Điền thông tin Supabase và ImageKit vào .env.local

# Run development server
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000) để xem kết quả.

## 📚 Documentation

- **[SETUP.md](./SETUP.md)** - Hướng dẫn cài đặt chi tiết cho developers
- **[IMPROVEMENTS.md](./IMPROVEMENTS.md)** - Kế hoạch cải thiện và tính năng mới

## 🛠️ Tech Stack

- **Framework**: Next.js 15 + React 19
- **Database**: Supabase (PostgreSQL)
- **Storage**: ImageKit.io
- **Maps**: Leaflet + React-Leaflet
- **Styling**: TailwindCSS 4
- **UI Components**: Radix UI
- **Auth**: Supabase Auth

## 📱 Screenshots

<!-- TODO: Add screenshots here -->
```
[Trang tìm kiếm]  [Thêm cửa hàng]  [Danh sách thăm]
```

## 🏗️ Project Structure

```
customer/
├── pages/          # Next.js pages (Pages Router)
├── components/     # React components
├── lib/           # Libraries & utilities
├── helper/        # Helper functions
└── public/        # Static files
```

## 🔧 Available Scripts

- `npm run dev` - Chạy development server
- `npm run build` - Build production
- `npm start` - Chạy production server
- `npm run lint` - Kiểm tra code với ESLint

## 🌟 Key Features Explained

### Auto-fill Address
Tự động lấy địa chỉ từ GPS với độ chính xác cao. Có thể bật/tắt trong trang thêm cửa hàng.

### Store Create Flow
- Bước 1 tách riêng **Loại cửa hàng** và **Tên cửa hàng**
- Loại mặc định là **Tạp hóa**
- Toàn bộ loại cửa hàng hiển thị dạng nút chọn, mobile hiển thị **2 loại / 1 hàng**
- Danh sách cửa hàng trùng từ gần đây đến toàn hệ thống đều có thể hiển thị khoảng cách nếu lấy được tọa độ

### Google Maps Integration
Dán link Google Maps (bao gồm cả short links) để tự động:
- Trích xuất tọa độ
- Lấy địa chỉ
- Điền tên cửa hàng (nếu có)

### Smart Search
Tìm kiếm theo tên có hoặc không dấu. Ví dụ: "Ha Noi" sẽ tìm thấy "Hà Nội".

### Map Navigation
- Từ modal chi tiết có nút **Bản đồ** để sang `/map`
- `/map` nhận `storeId + lat/lng` để mở ngay gần khu vực cửa hàng và highlight marker tương ứng
- Không tự mở modal chi tiết khi chuyển trang
- Có nút **về vị trí đang đứng** ở góc phải dưới của bản đồ


## 🔒 Security

- Row Level Security (RLS) enabled trên Supabase
- API keys không được commit vào git
- Image upload có rate limiting
- Input validation & sanitization

## 📈 Performance

- Image compression trước khi upload
- Virtual scrolling cho danh sách dài
- Debounced search
- Lazy loading components
- Optimized bundle size

## 🤝 Contributing

Xem [IMPROVEMENTS.md](./IMPROVEMENTS.md) để biết các tính năng đang được lên kế hoạch.

## 📄 License

Internal project - Not for public distribution

## 🙋 Support

Liên hệ team lead nếu cần hỗ trợ.

---

## Learn More about Next.js

- [Next.js Documentation](https://nextjs.org/docs)
- [Learn Next.js](https://nextjs.org/learn)
- [Next.js GitHub](https://github.com/vercel/next.js)

## Deploy on Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme).

Check out [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
