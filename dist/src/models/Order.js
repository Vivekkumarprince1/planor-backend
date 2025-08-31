"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderModel = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const orderItemSchema = new mongoose_1.Schema({
    serviceId: { type: String, required: true },
    tierLabel: { type: String, enum: ['small', 'medium', 'large'] },
    qty: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true },
    addOns: [{
            name: { type: String, required: true },
            price: { type: Number, required: true },
        }],
    notes: String,
});
const paymentSchema = new mongoose_1.Schema({
    provider: { type: String, enum: ['razorpay'], required: true },
    orderId: { type: String, required: true },
    paymentId: String,
    signature: String,
    status: {
        type: String,
        enum: ['created', 'paid', 'failed', 'refunded'],
        default: 'created'
    },
});
const timelineSchema = new mongoose_1.Schema({
    at: { type: String, default: () => new Date().toISOString() },
    by: { type: String, required: true },
    action: { type: String, required: true },
    note: String,
});
const addressSnapshotSchema = new mongoose_1.Schema({
    label: String,
    line1: String,
    city: String,
    state: String,
    pincode: String,
    geo: { lat: Number, lng: Number },
});
const orderSchema = new mongoose_1.Schema({
    userId: { type: String, required: true },
    managerId: { type: String, required: true },
    serviceId: String, // Added for easier reference
    items: [orderItemSchema],
    subtotal: { type: Number, required: true },
    fee: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    total: { type: Number, required: true },
    status: {
        type: String,
        enum: ['pending', 'accepted', 'in_progress', 'completed', 'cancelled', 'refunded'],
        default: 'pending'
    },
    addressSnapshot: addressSnapshotSchema,
    scheduledAt: String,
    payment: paymentSchema,
    timeline: [timelineSchema],
    refundAmount: Number,
    refundReason: String,
    refundedAt: Date,
    refundedBy: String,
}, {
    timestamps: true,
});
// Virtual field for totalAmount (alias for total)
orderSchema.virtual('totalAmount').get(function () {
    return this.total;
});
// Ensure virtuals are included when converting to JSON
orderSchema.set('toJSON', { virtuals: true });
orderSchema.set('toObject', { virtuals: true });
orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ managerId: 1, status: 1 });
orderSchema.index({ status: 1 });
exports.OrderModel = mongoose_1.default.model('Order', orderSchema);
