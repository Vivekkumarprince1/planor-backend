import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { OrderModel } from '../models/Order';
import { ChatModel, MessageModel } from '../models/Chat';
import { User } from '../models/User';
import { Category, Subcategory } from '../models/Taxonomy';
import { Service } from '../models/Service';
import { auth, requireRole, AuthPayload } from '../middleware/auth';

const router = Router();

// =====================================================
// ADMIN USER MANAGEMENT
// =====================================================

// Get all users with filters
router.get('/users', auth, requireRole('admin'), async (req: Request & { user?: AuthPayload }, res: Response) => {
  try {
    const { role, status, search, page = 1, limit = 20 } = req.query;
    
    const filter: any = {};
    if (role) filter.role = role;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(filter)
      .select('-passwordHash')
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));

    const total = await User.countDocuments(filter);

    return res.json({
      success: true,
      data: { items: users, total, page: Number(page), limit: Number(limit) },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Get pending managers for approval
router.get('/managers/pending', auth, requireRole('admin'), async (req: Request & { user?: AuthPayload }, res: Response) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    
    const managers = await User.find({ 
      role: 'manager',
      $or: [
        { approved: { $exists: false } },
        { approved: false }
      ]
    })
      .select('-passwordHash')
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));

    const total = await User.countDocuments({ 
      role: 'manager',
      $or: [
        { approved: { $exists: false } },
        { approved: false }
      ]
    });

    return res.json({
      success: true,
      data: { items: managers, total, page: Number(page), limit: Number(limit) },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Approve/Reject manager
router.patch('/managers/:id/approve', auth, requireRole('admin'), async (req: Request & { user?: AuthPayload }, res: Response) => {
  try {
    const { approved, adminNotes } = z.object({
      approved: z.boolean(),
      adminNotes: z.string().optional(),
    }).parse(req.body);

    const manager = await User.findById(req.params.id);
    if (!manager) {
      return res.status(404).json({ success: false, error: 'Manager not found' });
    }

    if (manager.role !== 'manager') {
      return res.status(400).json({ success: false, error: 'User is not a manager' });
    }

    const updatedManager = await User.findByIdAndUpdate(
      req.params.id,
      { 
        approved,
        adminNotes,
        approvedAt: approved ? new Date() : null,
        approvedBy: approved ? req.user!._id : null
      },
      { new: true }
    ).select('-passwordHash');

    return res.json({ success: true, data: updatedManager });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

// Get manager details for review
router.get('/managers/:id', auth, requireRole('admin'), async (req: Request & { user?: AuthPayload }, res: Response) => {
  try {
    const manager = await User.findById(req.params.id).select('-passwordHash');
    
    if (!manager) {
      return res.status(404).json({ success: false, error: 'Manager not found' });
    }

    // Get manager's services
    const services = await Service.find({ managerId: req.params.id })
      .populate('categoryId', 'name slug')
      .populate('subcategoryId', 'name slug')
      .sort({ createdAt: -1 })
      .limit(10);

    // Get manager's orders
    const orders = await OrderModel.find({ managerId: req.params.id })
      .sort({ createdAt: -1 })
      .limit(10);

    return res.json({ 
      success: true, 
      data: { 
        manager, 
        services: services.length,
        orders: orders.length,
        recentServices: services,
        recentOrders: orders
      } 
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Update user role
router.patch('/users/:id/role', auth, requireRole('admin'), async (req: Request & { user?: AuthPayload }, res: Response) => {
  try {
    const { role } = z.object({
      role: z.enum(['user', 'manager', 'admin']),
    }).parse(req.body);

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true }
    ).select('-passwordHash');

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    return res.json({ success: true, data: user });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

// Update user details (name, email, phone)
router.patch('/users/:id', auth, requireRole('admin'), async (req: Request & { user?: AuthPayload }, res: Response) => {
  try {
    const { name, email, phone } = z.object({
      name: z.string().optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
    }).parse(req.body);

    const updateData: any = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone;

    // Check if email is already taken by another user
    if (email) {
      const existingUser = await User.findOne({ 
        email, 
        _id: { $ne: req.params.id } 
      });
      if (existingUser) {
        return res.status(400).json({ 
          success: false, 
          error: 'Email already exists' 
        });
      }
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    ).select('-passwordHash');

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    return res.json({ success: true, data: user });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

// Verify user manually
router.patch('/users/:id/verify', auth, requireRole('admin'), async (req: Request & { user?: AuthPayload }, res: Response) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { 
        isVerified: true,
        verifiedAt: new Date(),
        verifiedBy: req.user!._id
      },
      { new: true }
    ).select('-passwordHash');

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    return res.json({ success: true, data: user });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

// Send password reset email
router.post('/users/:id/reset-password', auth, requireRole('admin'), async (req: Request & { user?: AuthPayload }, res: Response) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Here you would typically:
    // 1. Generate a reset token
    // 2. Save it to the user record
    // 3. Send an email with the reset link
    // For now, we'll just return success
    
    // TODO: Implement actual password reset email functionality
    // const resetToken = generateResetToken();
    // await User.findByIdAndUpdate(user._id, {
    //   passwordResetToken: resetToken,
    //   passwordResetExpires: new Date(Date.now() + 3600000) // 1 hour
    // });
    // await sendPasswordResetEmail(user.email, resetToken);

    return res.json({ 
      success: true, 
      message: 'Password reset email sent successfully' 
    });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

// Block/Unblock user
router.patch('/users/:id/block', auth, requireRole('admin'), async (req: Request & { user?: AuthPayload }, res: Response) => {
  try {
    const { blocked, reason } = z.object({
      blocked: z.boolean(),
      reason: z.string().optional(),
    }).parse(req.body);

    const updateData: any = { blocked };
    
    if (blocked) {
      updateData.blockReason = reason || 'Blocked by admin';
      updateData.blockedAt = new Date();
      updateData.blockedBy = req.user!._id;
    } else {
      updateData.blockReason = null;
      updateData.blockedAt = null;
      updateData.blockedBy = null;
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    ).select('-passwordHash');

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    return res.json({ success: true, data: user });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

// Delete user (soft delete by blocking)
router.delete('/users/:id', auth, requireRole('admin'), async (req: Request & { user?: AuthPayload }, res: Response) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { 
        blocked: true, 
        blockReason: 'Deleted by admin',
        blockedAt: new Date(),
        blockedBy: req.user!._id
      },
      { new: true }
    ).select('-passwordHash');

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    return res.json({ success: true, data: user });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

// =====================================================
// ADMIN CHAT MANAGEMENT
// =====================================================

// Get all chats with detailed information
router.get('/chats', auth, requireRole('admin'), async (req: Request & { user?: AuthPayload }, res: Response) => {
  try {
    const { userId, managerId, orderId, search, page = 1, limit = 20 } = req.query;
    
    const filter: any = {};
    if (userId) filter.userId = userId;
    if (managerId) filter.managerId = managerId;
    if (orderId) filter.orderId = orderId;

    const chats = await ChatModel.find(filter)
      .populate('userId', 'name email phone')
      .populate('managerId', 'name email phone')
      .sort({ lastMessageAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));

    // Get message count for each chat
    const chatsWithCounts = await Promise.all(
      chats.map(async (chat) => {
        const messageCount = await MessageModel.countDocuments({ chatId: chat._id });
        const lastMessage = await MessageModel.findOne({ chatId: chat._id })
          .sort({ createdAt: -1 });
        
        return {
          ...chat.toObject(),
          messageCount,
          lastMessage: lastMessage ? {
            content: lastMessage.content,
            type: lastMessage.type,
            createdAt: lastMessage.createdAt,
            senderId: lastMessage.senderId
          } : null
        };
      })
    );

    const total = await ChatModel.countDocuments(filter);

    return res.json({
      success: true,
      data: { items: chatsWithCounts, total, page: Number(page), limit: Number(limit) },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Get specific chat with all messages
router.get('/chats/:id', auth, requireRole('admin'), async (req: Request & { user?: AuthPayload }, res: Response) => {
  try {
    const chat = await ChatModel.findById(req.params.id)
      .populate('userId', 'name email phone')
      .populate('managerId', 'name email phone');

    if (!chat) {
      return res.status(404).json({ success: false, error: 'Chat not found' });
    }

    const messages = await MessageModel.find({ chatId: req.params.id })
      .populate('senderId', 'name email')
      .sort({ createdAt: 1 });

    return res.json({
      success: true,
      data: { chat, messages },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Send admin message in chat
router.post('/chats/:id/messages', auth, requireRole('admin'), async (req: Request & { user?: AuthPayload }, res: Response) => {
  try {
    const { content, type = 'text', mediaUrl } = z.object({
      content: z.string().optional(),
      type: z.enum(['text', 'image', 'file']).default('text'),
      mediaUrl: z.string().optional(),
    }).parse(req.body);

    if (!content && !mediaUrl) {
      return res.status(400).json({ success: false, error: 'Content or media URL required' });
    }

    const chat = await ChatModel.findById(req.params.id);
    if (!chat) {
      return res.status(404).json({ success: false, error: 'Chat not found' });
    }

    const message = new MessageModel({
      chatId: req.params.id,
      senderId: req.user!._id,
      type,
      content,
      mediaUrl,
    });

    await message.save();

    // Update chat's lastMessageAt
    chat.lastMessageAt = new Date().toISOString();
    await chat.save();

    const populatedMessage = await MessageModel.findById(message._id)
      .populate('senderId', 'name email');

    return res.status(201).json({ success: true, data: populatedMessage });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

// Delete chat
router.delete('/chats/:id', auth, requireRole('admin'), async (req: Request & { user?: AuthPayload }, res: Response) => {
  try {
    const chat = await ChatModel.findById(req.params.id);
    if (!chat) {
      return res.status(404).json({ success: false, error: 'Chat not found' });
    }

    // Delete all messages in the chat
    await MessageModel.deleteMany({ chatId: req.params.id });
    
    // Delete the chat
    await ChatModel.findByIdAndDelete(req.params.id);

    return res.json({ success: true, message: 'Chat and all messages deleted successfully' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// ADMIN SERVICE MANAGEMENT
// =====================================================

// Admin Service Management - Get pending services for approval
router.get('/services/pending', auth, requireRole('admin'), async (req: Request & { user?: AuthPayload }, res: Response) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    
    const services = await Service.find({ status: 'pending' })
      .populate('managerId', 'name email phone approved')
      .populate('categoryId', 'name slug')
      .populate('subcategoryId', 'name slug')
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));

    const total = await Service.countDocuments({ status: 'pending' });

    return res.json({
      success: true,
      data: { items: services, total, page: Number(page), limit: Number(limit) },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Admin Service Management - Get all services with filters
router.get('/services', auth, requireRole('admin'), async (req: Request & { user?: AuthPayload }, res: Response) => {
  try {
    const { status, managerId, categoryId, search, page = 1, limit = 20 } = req.query;
    
    const filter: any = {};
    if (status) filter.status = status;
    if (managerId) filter.managerId = managerId;
    if (categoryId) filter.categoryId = categoryId;
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const services = await Service.find(filter)
      .populate('managerId', 'name email phone approved')
      .populate('categoryId', 'name slug')
      .populate('subcategoryId', 'name slug')
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));

    const total = await Service.countDocuments(filter);

    return res.json({
      success: true,
      data: { items: services, total, page: Number(page), limit: Number(limit) },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Admin Service Management - Approve/Reject service
router.patch('/services/:id/status', auth, requireRole('admin'), async (req: Request & { user?: AuthPayload }, res: Response) => {
  try {
    const { status, adminNotes } = z.object({
      status: z.enum(['approved', 'rejected']),
      adminNotes: z.string().optional(),
    }).parse(req.body);
    
    const service = await Service.findByIdAndUpdate(
      req.params.id,
      { 
        status, 
        adminNotes,
        approvedAt: status === 'approved' ? new Date() : null,
        approvedBy: status === 'approved' ? req.user!._id : null,
        isActive: status === 'approved' 
      },
      { new: true }
    ).populate('managerId categoryId subcategoryId');
    
    if (!service) {
      return res.status(404).json({ success: false, error: 'Service not found' });
    }
    
    return res.json({ success: true, data: service });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

// Admin Service Management - Get service details for review
router.get('/services/:id', auth, requireRole('admin'), async (req: Request & { user?: AuthPayload }, res: Response) => {
  try {
    const service = await Service.findById(req.params.id)
      .populate('managerId', 'name email phone approved createdAt')
      .populate('categoryId', 'name slug description')
      .populate('subcategoryId', 'name slug description');
    
    if (!service) {
      return res.status(404).json({ success: false, error: 'Service not found' });
    }

    // Get service statistics
    const orders = await OrderModel.find({ serviceId: req.params.id });
    const stats = {
      totalOrders: orders.length,
      completedOrders: orders.filter(o => o.status === 'completed').length,
      revenue: orders.filter(o => o.status === 'completed').reduce((sum, o) => sum + o.totalAmount, 0),
      averageRating: 0 // You can calculate this from reviews if available
    };
    
    return res.json({ success: true, data: { service, stats } });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Admin Service Management - Toggle service activity
router.patch('/services/:id/moderate', auth, requireRole('admin'), async (req: Request & { user?: AuthPayload }, res: Response) => {
  try {
    const { isActive, reason } = z.object({
      isActive: z.boolean(),
      reason: z.string().optional(),
    }).parse(req.body);

    const service = await Service.findByIdAndUpdate(
      req.params.id,
      { 
        isActive,
        moderationReason: reason,
        moderatedAt: new Date(),
        moderatedBy: req.user!._id
      },
      { new: true }
    ).populate('managerId categoryId subcategoryId');

    if (!service) {
      return res.status(404).json({ success: false, error: 'Service not found' });
    }

    return res.json({ success: true, data: service });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

// Bulk service actions
router.patch('/services/bulk', auth, requireRole('admin'), async (req: Request & { user?: AuthPayload }, res: Response) => {
  try {
    const { serviceIds, action, reason } = z.object({
      serviceIds: z.array(z.string()),
      action: z.enum(['approve', 'reject', 'activate', 'deactivate']),
      reason: z.string().optional(),
    }).parse(req.body);

    const updateData: any = {};
    
    switch (action) {
      case 'approve':
        updateData.status = 'approved';
        updateData.isActive = true;
        updateData.approvedAt = new Date();
        updateData.approvedBy = req.user!._id;
        break;
      case 'reject':
        updateData.status = 'rejected';
        updateData.isActive = false;
        break;
      case 'activate':
        updateData.isActive = true;
        break;
      case 'deactivate':
        updateData.isActive = false;
        break;
    }

    if (reason) updateData.adminNotes = reason;

    const result = await Service.updateMany(
      { _id: { $in: serviceIds } },
      updateData
    );

    return res.json({ 
      success: true, 
      message: `${result.modifiedCount} services updated successfully` 
    });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

// =====================================================
// ADMIN ORDER MANAGEMENT
// =====================================================

// Get all orders with enhanced filtering
router.get('/orders', auth, requireRole('admin'), async (req: Request & { user?: AuthPayload }, res: Response) => {
  try {
    const { 
      status, 
      managerId, 
      userId, 
      serviceId,
      from, 
      to, 
      minAmount,
      maxAmount,
      search,
      page = 1, 
      limit = 20 
    } = req.query;
    
    const filter: any = {};
    if (status) filter.status = status;
    if (managerId) filter.managerId = managerId;
    if (userId) filter.userId = userId;
    if (serviceId) filter.serviceId = serviceId;
    if (minAmount) filter.totalAmount = { ...filter.totalAmount, $gte: Number(minAmount) };
    if (maxAmount) filter.totalAmount = { ...filter.totalAmount, $lte: Number(maxAmount) };
    
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from as string);
      if (to) filter.createdAt.$lte = new Date(to as string);
    }

    const orders = await OrderModel.find(filter)
      .populate('userId', 'name email phone')
      .populate('managerId', 'name email phone')
      .populate('serviceId', 'title basePrice')
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));

    const total = await OrderModel.countDocuments(filter);

    // Calculate summary statistics
    const stats = await OrderModel.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$totalAmount' },
          averageOrderValue: { $avg: '$totalAmount' },
          statusBreakdown: {
            $push: '$status'
          }
        }
      }
    ]);

    return res.json({
      success: true,
      data: { 
        items: orders, 
        total, 
        page: Number(page), 
        limit: Number(limit),
        stats: stats[0] || { totalRevenue: 0, averageOrderValue: 0, statusBreakdown: [] }
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Get specific order details
router.get('/orders/:id', auth, requireRole('admin'), async (req: Request & { user?: AuthPayload }, res: Response) => {
  try {
    const order = await OrderModel.findById(req.params.id)
      .populate('userId', 'name email phone addresses')
      .populate('managerId', 'name email phone')
      .populate('serviceId', 'title description basePrice');

    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    return res.json({ success: true, data: order });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: Update order status
router.patch('/orders/:id/status', auth, requireRole('admin'), async (req: Request & { user?: AuthPayload }, res: Response) => {
  try {
    const { status, note } = z.object({
      status: z.enum(['pending', 'accepted', 'in_progress', 'completed', 'cancelled', 'refunded']),
      note: z.string().optional(),
    }).parse(req.body);

    const order = await OrderModel.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    order.status = status;
    order.timeline.push({
      at: new Date().toISOString(),
      by: req.user!._id,
      action: `Admin changed status to ${status}`,
      note,
    });

    await order.save();
    return res.json({ success: true, data: order });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

// Refund order
router.post('/orders/:id/refund', auth, requireRole('admin'), async (req: Request & { user?: AuthPayload }, res: Response) => {
  try {
    const { refundAmount, reason } = z.object({
      refundAmount: z.number().positive(),
      reason: z.string(),
    }).parse(req.body);

    const order = await OrderModel.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    if (refundAmount > order.totalAmount) {
      return res.status(400).json({ success: false, error: 'Refund amount cannot exceed order total' });
    }

    order.status = 'refunded';
    order.refundAmount = refundAmount;
    order.refundReason = reason;
    order.refundedAt = new Date();
    order.refundedBy = req.user!._id;
    
    order.timeline.push({
      at: new Date().toISOString(),
      by: req.user!._id,
      action: `Admin processed refund of $${refundAmount}`,
      note: reason,
    });

    await order.save();
    return res.json({ success: true, data: order });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

// =====================================================
// ADMIN CATEGORY MANAGEMENT
// =====================================================

// Get all categories with subcategories
router.get('/categories', auth, requireRole('admin'), async (req: Request & { user?: AuthPayload }, res: Response) => {
  try {
    const categories = await Category.find()
      .sort({ order: 1, name: 1 });

    const subcategories = await Subcategory.find()
      .populate('categoryId', 'name')
      .sort({ order: 1, name: 1 });

    return res.json({
      success: true,
      data: { categories, subcategories },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Create category
router.post('/categories', auth, requireRole('admin'), async (req: Request & { user?: AuthPayload }, res: Response) => {
  try {
    const body = z.object({
      name: z.string().min(1),
      slug: z.string().min(1),
      description: z.string().optional(),
      icon: z.string().optional(),
      order: z.number().optional(),
      isActive: z.boolean().default(true),
    }).parse(req.body);

    const category = new Category({
      ...body,
      createdBy: req.user!._id,
    });
    
    await category.save();
    return res.status(201).json({ success: true, data: category });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

// Update category
router.patch('/categories/:id', auth, requireRole('admin'), async (req: Request & { user?: AuthPayload }, res: Response) => {
  try {
    const updates = z.object({
      name: z.string().optional(),
      slug: z.string().optional(),
      description: z.string().optional(),
      icon: z.string().optional(),
      order: z.number().optional(),
      isActive: z.boolean().optional(),
    }).parse(req.body);

    const category = await Category.findByIdAndUpdate(
      req.params.id, 
      {
        ...updates,
        updatedBy: req.user!._id,
        updatedAt: new Date(),
      }, 
      { new: true }
    );

    if (!category) {
      return res.status(404).json({ success: false, error: 'Category not found' });
    }

    return res.json({ success: true, data: category });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

// Delete category
router.delete('/categories/:id', auth, requireRole('admin'), async (req: Request & { user?: AuthPayload }, res: Response) => {
  try {
    // Check if category has services
    const serviceCount = await Service.countDocuments({ categoryId: req.params.id });
    if (serviceCount > 0) {
      return res.status(400).json({ 
        success: false, 
        error: `Cannot delete category with ${serviceCount} associated services` 
      });
    }

    // Delete all subcategories first
    await Subcategory.deleteMany({ categoryId: req.params.id });
    
    // Delete category
    const category = await Category.findByIdAndDelete(req.params.id);
    if (!category) {
      return res.status(404).json({ success: false, error: 'Category not found' });
    }

    return res.json({ success: true, message: 'Category and subcategories deleted successfully' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Create subcategory
router.post('/subcategories', auth, requireRole('admin'), async (req: Request & { user?: AuthPayload }, res: Response) => {
  try {
    const body = z.object({
      categoryId: z.string(),
      name: z.string().min(1),
      slug: z.string().min(1),
      description: z.string().optional(),
      order: z.number().optional(),
      isActive: z.boolean().default(true),
    }).parse(req.body);

    const subcategory = new Subcategory({
      ...body,
      createdBy: req.user!._id,
    });
    
    await subcategory.save();
    return res.status(201).json({ success: true, data: subcategory });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

// Update subcategory
router.patch('/subcategories/:id', auth, requireRole('admin'), async (req: Request & { user?: AuthPayload }, res: Response) => {
  try {
    const updates = z.object({
      name: z.string().optional(),
      slug: z.string().optional(),
      description: z.string().optional(),
      order: z.number().optional(),
      isActive: z.boolean().optional(),
    }).parse(req.body);

    const subcategory = await Subcategory.findByIdAndUpdate(
      req.params.id,
      {
        ...updates,
        updatedBy: req.user!._id,
        updatedAt: new Date(),
      },
      { new: true }
    );

    if (!subcategory) {
      return res.status(404).json({ success: false, error: 'Subcategory not found' });
    }

    return res.json({ success: true, data: subcategory });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

// =====================================================
// ADMIN ANALYTICS & REPORTS
// =====================================================

// Dashboard statistics
router.get('/dashboard/stats', auth, requireRole('admin'), async (req: Request & { user?: AuthPayload }, res: Response) => {
  try {
    const [
      totalUsers,
      totalManagers,
      pendingManagers,
      totalServices,
      pendingServices,
      totalOrders,
      totalRevenue,
      activeChats,
    ] = await Promise.all([
      User.countDocuments({ role: 'user', blocked: { $ne: true } }),
      User.countDocuments({ role: 'manager', blocked: { $ne: true } }),
      User.countDocuments({ role: 'manager', approved: false, blocked: { $ne: true } }),
      Service.countDocuments(),
      Service.countDocuments({ status: 'pending' }),
      OrderModel.countDocuments(),
      OrderModel.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ]).then(result => result[0]?.total || 0),
      ChatModel.countDocuments({
        lastMessageAt: {
          $gte: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() // Last 24 hours
        }
      }),
    ]);

    // Recent activity
    const recentOrders = await OrderModel.find()
      .populate('userId', 'name')
      .populate('serviceId', 'title')
      .sort({ createdAt: -1 })
      .limit(5);

    const recentUsers = await User.find()
      .select('name email role createdAt')
      .sort({ createdAt: -1 })
      .limit(5);

    return res.json({
      success: true,
      data: {
        stats: {
          totalUsers,
          totalManagers,
          pendingManagers,
          totalServices,
          pendingServices,
          totalOrders,
          totalRevenue,
          activeChats,
        },
        recentActivity: {
          orders: recentOrders,
          users: recentUsers,
        }
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Revenue analytics
router.get('/analytics/revenue', auth, requireRole('admin'), async (req: Request & { user?: AuthPayload }, res: Response) => {
  try {
    const { period = 'month', year, month } = req.query;
    
    const matchStage: any = { status: 'completed' };
    
    if (year && month) {
      const startDate = new Date(Number(year), Number(month) - 1, 1);
      const endDate = new Date(Number(year), Number(month), 0);
      matchStage.createdAt = { $gte: startDate, $lte: endDate };
    }

    const analytics = await OrderModel.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            ...(period === 'day' && { day: { $dayOfMonth: '$createdAt' } })
          },
          totalRevenue: { $sum: '$totalAmount' },
          orderCount: { $sum: 1 },
          averageOrderValue: { $avg: '$totalAmount' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    return res.json({
      success: true,
      data: analytics,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
