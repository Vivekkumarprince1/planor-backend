"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Subcategory = exports.Category = void 0;
const mongoose_1 = require("mongoose");
const CategorySchema = new mongoose_1.Schema({
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true, index: true },
    description: { type: String, default: '' },
    icon: String,
    image: String,
    color: { type: String, default: '#007AFF' },
    isActive: { type: Boolean, default: true },
    hasSubcategories: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
    parentId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Category', index: true },
    serviceCount: { type: Number, default: 0 },
    metadata: {
        keywords: [String],
        seoTitle: String,
        seoDescription: String,
        customFields: mongoose_1.Schema.Types.Mixed,
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
exports.Category = (0, mongoose_1.model)('Category', CategorySchema);
const SubcategorySchema = new mongoose_1.Schema({
    categoryId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Category', index: true, required: true },
    name: { type: String, required: true },
    slug: { type: String, required: true, index: true },
    description: { type: String, default: '' },
    icon: String,
    image: String,
    isActive: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
    parentId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Subcategory', index: true },
    serviceCount: { type: Number, default: 0 },
    metadata: {
        keywords: [String],
        seoTitle: String,
        seoDescription: String,
        customFields: mongoose_1.Schema.Types.Mixed,
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
exports.Subcategory = (0, mongoose_1.model)('Subcategory', SubcategorySchema);
