"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Notification = void 0;
const mongoose_1 = require("mongoose");
const NotificationSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true },
    body: { type: String, required: true },
    type: { type: String, required: true },
    data: mongoose_1.Schema.Types.Mixed,
    read: { type: Boolean, default: false },
}, { timestamps: { createdAt: true, updatedAt: false } });
NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, read: 1 });
exports.Notification = (0, mongoose_1.model)('Notification', NotificationSchema);
