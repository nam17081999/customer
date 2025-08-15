// Shared app constants
export const PAGE_SIZE = 5;
export const MIN_SEARCH_LEN = 2;
export const SEARCH_DEBOUNCE_MS = 900; // ms
export const SCROLL_BOTTOM_OFFSET = 300; // px to start loading more before reaching bottom

// NPP location for distance calculations
export const NPP_LOCATION = { latitude: 21.077358236549987, longitude: 105.69518029931452 };

// ImageKit.io configuration
export const IMAGEKIT_URL_ENDPOINT = process.env.NEXT_PUBLIC_IMAGE_BASE_URL || '';
export const IMAGEKIT_PUBLIC_KEY = process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY || '';
export const IMAGEKIT_PRIVATE_KEY = process.env.NEXT_PUBLIC_IMAGEKIT_PRIVATE_KEY || '';
