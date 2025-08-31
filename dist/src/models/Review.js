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
exports.NotificationModel = exports.ReviewModel = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const reviewSchema = new mongoose_1.Schema({
    orderId: { type: String, required: true },
    serviceId: { type: String, required: true },
    userId: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: String,
}, {
    timestamps: { createdAt: true, updatedAt: false },
});
const notificationSchema = new mongoose_1.Schema({
    userId: { type: String, required: true },
    title: { type: String, required: true },
    body: { type: String, required: true },
    type: { type: String, required: true },
    data: mongoose_1.Schema.Types.Mixed,
    read: { type: Boolean, default: false },
}, {
    timestamps: { createdAt: true, updatedAt: false },
});
reviewSchema.index({ serviceId: 1, userId: 1 }, { unique: true });
reviewSchema.index({ orderId: 1 });
notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
exports.ReviewModel = mongoose_1.default.model('Review', reviewSchema);
exports.NotificationModel = mongoose_1.default.model('Notification', notificationSchema);
