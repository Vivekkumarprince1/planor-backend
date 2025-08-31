import { Router } from 'express';
import multer from 'multer';
import { auth } from '../middleware/auth';

const router = Router();

// Simple file storage for now - in production use Cloudinary
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${file.originalname}`;
    cb(null, uniqueName);
  },
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'audio/mpeg'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  },
});

// POST /api/v1/uploads - Upload media files
router.post('/uploads', auth, upload.single('file'), async (req: any, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }
    
    const fileUrl = `/uploads/${req.file.filename}`;
    
    // Determine media type
    let mediaType = 'image';
    if (req.file.mimetype.startsWith('video/')) mediaType = 'video';
    if (req.file.mimetype.startsWith('audio/')) mediaType = 'audio';
    
    res.json({
      success: true,
      data: {
        url: fileUrl,
        type: mediaType,
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to upload file' });
  }
});

export default router;
