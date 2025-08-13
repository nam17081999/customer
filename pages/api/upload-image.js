import { uploadImage, deleteImage } from '@/lib/imagekit';
import formidable from 'formidable';
import fs from 'fs';

export const config = {
  api: {
    bodyParser: false,
  },
};

/**
 * Upload image API endpoint for Next.js
 */
export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      // Parse multipart form data
      const form = formidable({
        maxFileSize: 10 * 1024 * 1024, // 10MB limit
        keepExtensions: true,
      });

      const [fields, files] = await form.parse(req);
      const file = Array.isArray(files.file) ? files.file[0] : files.file;
      const fileName = Array.isArray(fields.fileName) ? fields.fileName[0] : fields.fileName;

      if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      // Read file as buffer
      const fileBuffer = fs.readFileSync(file.filepath);
      
      // Upload directly to root (no folder)
      const result = await uploadImage(fileBuffer, fileName || file.originalFilename, '');

      // Clean up temp file
      fs.unlinkSync(file.filepath);

      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(500).json(result);
      }
    } catch (error) {
      console.error('Upload API error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Internal server error' 
      });
    }
  } else if (req.method === 'DELETE') {
    try {
      const { fileId, fileName } = req.body;

      if (!fileId && !fileName) {
        return res.status(400).json({ error: 'FileId or fileName is required' });
      }

      const result = await deleteImage(fileId || fileName);

      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(500).json(result);
      }
    } catch (error) {
      console.error('Delete API error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Internal server error' 
      });
    }
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}
