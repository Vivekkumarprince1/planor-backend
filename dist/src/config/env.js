"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.env = {
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: Number(process.env.PORT || 4000),
    HOST: process.env.HOST || '0.0.0.0',
    MONGO_URI: process.env.MONGO_URI || 'mongodb://localhost:27017/planner',
    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || 'dev_access_secret',
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret',
    JWT_ACCESS_TTL: process.env.JWT_ACCESS_TTL || '15m',
    JWT_REFRESH_TTL: process.env.JWT_REFRESH_TTL || '7d',
    CORS_ORIGIN: (process.env.CORS_ORIGIN || 'http://localhost:19006,http://localhost:3000,http://192.168.43.56:8081,http://10.93.45.248:8081,http://10.93.45.248:19006,exp://10.93.45.248:8081,http://10.0.2.2:8081').split(','),
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || '',
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || '',
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || '',
    RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || '',
    RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || '',
    EXPO_ACCESS_TOKEN: process.env.EXPO_ACCESS_TOKEN || '',
};
