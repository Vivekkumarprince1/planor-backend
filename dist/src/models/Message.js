"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Message = void 0;
const mongoose_1 = require("mongoose");
const MessageSchema = new mongoose_1.Schema({
    chatId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Chat', required: true, index: true },
    senderId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['text', 'image', 'file'], default: 'text' },
    content: { type: String, required: true },
    mediaUrl: String,
    readBy: [{ type: mongoose_1.Schema.Types.ObjectId, ref: 'User' }],
}, { timestamps: { createdAt: true, updatedAt: false } });
MessageSchema.index({ chatId: 1, createdAt: -1 });
exports.Message = (0, mongoose_1.model)('Message', MessageSchema);
