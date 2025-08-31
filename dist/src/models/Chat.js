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
exports.MessageModel = exports.ChatModel = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const chatSchema = new mongoose_1.Schema({
    orderId: String,
    userId: { type: String, required: true },
    managerId: { type: String, required: true },
    participants: [String],
    lastMessageAt: { type: String, default: () => new Date().toISOString() },
}, {
    timestamps: true,
});
const messageSchema = new mongoose_1.Schema({
    chatId: { type: String, required: true },
    senderId: { type: String, required: true },
    type: { type: String, enum: ['text', 'image', 'file'], default: 'text' },
    content: String,
    mediaUrl: String,
    readBy: [String],
}, {
    timestamps: { createdAt: true, updatedAt: false },
});
chatSchema.index({ userId: 1, managerId: 1 });
chatSchema.index({ participants: 1 });
messageSchema.index({ chatId: 1, createdAt: -1 });
exports.ChatModel = mongoose_1.default.model('Chat', chatSchema);
exports.MessageModel = mongoose_1.default.model('Message', messageSchema);
