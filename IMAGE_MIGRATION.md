# Image URL Migration Guide

## Tổng quan
Hệ thống đã được cấu hình để:
- ✅ **Chỉ lưu filename trong database** (đã migration xong)
- ✅ **Tự động kết hợp với `IMAGE_BASE_URL` khi hiển thị ảnh**
- ✅ **Dễ dàng thay đổi storage** bằng cách cập nhật biến môi trường

## Cấu hình

### Biến môi trường
Trong file `.env.local`:
```
NEXT_PUBLIC_IMAGE_BASE_URL=https://kjhjaqbjhblflaruiwwm.supabase.co/storage/v1/object/public/stores
```

### Constants
Trong `lib/constants.js`:
```javascript
export const IMAGE_BASE_URL = process.env.NEXT_PUBLIC_IMAGE_BASE_URL || '';
```

## Helper Functions

### `getFullImageUrl(filename)`
- Nhận filename từ database → trả về URL đầy đủ bằng cách thêm `IMAGE_BASE_URL`

### `getImageFilename(imageUrl)` 
- Trích xuất filename từ URL (dùng cho backward compatibility và xóa file)

## Database Structure

Trong database, field `image_url` hiện tại chỉ chứa filename:
- ✅ `image1.jpg`
- ✅ `1736681234567_abc123.png`  
- ❌ ~~`https://domain.com/storage/.../image.jpg`~~ (đã migration)

## Cách thay đổi Storage

Để chuyển sang storage khác:

1. **Cập nhật biến môi trường:**
   ```
   NEXT_PUBLIC_IMAGE_BASE_URL=https://your-new-storage.com/path/
   ```

2. **Upload ảnh lên storage mới** (giữ nguyên filename)

3. **Restart ứng dụng**

4. **Không cần thay đổi code hoặc database!**

## Files đã được cập nhật

### Helper Functions (Simplified)
- `helper/imageUtils.js` - Đơn giản hóa logic xử lý URL

### Pages (No more URL checking)
- `pages/store/create.js` - Lưu filename 
- `pages/store/[id].js` - Lưu filename khi edit, hiển thị với full URL
- `pages/store/index.js` - Hiển thị ảnh với full URL
- `pages/store/all.js` - Hiển thị ảnh với full URL
- `pages/index.js` - Cập nhật comment

### Components
- `components/store-result-card.jsx` - Hiển thị ảnh với full URL
- `components/selected-store-item.jsx` - Hiển thị ảnh với full URL

## Current System Status

- ✅ **Database migrated**: Tất cả `image_url` đã là filename
- ✅ **Code simplified**: Không còn check URL format
- ✅ **Backward compatibility**: Vẫn support việc parse URL nếu cần
- ✅ **Ready for storage change**: Chỉ cần update biến môi trường

## Migration Scripts (Không cần thiết nữa)

Migration scripts vẫn được giữ lại trong:
- `migration-script.js` 
- `migrate-images.js`

Nhưng không cần sử dụng vì database đã được migration.
