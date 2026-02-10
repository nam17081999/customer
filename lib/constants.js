// Shared app constants
export const PAGE_SIZE = 5;
export const MIN_SEARCH_LEN = 2;
export const SEARCH_DEBOUNCE_MS = 900; // ms
export const SCROLL_BOTTOM_OFFSET = 300; // px to start loading more before reaching bottom

// District/Ward suggestions (Hanoi - selected areas)
export const DISTRICT_WARD_SUGGESTIONS = {
  'Hoài Đức': [
    'Trạm Trôi', 'An Khánh', 'An Thượng', 'Cát Quế', 'Di Trạch', 'Dương Liễu',
    'Đắc Sở', 'Đông La', 'Đức Giang', 'Đức Thượng', 'Kim Chung', 'La Phù',
    'Minh Khai', 'Ngãi Cầu', 'Song Phương', 'Sơn Đồng', 'Tiền Yên', 'Vân Canh',
    'Vân Côn', 'Yên Sở'
  ],
  'Đan Phượng': [
    'Phùng', 'Đan Phượng', 'Đồng Tháp', 'Hạ Mỗ', 'Hồng Hà', 'Liên Hà',
    'Liên Hồng', 'Liên Trung', 'Phương Đình', 'Song Phượng', 'Tân Hội', 'Tân Lập',
    'Thọ An', 'Thọ Xuân', 'Thượng Mỗ', 'Trung Châu'
  ],
  'Phúc Thọ': [
    'Phúc Thọ', 'Hát Môn', 'Hiệp Thuận', 'Liên Hiệp', 'Long Xuyên', 'Ngọc Tảo',
    'Phúc Hòa', 'Phụng Thượng', 'Sen Phương', 'Tam Hiệp', 'Tam Thuấn', 'Thanh Đa',
    'Thọ Lộc', 'Thượng Cốc', 'Tích Giang', 'Trạch Mỹ Lộc', 'Vân Hà', 'Vân Nam',
    'Vân Phúc', 'Võng Xuyên', 'Xuân Đình'
  ],
  'Bắc Từ Liêm': [
    'Minh Khai', 'Cổ Nhuế 1', 'Cổ Nhuế 2', 'Đông Ngạc', 'Đức Thắng', 'Liên Mạc', 
    'Thụy Phương', 'Tây Tựu', 'Thượng Cát', 'Xuân Đỉnh', 'Xuân Tảo', 'Phúc Diễn', 'Phú Diễn'
  ],
  'Nam Từ Liêm': [
    'Cầu Diễn', 'Mỹ Đình 1', 'Mỹ Đình 2', 'Mễ Trì', 'Phú Đô', 'Trung Văn', 
    'Tây Mỗ', 'Đại Mỗ', 'Phương Canh', 'Xuân Phương'
  ],
  'Quốc Oai': [
    'Quốc Oai', 'Cấn Hữu', 'Cộng Hòa', 'Đại Thành', 'Đông Xuân', 'Đồng Quang',
    'Đông Yên', 'Hòa Thạch', 'Liệp Tuyết', 'Nghĩa Hương', 'Ngọc Liệp', 'Ngọc Mỹ',
    'Phú Cát', 'Phú Mãn', 'Phượng Cách', 'Sài Sơn', 'Tân Hòa', 'Tân Phú',
    'Thạch Thán', 'Tuyết Nghĩa', 'Yên Sơn'
  ],
};

export const DISTRICT_SUGGESTIONS = Object.keys(DISTRICT_WARD_SUGGESTIONS);

// ImageKit.io configuration
export const IMAGEKIT_URL_ENDPOINT = process.env.NEXT_PUBLIC_IMAGE_BASE_URL || '';
export const IMAGEKIT_PUBLIC_KEY = process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY || '';
export const IMAGEKIT_PRIVATE_KEY = process.env.NEXT_PUBLIC_IMAGEKIT_PRIVATE_KEY || '';
