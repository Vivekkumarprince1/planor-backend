import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { ChatModel, MessageModel } from '../models/Chat';
import { User } from '../models/User';
import { auth, AuthPayload } from '../middleware/auth';

const router = Router();

// Create or get existing chat
router.post('/chats', auth, async (req: Request & { user?: AuthPayload }, res: Response) => {
  try {
    const body = z.object({
      managerId: z.string(),
      orderId: z.string().optional(),
    }).parse(req.body);

    const userId = req.user!._id.toString();
    const { managerId, orderId } = body;

    // Check if chat already exists
    let chat = await ChatModel.findOne({
      userId,
      managerId,
      ...(orderId && { orderId }),
    });

    if (!chat) {
      chat = new ChatModel({
        userId,
        managerId,
        orderId,
        participants: [userId, managerId],
        lastMessageAt: new Date().toISOString(),
      });
      await chat.save();
    }

    return res.json({ success: true, data: chat });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

// Get user's chats
router.get('/chats', auth, async (req: Request & { user?: AuthPayload }, res: Response) => {
  try {
    const userId = req.user!._id.toString();
    const chats = await ChatModel.find({
      participants: userId,
    }).sort({ lastMessageAt: -1 });

    // Enrich chats with last message and participant info
    const enrichedChats = await Promise.all(
      chats.map(async (chat) => {
        // Get the last message
        const lastMessage = await MessageModel.findOne({
          chatId: chat._id,
        }).sort({ createdAt: -1 });

        // Get participant info (manager/user info)
        const otherParticipantId = chat.participants.find(p => p !== userId);
        let participantInfo: any = null;
        
        if (otherParticipantId) {
          try {
            const participant = await User.findById(otherParticipantId).select('name email avatarUrl role');
            participantInfo = participant?.toObject() || null;
          } catch (err) {
            console.error('Error fetching participant info:', err);
          }
        }

        // Get order info if orderId exists
        let orderInfo: any = null;
        if (chat.orderId) {
          try {
            const { OrderModel } = await import('../models/Order');
            const order = await OrderModel.findById(chat.orderId).select('serviceTitle status');
            orderInfo = order?.toObject() || null;
          } catch (err) {
            console.error('Error fetching order info:', err);
          }
        }

        return {
          ...chat.toObject(),
          lastMessage,
          managerInfo: participantInfo,
          orderInfo,
        };
      })
    );

    return res.json({ success: true, data: enrichedChats });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Get chat messages
router.get('/chats/:id/messages', auth, async (req: Request & { user?: AuthPayload }, res: Response) => {
  try {
    const { cursor } = req.query;
    const limit = 50;
    const chatId = req.params.id;

    const filter: any = { chatId };
    if (cursor) {
      filter.createdAt = { $lt: new Date(cursor as string) };
    }

    const messages = await MessageModel.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit);

    return res.json({ success: true, data: messages.reverse() });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Send a message
router.post('/chats/:id/messages', auth, async (req: Request & { user?: AuthPayload }, res: Response) => {
  try {
    const userId = req.user!._id.toString();
    const chatId = req.params.id;
    const { content, type = 'text', mediaUrl } = z.object({
      content: z.string().optional(),
      type: z.enum(['text', 'image', 'file']).default('text'),
      mediaUrl: z.string().optional(),
    }).parse(req.body);

    // Validate that the user is a participant in this chat
    const chat = await ChatModel.findOne({
      _id: chatId,
      participants: userId,
    });

    if (!chat) {
      return res.status(404).json({ success: false, error: 'Chat not found or access denied' });
    }

    // Create the message
    const message = new MessageModel({
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
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

// Mark messages as read
router.patch('/chats/:id/read', auth, async (req: Request & { user?: AuthPayload }, res: Response) => {
  try {
    const userId = req.user!._id.toString();
    const chatId = req.params.id;
    const { messageIds } = z.object({
      messageIds: z.array(z.string()),
    }).parse(req.body);

    await MessageModel.updateMany(
      { _id: { $in: messageIds }, chatId },
      { $addToSet: { readBy: userId } }
    );

    return res.json({ success: true });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

export default router;
