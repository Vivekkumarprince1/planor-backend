"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Service = void 0;
const mongoose_1 = require("mongoose");
const MediaSchema = new mongoose_1.Schema({
    type: { type: String, enum: ['image', 'video', 'audio'], required: true },
    url: { type: String, required: true },
    thumbUrl: String,
    caption: String,
    description: String,
    price: { type: Number, min: 0 },
    duration: { type: Number, min: 0 }, // Duration in seconds
    fileSize: { type: Number, min: 0 }, // File size in bytes
    isMain: { type: Boolean, default: false },
    isPremium: { type: Boolean, default: false },
    tags: [String],
});
const MediaPackageSchema = new mongoose_1.Schema({
    name: { type: String, required: true },
    description: String,
    mediaItems: [{ type: mongoose_1.Schema.Types.ObjectId }],
    price: { type: Number, required: true, min: 0 },
    isDefault: { type: Boolean, default: false },
});
const CustomFieldSchema = new mongoose_1.Schema({
    fieldName: { type: String, required: true },
    fieldType: {
        type: String,
        enum: ['text', 'number', 'boolean', 'select', 'multiselect'],
        required: true
    },
    fieldValue: mongoose_1.Schema.Types.Mixed,
    isRequired: { type: Boolean, default: false },
});
const PriceTierSchema = new mongoose_1.Schema({
    label: { type: String, enum: ['small', 'medium', 'large'], required: true },
    price: { type: Number, required: true },
    description: String,
    capacity: Number,
});
const AddOnSchema = new mongoose_1.Schema({
    name: { type: String, required: true },
    price: { type: Number, required: true },
    description: String,
});
const LocationSchema = new mongoose_1.Schema({
    address: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
    coordinates: {
        type: [Number], // [longitude, latitude]
    }
});
const ContactSchema = new mongoose_1.Schema({
    phone: { type: String, required: true },
    email: String,
    whatsapp: String,
});
const BusinessHoursSchema = new mongoose_1.Schema({
    monday: { open: String, close: String, isOpen: { type: Boolean, default: true } },
    tuesday: { open: String, close: String, isOpen: { type: Boolean, default: true } },
    wednesday: { open: String, close: String, isOpen: { type: Boolean, default: true } },
    thursday: { open: String, close: String, isOpen: { type: Boolean, default: true } },
    friday: { open: String, close: String, isOpen: { type: Boolean, default: true } },
    saturday: { open: String, close: String, isOpen: { type: Boolean, default: true } },
    sunday: { open: String, close: String, isOpen: { type: Boolean, default: false } },
});
const PortfolioSchema = new mongoose_1.Schema({
    title: { type: String, required: true },
    description: String,
    images: [String],
    completedAt: Date,
});
const ServiceSchema = new mongoose_1.Schema({
    managerId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    categoryId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
    subcategoryId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Subcategory', index: true },
    title: { type: String, required: true, index: 'text' },
    slug: { type: String, required: true, unique: true },
    description: { type: String, default: '' },
    shortDescription: { type: String, maxlength: 200 },
    media: [MediaSchema],
    mediaPackages: [MediaPackageSchema],
    basePrice: { type: Number, required: true },
    priceTiers: [PriceTierSchema],
    addOns: [AddOnSchema],
    areaServed: [String],
    maxCapacity: Number,
    features: [String],
    specifications: { type: mongoose_1.Schema.Types.Mixed, default: {} },
    tags: [String],
    ratingAverage: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'draft'],
        default: 'draft',
        index: true
    },
    adminNotes: String,
    approvedAt: Date,
    approvedBy: String,
    moderationReason: String,
    moderatedAt: Date,
    moderatedBy: String,
    customFields: [CustomFieldSchema],
    location: LocationSchema,
    contactInfo: ContactSchema,
    businessHours: BusinessHoursSchema,
    portfolio: [PortfolioSchema],
}, { timestamps: true });
ServiceSchema.index({ title: 'text', description: 'text', shortDescription: 'text' });
ServiceSchema.index({ categoryId: 1, subcategoryId: 1, isActive: 1, status: 1 });
ServiceSchema.index({ 'location.coordinates': '2dsphere' });
ServiceSchema.index({ ratingAverage: -1 });
ServiceSchema.index({ basePrice: 1 });
exports.Service = (0, mongoose_1.model)('Service', ServiceSchema);
