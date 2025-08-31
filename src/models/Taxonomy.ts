import { Schema, model, Document, Types } from 'mongoose';

export interface ICategory extends Document {
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  image?: string;
  color?: string;
  isActive: boolean;
  hasSubcategories: boolean;
  order?: number;
  parentId?: Types.ObjectId; // For nested categories
  serviceCount?: number; // Computed field for number of services
  metadata?: { // Additional metadata for categories
    keywords: string[];
    seoTitle?: string;
    seoDescription?: string;
    customFields?: { [key: string]: any };
  };
  features?: string[]; // Common features for services in this category
  requiredFields?: { // Fields required for services in this category
    fieldName: string;
    fieldType: string;
    isRequired: boolean;
  }[];
  createdBy?: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CategorySchema = new Schema<ICategory>({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true, index: true },
  description: { type: String, default: '' },
  icon: String,
  image: String,
  color: { type: String, default: '#007AFF' },
  isActive: { type: Boolean, default: true },
  hasSubcategories: { type: Boolean, default: false },
  order: { type: Number, default: 0 },
  parentId: { type: Schema.Types.ObjectId, ref: 'Category', index: true },
  serviceCount: { type: Number, default: 0 },
  metadata: {
    keywords: [String],
    seoTitle: String,
    seoDescription: String,
    customFields: Schema.Types.Mixed,
  },
  features: [String],
  requiredFields: [{
    fieldName: { type: String, required: true },
    fieldType: { type: String, required: true },
    isRequired: { type: Boolean, default: false },
  }],
  createdBy: String,
  updatedBy: String,
}, { timestamps: true });

export const Category = model<ICategory>('Category', CategorySchema);

export interface ISubcategory extends Document {
  categoryId: Types.ObjectId;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  image?: string;
  isActive: boolean;
  order?: number;
  parentId?: Types.ObjectId; // For nested subcategories
  serviceCount?: number;
  metadata?: {
    keywords: string[];
    seoTitle?: string;
    seoDescription?: string;
    customFields?: { [key: string]: any };
  };
  features?: string[];
  requiredFields?: {
    fieldName: string;
    fieldType: string;
    isRequired: boolean;
  }[];
  createdBy?: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SubcategorySchema = new Schema<ISubcategory>({
  categoryId: { type: Schema.Types.ObjectId, ref: 'Category', index: true, required: true },
  name: { type: String, required: true },
  slug: { type: String, required: true, index: true },
  description: { type: String, default: '' },
  icon: String,
  image: String,
  isActive: { type: Boolean, default: true },
  order: { type: Number, default: 0 },
  parentId: { type: Schema.Types.ObjectId, ref: 'Subcategory', index: true },
  serviceCount: { type: Number, default: 0 },
  metadata: {
    keywords: [String],
    seoTitle: String,
    seoDescription: String,
    customFields: Schema.Types.Mixed,
  },
  features: [String],
  requiredFields: [{
    fieldName: { type: String, required: true },
    fieldType: { type: String, required: true },
    isRequired: { type: Boolean, default: false },
  }],
  createdBy: String,
  updatedBy: String,
}, { timestamps: true });

SubcategorySchema.index({ categoryId: 1, slug: 1 }, { unique: true });

export const Subcategory = model<ISubcategory>('Subcategory', SubcategorySchema);
