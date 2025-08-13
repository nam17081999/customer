import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { IMAGEKIT_URL_ENDPOINT, IMAGEKIT_PUBLIC_KEY } from '@/lib/constants';

export default function ImageUpload({ onUploadSuccess, folder = '', accept = 'image/*' }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setUploading(true);
    setError('');

    try {
      // Get authentication parameters
      const authResponse = await fetch('/api/imagekit-auth');
      const authData = await authResponse.json();

      if (!authData.success) {
        throw new Error('Failed to get authentication parameters');
      }

      // Create FormData for upload
      const formData = new FormData();
      formData.append('file', file);
      formData.append('publicKey', IMAGEKIT_PUBLIC_KEY);
      formData.append('signature', authData.signature);
      formData.append('expire', authData.expire);
      formData.append('token', authData.token);
      formData.append('fileName', file.name);
      formData.append('folder', folder);
      formData.append('useUniqueFileName', 'true');
      formData.append('tags', 'store-image');

      // Upload to ImageKit
      const uploadResponse = await fetch('https://upload.imagekit.io/api/v1/files/upload', {
        method: 'POST',
        body: formData,
      });

      const uploadResult = await uploadResponse.json();

      if (uploadResponse.ok) {
        // Success
        onUploadSuccess({
          url: uploadResult.url,
          fileId: uploadResult.fileId,
          name: uploadResult.name,
          thumbnailUrl: uploadResult.thumbnailUrl,
        });
      } else {
        throw new Error(uploadResult.message || 'Upload failed');
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      // Clear the file input
      event.target.value = '';
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="image-upload" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Tải lên hình ảnh
        </label>
        <input
          id="image-upload"
          type="file"
          accept={accept}
          onChange={handleFileSelect}
          disabled={uploading}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
        />
      </div>

      {uploading && (
        <div className="flex items-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          <span className="text-sm text-gray-600 dark:text-gray-400">Đang tải lên...</span>
        </div>
      )}

      {error && (
        <div className="text-sm text-red-600 dark:text-red-400">
          Lỗi: {error}
        </div>
      )}

      <div className="text-xs text-gray-500 dark:text-gray-400">
        Hỗ trợ: JPG, PNG, WebP (tối đa 10MB)
      </div>
    </div>
  );
}
