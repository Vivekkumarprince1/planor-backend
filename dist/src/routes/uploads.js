"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const auth_1 = require("../middleware/auth");
const cloudinary_1 = require("../config/cloudinary");
const env_1 = require("../config/env");
const router = (0, express_1.Router)();
// Check if Cloudinary is configured
const isCloudinaryConfigured = env_1.env.CLOUDINARY_CLOUD_NAME && env_1.env.CLOUDINARY_API_KEY && env_1.env.CLOUDINARY_API_SECRET;
// Fallback local storage for development
const localStorage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${file.originalname}`;
        cb(null, uniqueName);
    },
});
// Initialize storage configs only if Cloudinary is configured
let storageConfigs = {};
if (isCloudinaryConfigured) {
    try {
        const { storageConfigs: cloudinaryStorageConfigs } = require('../config/cloudinary');
        storageConfigs = cloudinaryStorageConfigs;
        console.log('✅ Cloudinary storage configurations loaded');
    }
    catch (error) {
        console.error('❌ Failed to load Cloudinary configurations:', error);
        console.log('📁 Falling back to local storage for all uploads');
    }
}
else {
    console.log('⚠️  Cloudinary not configured, using local storage for all uploads');
}
// Create upload middleware based on configuration
const createUploadMiddleware = (storageType) => {
    console.log(`🏗️ Creating upload middleware for storage type: ${storageType}`);
    try {
        const storage = storageConfigs[storageType];
        if (!storage) {
            console.error(`❌ No storage configuration found for type: ${storageType}`);
            throw new Error(`Storage configuration not found for type: ${storageType}`);
        }
        console.log(`✅ Storage configuration found for ${storageType}`);
        const middleware = (0, multer_1.default)({
            storage: storage,
            limits: {
                fileSize: 50 * 1024 * 1024, // 50MB limit
            },
            fileFilter: (req, file, cb) => {
                console.log(`🔍 File filter check: ${file.originalname}, mimetype: ${file.mimetype}`);
                const allowedTypes = [
                    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp', 'image/webp',
                    'video/mp4', 'video/avi', 'video/mov', 'video/wmv', 'video/flv', 'video/3gp'
                ];
                if (allowedTypes.includes(file.mimetype)) {
                    console.log(`✅ File type allowed: ${file.mimetype}`);
                    cb(null, true);
                }
                else {
                    console.log(`❌ File type not allowed: ${file.mimetype}`);
                    cb(new Error(`File type not allowed. Allowed types: ${allowedTypes.join(', ')}`));
                }
            },
        });
        console.log(`✅ Upload middleware created successfully for ${storageType}`);
        return middleware;
    }
    catch (error) {
        console.error(`💥 Error creating upload middleware for ${storageType}:`, error);
        throw error;
    }
};
// Generic upload endpoint
router.post('/', auth_1.auth, createUploadMiddleware('general').single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No file uploaded'
            });
        }
        let fileUrl;
        let publicId;
        if (isCloudinaryConfigured) {
            fileUrl = req.file.path; // Cloudinary URL
            publicId = req.file.filename; // Cloudinary public_id
        }
        else {
            fileUrl = `/uploads/${req.file.filename}`;
            console.warn('⚠️  Cloudinary not configured. Using local storage. Configure CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in your .env file.');
        }
        // Determine media type
        let mediaType = 'image';
        if (req.file.mimetype.startsWith('video/'))
            mediaType = 'video';
        if (req.file.mimetype.startsWith('audio/'))
            mediaType = 'audio';
        if (req.file.mimetype.startsWith('application/'))
            mediaType = 'document';
        console.log(`✅ File uploaded successfully: ${req.file.originalname} -> ${fileUrl}`);
        res.json({
            success: true,
            data: {
                url: fileUrl,
                type: mediaType,
                filename: req.file.filename,
                originalName: req.file.originalname,
                size: req.file.size,
                publicId: publicId,
                cloudinary: isCloudinaryConfigured,
            },
        });
    }
    catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to upload file'
        });
    }
});
// Service media upload endpoint
router.post('/service-media', auth_1.auth, (req, res, next) => {
    console.log('📸 Service media upload request received');
    console.log('🔐 Auth user:', req.user?.email);
    const uploadMiddleware = createUploadMiddleware('serviceMedia').single('file');
    uploadMiddleware(req, res, (error) => {
        if (error) {
            console.error('� Multer middleware error:');
            console.error('Error type:', typeof error);
            console.error('Error constructor:', error.constructor?.name);
            console.error('Error message:', error?.message);
            console.error('Error code:', error?.code);
            console.error('Error stack:', error?.stack);
            console.error('Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
            return res.status(400).json({
                success: false,
                error: error.message || 'File upload error'
            });
        }
        // Continue to the actual handler if no multer error
        next();
    });
}, async (req, res) => {
    try {
        console.log('📁 File info:', req.file ? `${req.file.originalname} (${req.file.size} bytes)` : 'No file');
        if (!req.file) {
            console.log('❌ No file in request');
            return res.status(400).json({
                success: false,
                error: 'No file uploaded'
            });
        }
        let fileUrl;
        let publicId;
        if (isCloudinaryConfigured) {
            fileUrl = req.file.path;
            publicId = req.file.filename;
            console.log('☁️ Cloudinary upload successful:', fileUrl);
        }
        else {
            fileUrl = `/uploads/${req.file.filename}`;
            console.log('📁 Local upload successful:', fileUrl);
        }
        let mediaType = 'image';
        if (req.file.mimetype.startsWith('video/'))
            mediaType = 'video';
        const response = {
            success: true,
            data: {
                url: fileUrl,
                type: mediaType,
                filename: req.file.filename,
                originalName: req.file.originalname,
                size: req.file.size,
                publicId: publicId,
                cloudinary: isCloudinaryConfigured,
            },
        };
        console.log('✅ Service media upload response:', JSON.stringify(response, null, 2));
        res.json(response);
    }
    catch (error) {
        console.error('💥 Service media upload error:');
        console.error('Error object type:', typeof error);
        console.error('Error constructor:', error.constructor?.name);
        console.error('Raw error:', error);
        console.error('Error message:', error?.message);
        console.error('Error stack:', error?.stack);
        console.error('Error code:', error?.code);
        console.error('Error name:', error?.name);
        console.error('JSON stringify error:', JSON.stringify(error, null, 2));
        // Try to extract meaningful error message
        let errorMessage = 'Failed to upload service media';
        if (error?.message) {
            errorMessage = error.message;
        }
        else if (typeof error === 'string') {
            errorMessage = error;
        }
        else if (error?.error) {
            errorMessage = error.error;
        }
        console.error('Final error message being sent:', errorMessage);
        res.status(500).json({
            success: false,
            error: errorMessage
        });
    }
});
// Profile image upload endpoint
router.post('/profile-image', auth_1.auth, createUploadMiddleware('profileImages').single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No file uploaded'
            });
        }
        let fileUrl;
        let publicId;
        if (isCloudinaryConfigured) {
            fileUrl = req.file.path;
            publicId = req.file.filename;
        }
        else {
            fileUrl = `/uploads/${req.file.filename}`;
        }
        res.json({
            success: true,
            data: {
                url: fileUrl,
                type: 'image',
                filename: req.file.filename,
                originalName: req.file.originalname,
                size: req.file.size,
                publicId: publicId,
                cloudinary: isCloudinaryConfigured,
            },
        });
    }
    catch (error) {
        console.error('Profile image upload error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to upload profile image'
        });
    }
});
// Document upload endpoint (for Aadhar, etc.)
router.post('/document', auth_1.auth, createUploadMiddleware('documents').single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No file uploaded'
            });
        }
        let fileUrl;
        let publicId;
        if (isCloudinaryConfigured) {
            fileUrl = req.file.path;
            publicId = req.file.filename;
        }
        else {
            fileUrl = `/uploads/${req.file.filename}`;
        }
        res.json({
            success: true,
            data: {
                url: fileUrl,
                type: 'document',
                filename: req.file.filename,
                originalName: req.file.originalname,
                size: req.file.size,
                publicId: publicId,
                cloudinary: isCloudinaryConfigured,
            },
        });
    }
    catch (error) {
        console.error('Document upload error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to upload document'
        });
    }
});
// Chat media upload endpoint
router.post('/chat-media', auth_1.auth, createUploadMiddleware('chat').single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No file uploaded'
            });
        }
        let fileUrl;
        let publicId;
        if (isCloudinaryConfigured) {
            fileUrl = req.file.path;
            publicId = req.file.filename;
        }
        else {
            fileUrl = `/uploads/${req.file.filename}`;
        }
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
                publicId: publicId,
                cloudinary: isCloudinaryConfigured,
            },
        });
    }
    catch (error) {
        console.error('Chat media upload error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to upload chat media'
        });
    }
});
// Delete file endpoint
router.delete('/:publicId', auth_1.auth, async (req, res) => {
    try {
        const { publicId } = req.params;
        const { resourceType = 'image' } = req.query;
        if (isCloudinaryConfigured) {
            const result = await (0, cloudinary_1.deleteFromCloudinary)(publicId, resourceType);
            res.json({
                success: true,
                data: result,
            });
        }
        else {
            // For local storage, you would implement file deletion logic here
            res.json({
                success: true,
                message: 'Local file deletion not implemented',
            });
        }
    }
    catch (error) {
        console.error('Delete file error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to delete file'
        });
    }
});
exports.default = router;
