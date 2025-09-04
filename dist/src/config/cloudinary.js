"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOptimizedUrl = exports.deleteFromCloudinary = exports.storageConfigs = exports.createCloudinaryStorage = void 0;
const cloudinary_1 = require("cloudinary");
const multer_storage_cloudinary_1 = require("multer-storage-cloudinary");
const env_1 = require("./env");
// Only configure Cloudinary if credentials are provided
if (env_1.env.CLOUDINARY_CLOUD_NAME && env_1.env.CLOUDINARY_API_KEY && env_1.env.CLOUDINARY_API_SECRET) {
    // Configure Cloudinary
    cloudinary_1.v2.config({
        cloud_name: env_1.env.CLOUDINARY_CLOUD_NAME,
        api_key: env_1.env.CLOUDINARY_API_KEY,
        api_secret: env_1.env.CLOUDINARY_API_SECRET,
    });
    console.log('✅ Cloudinary configured with cloud:', env_1.env.CLOUDINARY_CLOUD_NAME);
}
else {
    console.log('⚠️  Cloudinary credentials not found, uploads will use local storage');
}
// Create storage configuration for different media types
const createCloudinaryStorage = (folder) => {
    if (!env_1.env.CLOUDINARY_CLOUD_NAME || !env_1.env.CLOUDINARY_API_KEY || !env_1.env.CLOUDINARY_API_SECRET) {
        throw new Error('Cloudinary credentials not configured');
    }
    try {
        try {
            console.log('🔧 Setting up Cloudinary storage for folder:', folder);
            console.log('☁️ Cloudinary Config:', {
                cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
                api_key: process.env.CLOUDINARY_API_KEY,
                api_secret: process.env.CLOUDINARY_API_SECRET ? '***configured***' : 'missing'
            });
            // Test if cloudinary is properly configured
            console.log('🧪 Testing Cloudinary config object:', {
                config: cloudinary_1.v2.config(),
                api: !!cloudinary_1.v2.api,
                uploader: !!cloudinary_1.v2.uploader
            });
            const storage = new multer_storage_cloudinary_1.CloudinaryStorage({
                cloudinary: cloudinary_1.v2,
                params: {
                    folder: folder,
                    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'mp4', 'avi', 'mov', 'wmv', 'flv', '3gp'],
                    resource_type: 'auto',
                    public_id: (req, file) => {
                        const timestamp = Date.now();
                        const extension = file.originalname.split('.').pop();
                        const publicId = `${file.fieldname}_${timestamp}.${extension}`;
                        console.log('🎯 Generated public_id:', publicId);
                        return publicId;
                    },
                },
            });
            console.log('✅ Cloudinary storage created successfully for folder:', folder);
            return storage;
        }
        catch (error) {
            console.error('💥 Error creating Cloudinary storage:', error);
            console.error('📊 Cloudinary storage error details:', {
                message: error.message,
                stack: error.stack,
                code: error.code,
                name: error.name
            });
            throw error;
        }
    }
    catch (error) {
        console.error('Error creating Cloudinary storage:', error);
        throw error;
    }
};
exports.createCloudinaryStorage = createCloudinaryStorage;
// Storage configurations for different types of uploads
exports.storageConfigs = (() => {
    if (!env_1.env.CLOUDINARY_CLOUD_NAME || !env_1.env.CLOUDINARY_API_KEY || !env_1.env.CLOUDINARY_API_SECRET) {
        console.log('📁 Cloudinary not configured, storage configs will not be created');
        return {};
    }
    try {
        return {
            serviceMedia: (0, exports.createCloudinaryStorage)('planor/services'),
            profileImages: (0, exports.createCloudinaryStorage)('planor/profiles'),
            documents: (0, exports.createCloudinaryStorage)('planor/documents'),
            portfolios: (0, exports.createCloudinaryStorage)('planor/portfolios'),
            chat: (0, exports.createCloudinaryStorage)('planor/chat'),
            general: (0, exports.createCloudinaryStorage)('planor/general'),
        };
    }
    catch (error) {
        console.error('❌ Failed to create Cloudinary storage configs:', error);
        return {};
    }
})();
// Helper function to delete files from Cloudinary
const deleteFromCloudinary = async (publicId, resourceType = 'image') => {
    try {
        const result = await cloudinary_1.v2.uploader.destroy(publicId, {
            resource_type: resourceType,
        });
        return result;
    }
    catch (error) {
        console.error('Error deleting from Cloudinary:', error);
        throw error;
    }
};
exports.deleteFromCloudinary = deleteFromCloudinary;
// Helper function to get optimized URL
const getOptimizedUrl = (publicId, options) => {
    return cloudinary_1.v2.url(publicId, {
        quality: 'auto:good',
        fetch_format: 'auto',
        ...options,
    });
};
exports.getOptimizedUrl = getOptimizedUrl;
exports.default = cloudinary_1.v2;
