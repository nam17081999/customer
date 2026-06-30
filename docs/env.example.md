# Environment Variables — NPP Hà Công

Tạo file `.env.local` từ template này:

```bash
cp .env.example .env.local
```

Hoặc copy thủ công các biến sau:

## Required

```bash
# Supabase (lấy từ Supabase Dashboard > Settings > API)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co/
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

## Optional (nếu cần)

```bash
# Google Maps API Key (cho location picker trong form tạo/sửa store)
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-google-maps-key

# Server-side API keys (không prefix NEXT_PUBLIC_ — không leak ra browser)
GEOAPIFY_API_KEY=
OPENMAP_API_KEY=
GOONG_API_KEY=

# Supabase Service Role Key (CHỈ dùng cho server-side admin operations)
# ⚠️ CẨN THẬN: Key này có full quyền database, bypass RLS
SUPABASE_SERVICE_ROLE_KEY=
```

## Kiểm tra

Sau khi setup, chạy:

```bash
pnpm dev
```

Mở `http://localhost:3000` — nếu thấy trang tìm kiếm là OK.
