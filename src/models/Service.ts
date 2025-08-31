import { Schema, model, Document, Types } from 'mongoose';

export type TierLabel = 'small' | 'medium' | 'large';
export type ServiceStatus = 'pending' | 'approved' | 'rejected' | 'draft';

export interface IPriceTier { label: TierLabel; price: number; description?: string; capacity?: number }
export interface IAddOn { name: string; price: number; description?: string }
export interface IMediaItem { 
  type: 'image'|'video'|'audio'; 
  url: string; 
  thumbUrl?: string; 
  caption?: string;
  description?: string;
  price?: number; // Individual price for this media item if applicable
  duration?: number; // For video/audio duration in seconds
  fileSize?: number; // File size in bytes
  isMain?: boolean;
  isPremium?: boolean; // If this media requires premium access
  tags?: string[]; // Tags for better categorization
}

export interface IFilter {
  minCost?: number;
  maxCost?: number;
  areas?: string[];
  minCapacity?: number;
  maxCapacity?: number;
  features?: string[];
}

export interface IService extends Document {
  managerId: Types.ObjectId;
  categoryId: Types.ObjectId;
  subcategoryId?: Types.ObjectId;
  title: string;
  slug: string;
  description: string;
  shortDescription?: string;
  media: IMediaItem[];
  mediaPackages?: { // New: Media packages with different pricing
    name: string;
    description: string;
    mediaItems: Types.ObjectId[];
    price: number;
    isDefault?: boolean;
  }[];
  basePrice: number;
  priceTiers?: IPriceTier[];
  addOns?: IAddOn[];
  areaServed?: string[];
  maxCapacity?: number;
  features?: string[];
  specifications?: { // New: Technical specifications
    [key: string]: string | number | boolean;
  };
  tags?: string[];
  ratingAverage?: number;
  ratingCount?: number;
  reviewCount?: number;
  isActive: boolean;
  status: ServiceStatus;
  adminNotes?: string;
  approvedAt?: Date;
  approvedBy?: string;
  moderationReason?: string;
  moderatedAt?: Date;
  moderatedBy?: string;
  customFields?: { // New: Custom fields for different service types
    fieldName: string;
    fieldType: 'text' | 'number' | 'boolean' | 'select' | 'multiselect';
    fieldValue: any;
    isRequired?: boolean;
  }[];
  location?: {
    address: string;
    city: string;
    state: string;
    pincode: string;
    coordinates?: [number, number]; // [longitude, latitude]
  };
  contactInfo?: {
    phone: string;
    email?: string;
    whatsapp?: string;
  };
  businessHours?: {
    [key: string]: { open: string; close: string; isOpen: boolean };
  };
  portfolio?: {
    title: string;
    description: string;
    images: string[];
    completedAt?: Date;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const MediaSchema = new Schema<IMediaItem>({
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

const MediaPackageSchema = new Schema({
  name: { type: String, required: true },
  description: String,
  mediaItems: [{ type: Schema.Types.ObjectId }],
  price: { type: Number, required: true, min: 0 },
  isDefault: { type: Boolean, default: false },
});

const CustomFieldSchema = new Schema({
  fieldName: { type: String, required: true },
  fieldType: { 
    type: String, 
    enum: ['text', 'number', 'boolean', 'select', 'multiselect'], 
    required: true 
  },
  fieldValue: Schema.Types.Mixed,
  isRequired: { type: Boolean, default: false },
});

const PriceTierSchema = new Schema<IPriceTier>({
  label: { type: String, enum: ['small', 'medium', 'large'], required: true },
  price: { type: Number, required: true },
  description: String,
  capacity: Number,
});

const AddOnSchema = new Schema<IAddOn>({ 
  name: { type: String, required: true }, 
  price: { type: Number, required: true },
  description: String,
});

const LocationSchema = new Schema({
  address: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  pincode: { type: String, required: true },
  coordinates: {
    type: [Number], // [longitude, latitude]
  }
});

const ContactSchema = new Schema({
  phone: { type: String, required: true },
  email: String,
  whatsapp: String,
});

const BusinessHoursSchema = new Schema({
  monday: { open: String, close: String, isOpen: { type: Boolean, default: true } },
  tuesday: { open: String, close: String, isOpen: { type: Boolean, default: true } },
  wednesday: { open: String, close: String, isOpen: { type: Boolean, default: true } },
  thursday: { open: String, close: String, isOpen: { type: Boolean, default: true } },
  friday: { open: String, close: String, isOpen: { type: Boolean, default: true } },
  saturday: { open: String, close: String, isOpen: { type: Boolean, default: true } },
  sunday: { open: String, close: String, isOpen: { type: Boolean, default: false } },
});

const PortfolioSchema = new Schema({
  title: { type: String, required: true },
  description: String,
  images: [String],
  completedAt: Date,
});

const ServiceSchema = new Schema<IService>({
  managerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  categoryId: { type: Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
  subcategoryId: { type: Schema.Types.ObjectId, ref: 'Subcategory', index: true },
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
  specifications: { type: Schema.Types.Mixed, default: {} },
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

export const Service = model<IService>('Service', ServiceSchema);
