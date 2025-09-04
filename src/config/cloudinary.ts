import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import { env } from './env';

// Only configure Cloudinary if credentials are provided
if (env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET) {
  // Configure Cloudinary
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
  });
  console.log('✅ Cloudinary configured with cloud:', env.CLOUDINARY_CLOUD_NAME);
} else {
  console.log('⚠️  Cloudinary credentials not found, uploads will use local storage');
}

// Create storage configuration for different media types
export const createCloudinaryStorage = (folder: string) => {
  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
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
      config: cloudinary.config(),
      api: !!cloudinary.api,
      uploader: !!cloudinary.uploader
    });
    
    const storage = new CloudinaryStorage({
      cloudinary: cloudinary,
      params: {
        folder: folder,
        allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'mp4', 'avi', 'mov', 'wmv', 'flv', '3gp'],
        resource_type: 'auto',
        public_id: (req: any, file: Express.Multer.File) => {
          const timestamp = Date.now();
          const extension = file.originalname.split('.').pop();
          const publicId = `${file.fieldname}_${timestamp}.${extension}`;
          console.log('🎯 Generated public_id:', publicId);
          return publicId;
        },
      } as any,
    });
    
    console.log('✅ Cloudinary storage created successfully for folder:', folder);
    return storage;
  } catch (error: any) {
    console.error('💥 Error creating Cloudinary storage:', error);
    console.error('📊 Cloudinary storage error details:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      name: error.name
    });
    throw error;
  }
  } catch (error) {
    console.error('Error creating Cloudinary storage:', error);
    throw error;
  }
};

// Storage configurations for different types of uploads
export const storageConfigs = (() => {
  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
    console.log('📁 Cloudinary not configured, storage configs will not be created');
    return {};
  }
  
  try {
    return {
      serviceMedia: createCloudinaryStorage('planor/services'),
      profileImages: createCloudinaryStorage('planor/profiles'),
      documents: createCloudinaryStorage('planor/documents'),
      portfolios: createCloudinaryStorage('planor/portfolios'),
      chat: createCloudinaryStorage('planor/chat'),
      general: createCloudinaryStorage('planor/general'),
    };
  } catch (error) {
    console.error('❌ Failed to create Cloudinary storage configs:', error);
    return {};
  }
})();

// Helper function to delete files from Cloudinary
export const deleteFromCloudinary = async (publicId: string, resourceType: 'image' | 'video' | 'raw' = 'image') => {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });
    return result;
  } catch (error) {
    console.error('Error deleting from Cloudinary:', error);
    throw error;
  }
};

// Helper function to get optimized URL
export const getOptimizedUrl = (publicId: string, options?: any) => {
  return cloudinary.url(publicId, {
    quality: 'auto:good',
    fetch_format: 'auto',
    ...options,
  });
};

export default cloudinary;
