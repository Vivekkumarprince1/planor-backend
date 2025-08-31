"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Simple file storage for now - in production use Cloudinary
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${file.originalname}`;
        cb(null, uniqueName);
    },
});
const upload = (0, multer_1.default)({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'audio/mpeg'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error('Invalid file type'));
        }
    },
});
// POST /api/v1/uploads - Upload media files
router.post('/uploads', auth_1.auth, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No file uploaded' });
        }
        const fileUrl = `/uploads/${req.file.filename}`;
        // Determine media type
        let mediaType = 'image';
        if (req.file.mimetype.startsWith('video/'))
            mediaType = 'video';
        if (req.file.mimetype.startsWith('audio/'))
            mediaType = 'audio';
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
    }
    catch (error) {
        res.status(500).json({ success: false, error: 'Failed to upload file' });
    }
});
exports.default = router;
