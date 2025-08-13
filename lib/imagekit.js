import ImageKit from 'imagekit';
import { IMAGEKIT_URL_ENDPOINT, IMAGEKIT_PUBLIC_KEY, IMAGEKIT_PRIVATE_KEY } from './constants';

// Server-side ImageKit instance (for uploads and management)
let imagekit = null;

export function getImageKitInstance() {
  if (!imagekit && typeof window === 'undefined') {
    imagekit = new ImageKit({
      publicKey: IMAGEKIT_PUBLIC_KEY,
      privateKey: IMAGEKIT_PRIVATE_KEY,
      urlEndpoint: IMAGEKIT_URL_ENDPOINT,
    });
  }
  return imagekit;
}

/**
 * Upload image to ImageKit
 * @param {File|Buffer} file - File to upload
 * @param {string} fileName - Name for the uploaded file
 * @param {string} folder - Folder path (default: 'stores')
 * @returns {Promise<Object>} Upload result
 */
export async function uploadImage(file, fileName, folder = 'stores') {
  const ik = getImageKitInstance();
  if (!ik) {
    throw new Error('ImageKit not configured properly');
  }

  try {
    const result = await ik.upload({
      file: file, // Buffer, base64 string, or file path
      fileName: fileName,
      folder: folder,
      useUniqueFileName: true,
      tags: ['store-image'],
    });

    return {
      success: true,
      data: result,
      url: result.url,
      fileId: result.fileId,
      name: result.name,
    };
  } catch (error) {
    console.error('ImageKit upload error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Delete image from ImageKit
 * @param {string} fileId - ImageKit file ID
 * @returns {Promise<Object>} Delete result
 */
export async function deleteImage(fileId) {
  const ik = getImageKitInstance();
  if (!ik) {
    throw new Error('ImageKit not configured properly');
  }

  try {
    await ik.deleteFile(fileId);
    return { success: true };
  } catch (error) {
    console.error('ImageKit delete error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Get authentication parameters for client-side uploads
 * @returns {Promise<Object>} Auth parameters
 */
export async function getAuthenticationParameters() {
  const ik = getImageKitInstance();
  if (!ik) {
    throw new Error('ImageKit not configured properly');
  }

  try {
    const authParams = ik.getAuthenticationParameters();
    return {
      success: true,
      ...authParams,
    };
  } catch (error) {
    console.error('ImageKit auth error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}
