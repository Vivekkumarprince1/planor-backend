"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequirementNotification = exports.RequirementQuote = exports.Requirement = void 0;
const mongoose_1 = require("mongoose");
const RequirementSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, trim: true },
    description: { type: String, trim: true },
    categoryId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
    subcategoryId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Subcategory', index: true },
    media: [{
            type: { type: String, enum: ['image', 'video', 'link'], required: true },
            url: { type: String, required: true },
            thumbnail: String
        }],
    location: {
        area: { type: String, required: true, index: true },
        city: { type: String, index: true },
        coordinates: {
            latitude: Number,
            longitude: Number
        }
    },
    attendeesCapacity: { type: Number, min: 1 },
    budget: {
        min: { type: Number, min: 0 },
        max: { type: Number, min: 0 }
    },
    timeframe: {
        startDate: Date,
        endDate: Date,
        flexible: { type: Boolean, default: true }
    },
    status: { type: String, enum: ['active', 'closed', 'cancelled'], default: 'active', index: true },
    quotes: [{ type: mongoose_1.Schema.Types.ObjectId, ref: 'RequirementQuote' }],
    notifications: [{ type: mongoose_1.Schema.Types.ObjectId, ref: 'RequirementNotification' }]
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});
// Index for location-based queries
RequirementSchema.index({ 'location.area': 1, categoryId: 1, status: 1 });
exports.Requirement = (0, mongoose_1.model)('Requirement', RequirementSchema);
const RequirementQuoteSchema = new mongoose_1.Schema({
    requirementId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Requirement', required: true, index: true },
    managerId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    serviceId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Service' },
    price: { type: Number, required: true, min: 0 },
    notes: { type: String, trim: true },
    availability: {
        startDate: Date,
        endDate: Date,
        notes: String
    },
    status: { type: String, enum: ['pending', 'accepted', 'rejected', 'withdrawn'], default: 'pending', index: true },
    chatId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Chat' },
    validUntil: { type: Date, index: true }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});
// Index for efficient querying
RequirementQuoteSchema.index({ requirementId: 1, managerId: 1 }, { unique: true });
exports.RequirementQuote = (0, mongoose_1.model)('RequirementQuote', RequirementQuoteSchema);
const RequirementNotificationSchema = new mongoose_1.Schema({
    requirementId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Requirement', required: true, index: true },
    managerId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['new_requirement', 'requirement_updated', 'quote_accepted', 'quote_rejected'], required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    isRead: { type: Boolean, default: false, index: true },
    readAt: Date
}, { timestamps: true });
// Index for efficient querying of unread notifications
RequirementNotificationSchema.index({ managerId: 1, isRead: 1, createdAt: -1 });
exports.RequirementNotification = (0, mongoose_1.model)('RequirementNotification', RequirementNotificationSchema);
