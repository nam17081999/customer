// Shared app constants
export const PAGE_SIZE = 5;
export const MIN_SEARCH_LEN = 2;
export const SEARCH_DEBOUNCE_MS = 900; // ms
export const SCROLL_BOTTOM_OFFSET = 300; // px to start loading more before reaching bottom

// District/Ward suggestions — đầy đủ 63 tỉnh thành
// Nguồn: vietnamese-provinces-database v2.4.1 (https://github.com/thanglequoc/vietnamese-provinces-database)
import vnData from '@/data/vnAdminAreas.json'

export const DISTRICT_WARD_SUGGESTIONS = vnData.districtWardSuggestions;
export const DISTRICT_SUGGESTIONS = vnData.districtSuggestions;

export const STORE_TYPE_OPTIONS = [
  { value: 'tap_hoa', label: 'Tạp hóa' },
  { value: 'quan_an', label: 'Quán ăn' },
  { value: 'kho', label: 'Kho' },
  { value: 'karaoke', label: 'Karaoke' },
  { value: 'khach_san', label: 'Khách sạn' },
  { value: 'game', label: 'Quán game' },
];

export const STORE_TYPE_OPTION_BY_VALUE = STORE_TYPE_OPTIONS.reduce((acc, option) => {
  acc[option.value] = option
  return acc
}, {})

export const STORE_TYPE_LABEL_BY_VALUE = STORE_TYPE_OPTIONS.reduce((acc, option) => {
  acc[option.value] = option.label
  return acc
}, {})

export function getStoreTypeLabel(storeType, fallbackLabel = 'Cửa hàng') {
  return STORE_TYPE_LABEL_BY_VALUE[storeType] || fallbackLabel
}

export const DEFAULT_STORE_TYPE = STORE_TYPE_OPTIONS[0].value;

export const REPORT_REASON_OPTIONS = [
  { code: 'wrong_name', label: 'Sai tên' },
  { code: 'wrong_address', label: 'Sai địa chỉ' },
  { code: 'wrong_phone', label: 'Sai số điện thoại' },
  { code: 'wrong_location', label: 'Sai vị trí' },
];
