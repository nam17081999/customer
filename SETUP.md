# Setup

Tài liệu này dùng để khởi chạy local đúng chuẩn của repo.

## Yêu cầu

- Node.js 24.x
- pnpm
- Tài khoản Supabase và keys môi trường tương ứng

## Cài đặt

```bash
pnpm install
```

## Biến môi trường

Tạo `.env.local` từ `.env.example` và điền ít nhất các biến cần cho app chạy:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- (tuỳ chọn) `GEOAPIFY_API_KEY`, `OPENMAP_API_KEY`, `GOONG_API_KEY` — xem `.env.example`

## Chạy local

```bash
pnpm dev
```

Sau đó mở `http://localhost:3000`.

## Kiểm tra trước khi merge

```bash
pnpm lint
pnpm test
pnpm build
```