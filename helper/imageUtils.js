import { IMAGEKIT_URL_ENDPOINT } from '@/lib/constants';

/**
 * Get full image URL from filename using ImageKit.io
 * @param {string} filename - Image filename from database
 * @returns {string} Full ImageKit.io URL with optimizations
 */
export function getFullImageUrl(filename) {
  if (!filename) return '';
  
  // If it's already a full ImageKit URL, return as is
  if (filename.startsWith('https://ik.imagekit.io/')) {
    return filename;
  }
  
  // Build ImageKit URL with basic optimizations - directly to file without stores folder
  // IMAGEKIT_URL_ENDPOINT now comes from NEXT_PUBLIC_IMAGE_BASE_URL which already has trailing slash
  const baseUrl = IMAGEKIT_URL_ENDPOINT.endsWith('/') 
    ? IMAGEKIT_URL_ENDPOINT.slice(0, -1) 
    : IMAGEKIT_URL_ENDPOINT;
    
  return `${baseUrl}/${filename}?tr=w-800,h-600,fo-auto,q-80`;
}

/**
 * Get optimized image URL for thumbnails
 * @param {string} filename - Image filename from database
 * @param {number} width - Desired width (default: 300)
 * @param {number} height - Desired height (default: 200)
 * @returns {string} Optimized ImageKit.io URL
 */
export function getThumbnailUrl(filename, width = 300, height = 200) {
  if (!filename) return '';
  
  // If it's already a full ImageKit URL, return as is
  if (filename.startsWith('https://ik.imagekit.io/')) {
    return filename;
  }
  
  const baseUrl = IMAGEKIT_URL_ENDPOINT.endsWith('/') 
    ? IMAGEKIT_URL_ENDPOINT.slice(0, -1) 
    : IMAGEKIT_URL_ENDPOINT;
    
  return `${baseUrl}/${filename}?tr=w-${width},h-${height},c-at_max,fo-auto,q-80`;
}

/**
 * Get filename from ImageKit URL
 * @param {string} imageUrl - ImageKit URL or filename
 * @returns {string} Just the filename
 */
export function getImageFilename(imageUrl) {
  if (!imageUrl) return '';
  
  // If it's already just a filename (no protocol), return as is
  if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
    return imageUrl;
  }
  
  // Handle ImageKit URLs
  if (imageUrl.includes('ik.imagekit.io')) {
    try {
      const url = new URL(imageUrl);
      const pathParts = url.pathname.split('/');
      // Remove 'stores' folder from path if present
      const storesIndex = pathParts.indexOf('stores');
      if (storesIndex !== -1 && storesIndex < pathParts.length - 1) {
        return pathParts[storesIndex + 1];
      }
      return pathParts[pathParts.length - 1];
    } catch {
      return imageUrl;
    }
  }
  
  // Fallback: get last segment of URL
  try {
    const url = new URL(imageUrl);
    const parts = url.pathname.split('/');
    return parts[parts.length - 1];
  } catch {
    return imageUrl;
  }
}

/**
 * Generate ImageKit upload URL for server-side uploads
 * @param {string} folder - Folder path (default: 'stores')
 * @returns {string} ImageKit upload URL
 */
export function getImageKitUploadUrl(folder = 'stores') {
  return 'https://upload.imagekit.io/api/v1/files/upload';
}
