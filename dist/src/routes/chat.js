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
const express_1 = require("express");
const zod_1 = require("zod");
const Chat_1 = require("../models/Chat");
const User_1 = require("../models/User");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Create or get existing chat
router.post('/chats', auth_1.auth, async (req, res) => {
    try {
        const body = zod_1.z.object({
            managerId: zod_1.z.string(),
            orderId: zod_1.z.string().optional(),
        }).parse(req.body);
        const userId = req.user._id.toString();
        const { managerId, orderId } = body;
        // Check if chat already exists
        let chat = await Chat_1.ChatModel.findOne({
            userId,
            managerId,
            ...(orderId && { orderId }),
        });
        if (!chat) {
            chat = new Chat_1.ChatModel({
                userId,
                managerId,
                orderId,
                participants: [userId, managerId],
                lastMessageAt: new Date().toISOString(),
            });
            await chat.save();
        }
        return res.json({ success: true, data: chat });
    }
    catch (error) {
        return res.status(400).json({ success: false, error: error.message });
    }
});
// Get user's chats
router.get('/chats', auth_1.auth, async (req, res) => {
    try {
        const userId = req.user._id.toString();
        const chats = await Chat_1.ChatModel.find({
            participants: userId,
        }).sort({ lastMessageAt: -1 });
        // Enrich chats with last message and participant info
        const enrichedChats = await Promise.all(chats.map(async (chat) => {
            // Get the last message
            const lastMessage = await Chat_1.MessageModel.findOne({
                chatId: chat._id,
            }).sort({ createdAt: -1 });
            // Get participant info (manager/user info)
            const otherParticipantId = chat.participants.find(p => p !== userId);
            let participantInfo = null;
            if (otherParticipantId) {
                try {
                    const participant = await User_1.User.findById(otherParticipantId).select('name email avatarUrl role');
                    participantInfo = participant?.toObject() || null;
                }
                catch (err) {
                    console.error('Error fetching participant info:', err);
                }
            }
            // Get order info if orderId exists
            let orderInfo = null;
            if (chat.orderId) {
                try {
                    const { OrderModel } = await Promise.resolve().then(() => __importStar(require('../models/Order')));
                    const order = await OrderModel.findById(chat.orderId).select('serviceTitle status');
                    orderInfo = order?.toObject() || null;
                }
                catch (err) {
                    console.error('Error fetching order info:', err);
                }
            }
            return {
                ...chat.toObject(),
                lastMessage,
                managerInfo: participantInfo,
                orderInfo,
            };
        }));
        return res.json({ success: true, data: enrichedChats });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});
// Get chat messages
router.get('/chats/:id/messages', auth_1.auth, async (req, res) => {
    try {
        const { cursor } = req.query;
        const limit = 50;
        const chatId = req.params.id;
        const filter = { chatId };
        if (cursor) {
            filter.createdAt = { $lt: new Date(cursor) };
        }
        const messages = await Chat_1.MessageModel.find(filter)
            .sort({ createdAt: -1 })
            .limit(limit);
        return res.json({ success: true, data: messages.reverse() });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});
// Send a message
router.post('/chats/:id/messages', auth_1.auth, async (req, res) => {
    try {
        const userId = req.user._id.toString();
        const chatId = req.params.id;
        const { content, type = 'text', mediaUrl } = zod_1.z.object({
            content: zod_1.z.string().optional(),
            type: zod_1.z.enum(['text', 'image', 'file']).default('text'),
            mediaUrl: zod_1.z.string().optional(),
        }).parse(req.body);
        // Validate that the user is a participant in this chat
        const chat = await Chat_1.ChatModel.findOne({
            _id: chatId,
            participants: userId,
        });
        if (!chat) {
            return res.status(404).json({ success: false, error: 'Chat not found or access denied' });
        }
        // Create the message
        const message = new Chat_1.MessageModel({
            chatId,
            senderId: userId,
            type,
            content,
            mediaUrl,
            readBy: [userId], // Mark as read by sender
        });
        await message.save();
        // Update chat's lastMessageAt
        chat.lastMessageAt = new Date().toISOString();
        await chat.save();
        return res.json({ success: true, data: message });
    }
    catch (error) {
        return res.status(400).json({ success: false, error: error.message });
    }
});
// Mark messages as read
router.patch('/chats/:id/read', auth_1.auth, async (req, res) => {
    try {
        const userId = req.user._id.toString();
        const chatId = req.params.id;
        const { messageIds } = zod_1.z.object({
            messageIds: zod_1.z.array(zod_1.z.string()),
        }).parse(req.body);
        await Chat_1.MessageModel.updateMany({ _id: { $in: messageIds }, chatId }, { $addToSet: { readBy: userId } });
        return res.json({ success: true });
    }
    catch (error) {
        return res.status(400).json({ success: false, error: error.message });
    }
});
exports.default = router;
