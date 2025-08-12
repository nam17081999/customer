import { IMAGE_BASE_URL } from '@/lib/constants';

/**
 * Check if image URL contains the base URL (needs migration)
 * @param {string} imageUrl - Image URL to check
 * @returns {boolean} True if URL contains base URL
 */
export function hasImageBaseUrl(imageUrl) {
  if (!imageUrl) return false;
  
  // Check if it's a full URL (starts with http/https)
  if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
    return false; // Already just a filename
  }
  
  // Check if it contains the base URL pattern
  return imageUrl.includes('/object/public/stores/');
}

/**
 * Get full image URL from filename
 * @param {string} filename - Image filename from database
 * @returns {string} Full image URL
 */
export function getFullImageUrl(filename) {
  if (!filename) return '';
  
  // Simply prepend the base URL to filename
  return `${IMAGE_BASE_URL}/${filename}`;
}

/**
 * Get filename from full URL (for backward compatibility with existing functions)
 * @param {string} imageUrl - Could be filename or full URL
 * @returns {string} Just the filename
 */
export function getImageFilename(imageUrl) {
  if (!imageUrl) return '';
  
  // If it's already just a filename (no protocol), return as is
  if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
    return imageUrl;
  }
  
  // Extract filename from full URL (for backward compatibility)
  try {
    const marker = '/object/public/stores/';
    const idx = imageUrl.indexOf(marker);
    if (idx !== -1) {
      return imageUrl.substring(idx + marker.length);
    }
    
    // Fallback: get last segment of URL
    const url = new URL(imageUrl);
    const parts = url.pathname.split('/');
    return parts[parts.length - 1];
  } catch {
    return imageUrl; // Return original if parsing fails
  }
}
