import express, { Request, Response } from 'express';
import { auth, requireRole, AuthPayload } from '../middleware/auth';
import { Requirement, RequirementQuote, RequirementNotification } from '../models/Requirement';
import { Service } from '../models/Service';
import { User } from '../models/User';
import { ChatModel as Chat, MessageModel as Message } from '../models/Chat';
import { Types } from 'mongoose';

interface AuthRequest extends Request {
  user?: AuthPayload;
}

const router = express.Router();

// POST /api/requirements - Create a new requirement
router.post('/', auth, async (req: AuthRequest, res: Response) => {
  try {
    const {
      title,
      description,
      categoryId,
      subcategoryId,
      media,
      location,
      attendeesCapacity,
      budget,
      timeframe
    } = req.body;

    // Validate required fields
    if (!categoryId || !location?.area) {
      return res.status(400).json({
        success: false,
        message: 'Category and location area are required'
      });
    }

    // Create the requirement
    const requirement = new Requirement({
      userId: req.user!._id,
      title,
      description,
      categoryId,
      subcategoryId,
      media: media || [],
      location,
      attendeesCapacity,
      budget,
      timeframe
    });

    await requirement.save();

    // Find managers in the same area and category
    const managers = await User.find({
      role: 'manager',
      isActive: true,
      'location.area': location.area
    });

    // Get services matching the requirement
    const serviceQuery: any = {
      categoryId,
      status: 'approved',
      isActive: true
    };

    if (subcategoryId) {
      serviceQuery.subcategoryId = subcategoryId;
    }

    const matchingServices = await Service.find(serviceQuery)
      .populate('managerId', '_id name')
      .exec();

    // Get unique manager IDs from matching services
    const serviceManagerIds = matchingServices
      .map(service => service.managerId._id.toString())
      .filter((value, index, self) => self.indexOf(value) === index);

    // Combine managers from location and services
    const allManagerIds = [
      ...managers.map(m => (m._id as Types.ObjectId).toString()),
      ...serviceManagerIds
    ].filter((value, index, self) => self.indexOf(value) === index);

    // Create notifications for relevant managers
    const notifications = await Promise.all(
      allManagerIds.map(async (managerId) => {
        const notification = new RequirementNotification({
          requirementId: requirement._id,
          managerId: new Types.ObjectId(managerId),
          type: 'new_requirement',
          title: 'New Requirement Available',
          message: `A new ${title || 'service requirement'} is available in ${location.area}${attendeesCapacity ? ` for ${attendeesCapacity} people` : ''}`
        });
        await notification.save();
        return notification;
      })
    );

    // Update requirement with notification references
    requirement.notifications = notifications.map(n => n._id as Types.ObjectId);
    await requirement.save();

    // Populate the response
    const populatedRequirement = await Requirement.findById(requirement._id)
      .populate('categoryId', 'name')
      .populate('subcategoryId', 'name')
      .populate('userId', 'name email')
      .exec();

    res.status(201).json({
      success: true,
      data: populatedRequirement,
      message: `Requirement created successfully. ${notifications.length} managers notified.`
    });

  } catch (error) {
    console.error('Create requirement error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create requirement'
    });
  }
});

// GET /api/requirements - Get user's requirements or manager's relevant requirements
router.get('/', auth, async (req: AuthRequest, res: Response) => {
  try {
    const { status, page = 1, limit = 10, view = 'my' } = req.query;
    const user = req.user!;

    console.log('GET /requirements - User info:', { 
      id: user._id, 
      role: user.role,
      status: status,
      view: view 
    });

    let query: any = {};

    // Check if this is specifically for "my requirements" (user's own requirements)
    // or if it's the default view which should show user's own requirements
    if (view === 'my' || !view) {
      // Always show user's own requirements
      query = { userId: user._id };
      console.log('My requirements query:', query);
    } else if (user.role === 'manager' && view === 'available') {
      // For managers, get requirements they can quote on (only when explicitly requested)
      const managerServices = await Service.find({
        managerId: user._id,
        status: 'approved',
        isActive: true
      });

      const categoryIds = [...new Set(managerServices.map(s => s.categoryId.toString()))];
      const subcategoryIds = [...new Set(managerServices.map(s => s.subcategoryId?.toString()).filter(Boolean))];

      query = {
        $or: [
          { categoryId: { $in: categoryIds } },
          { subcategoryId: { $in: subcategoryIds } }
        ]
      };
      console.log('Manager available requirements query:', query);
    } else {
      // Default to user's own requirements
      query = { userId: user._id };
      console.log('Default user query:', query);
    }

    if (status) {
      query.status = status;
    }

    console.log('Final query:', query);
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    let requirements;
    if (user.role === 'manager' && view === 'available') {
      requirements = await Requirement.find(query)
        .populate('userId', 'name email phone')
        .populate('categoryId', 'name')
        .populate('subcategoryId', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit as string))
        .exec();
    } else {
      requirements = await Requirement.find(query)
        .populate('categoryId', 'name')
        .populate('subcategoryId', 'name')
        .populate({
          path: 'quotes',
          populate: { path: 'managerId', select: 'name email' }
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit as string))
        .exec();
    }

    console.log('Found requirements:', requirements.length);
    console.log('Sample requirements:', requirements.slice(0, 2).map(r => ({ 
      id: r._id, 
      userId: r.userId, 
      title: r.title || 'No title' 
    })));

    const total = await Requirement.countDocuments(query);

    res.json({
      success: true,
      data: requirements,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        pages: Math.ceil(total / parseInt(limit as string))
      }
    });

  } catch (error) {
    console.error('Get requirements error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch requirements'
    });
  }
});

// GET /api/requirements/:id - Get specific requirement
router.get('/:id', auth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user!;

    const requirement = await Requirement.findById(id)
      .populate('userId', 'name email phone')
      .populate('categoryId', 'name')
      .populate('subcategoryId', 'name')
      .populate({
        path: 'quotes',
        populate: { path: 'managerId', select: 'name email phone businessName' }
      })
      .exec();

    if (!requirement) {
      return res.status(404).json({
        success: false,
        message: 'Requirement not found'
      });
    }

    // Check permissions
    const isOwner = requirement.userId._id.toString() === user._id.toString();
    const isManager = user.role === 'manager';

    if (!isOwner && !isManager) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: requirement
    });

  } catch (error) {
    console.error('Get requirement error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch requirement'
    });
  }
});

// POST /api/requirements/:id/quotes - Manager creates a quote for a requirement
router.post('/:id/quotes', auth, requireRole('manager'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { price, notes, availability, serviceId, validUntil } = req.body;
    const managerId = req.user!._id;

    // Validate required fields
    if (!price || price <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid price is required'
      });
    }

    // Check if requirement exists
    const requirement = await Requirement.findById(id)
      .populate('userId', 'name email')
      .exec();

    if (!requirement) {
      return res.status(404).json({
        success: false,
        message: 'Requirement not found'
      });
    }

    if (requirement.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Requirement is not active'
      });
    }

    // Check if manager already has a quote for this requirement
    const existingQuote = await RequirementQuote.findOne({
      requirementId: id,
      managerId
    });

    if (existingQuote) {
      // Allow updating if quote is still pending and not in cart
      if (existingQuote.status === 'pending' && !existingQuote.inCart) {
        existingQuote.price = price;
        existingQuote.notes = notes;
        existingQuote.availability = availability;
        existingQuote.serviceId = serviceId;
        existingQuote.validUntil = validUntil;
        existingQuote.updatedAt = new Date();
        
        await existingQuote.save();

        // Send updated quote message
        if (existingQuote.chatId) {
          const updateMessage = new Message({
            chatId: (existingQuote.chatId as Types.ObjectId).toString(),
            senderId: managerId.toString(),
            content: `I've updated my quote to ₹${price}${notes ? `\n\nUpdated notes: ${notes}` : ''}`,
            type: 'text'
          });
          await updateMessage.save();
        }

        const populatedQuote = await RequirementQuote.findById(existingQuote._id)
          .populate('managerId', 'name email businessName')
          .populate('serviceId', 'title')
          .exec();

        return res.status(200).json({
          success: true,
          data: populatedQuote,
          chatId: existingQuote.chatId,
          message: 'Quote updated successfully'
        });
      } else {
        return res.status(400).json({
          success: false,
          message: existingQuote.inCart 
            ? 'Quote is already in customer\'s cart and cannot be modified'
            : 'Quote has been processed and cannot be modified'
        });
      }
    }

    // Create or find existing chat room between manager and user
    let chat = await Chat.findOne({
      userId: requirement.userId._id.toString(),
      managerId: managerId.toString()
    });

    if (!chat) {
      chat = new Chat({
        userId: requirement.userId._id.toString(),
        managerId: managerId.toString(),
        participants: [managerId.toString(), requirement.userId._id.toString()]
      });
      await chat.save();
    }

    // Create the quote
    const quote = new RequirementQuote({
      requirementId: id,
      managerId,
      serviceId,
      price,
      notes,
      availability,
      chatId: chat._id as Types.ObjectId,
      validUntil
    });

    await quote.save();

    // Add quote to requirement
    requirement.quotes.push(quote._id as Types.ObjectId);
    await requirement.save();

    // Send a message to the chat with the quote details
    const quoteMessage = new Message({
      chatId: (chat._id as Types.ObjectId).toString(),
      senderId: managerId.toString(),
      content: `I'd like to quote ₹${price} for your requirement${notes ? `\n\nNotes: ${notes}` : ''}`,
      type: 'text'
    });

    await quoteMessage.save();

    // Populate the response
    const populatedQuote = await RequirementQuote.findById(quote._id)
      .populate('managerId', 'name email businessName')
      .populate('serviceId', 'title')
      .exec();

    res.status(201).json({
      success: true,
      data: populatedQuote,
      chatId: chat._id,
      message: 'Quote submitted successfully'
    });

  } catch (error) {
    console.error('Create quote error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create quote'
    });
  }
});

// POST /api/requirements/:id/chat - Manager initiates chat for a requirement
router.post('/:id/chat', auth, requireRole('manager'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { message } = req.body;
    const managerId = req.user!._id;

    // Check if requirement exists
    const requirement = await Requirement.findById(id)
      .populate('userId', 'name email')
      .exec();

    if (!requirement) {
      return res.status(404).json({
        success: false,
        message: 'Requirement not found'
      });
    }

    if (requirement.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Requirement is not active'
      });
    }

    // Create or find existing chat room between manager and user
    let chat = await Chat.findOne({
      userId: requirement.userId._id.toString(),
      managerId: managerId.toString()
    });

    if (!chat) {
      chat = new Chat({
        userId: requirement.userId._id.toString(),
        managerId: managerId.toString(),
        participants: [managerId.toString(), requirement.userId._id.toString()],
        requirementId: id
      });
      await chat.save();
    }

    // Send initial message if provided
    if (message && message.trim()) {
      const chatMessage = new Message({
        chatId: (chat._id as Types.ObjectId).toString(),
        senderId: managerId.toString(),
        content: message.trim(),
        type: 'text'
      });
      await chatMessage.save();
    }

    res.status(200).json({
      success: true,
      data: {
        chatId: chat._id,
        requirementId: requirement._id,
        userId: requirement.userId._id,
        // managerName: req.user!.name
      },
      message: 'Chat initiated successfully'
    });

  } catch (error) {
    console.error('Initiate chat error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initiate chat'
    });
  }
});

// PUT /api/requirements/:id/quotes/:quoteId - Update quote status (accept/reject)
router.put('/:id/quotes/:quoteId', auth, async (req: AuthRequest, res: Response) => {
  try {
    const { id, quoteId } = req.params;
    const { status, message } = req.body;
    const userId = req.user!._id;

    // Validate status
    if (!['accepted', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be "accepted" or "rejected"'
      });
    }

    // Check if requirement belongs to user
    const requirement = await Requirement.findOne({
      _id: id,
      userId
    });

    if (!requirement) {
      return res.status(404).json({
        success: false,
        message: 'Requirement not found or access denied'
      });
    }

    // Find and update the quote
    const quote = await RequirementQuote.findById(quoteId)
      .populate('managerId', 'name email')
      .exec();

    if (!quote) {
      return res.status(404).json({
        success: false,
        message: 'Quote not found'
      });
    }

    quote.status = status;
    await quote.save();

    // Send message to chat
    if (quote.chatId) {
      const responseMessage = new Message({
        chatId: (quote.chatId as Types.ObjectId).toString(),
        senderId: userId.toString(),
        content: message || `Quote ${status}`,
        type: 'text'
      });
      await responseMessage.save();
    }

    // Create notification for manager
    const notification = new RequirementNotification({
      requirementId: requirement._id,
      managerId: quote.managerId._id,
      type: status === 'accepted' ? 'quote_accepted' : 'quote_rejected',
      title: `Quote ${status === 'accepted' ? 'Accepted' : 'Rejected'}`,
      message: `Your quote for "${requirement.title || 'requirement'}" has been ${status}`
    });
    await notification.save();

    res.json({
      success: true,
      data: quote,
      message: `Quote ${status} successfully`
    });

  } catch (error) {
    console.error('Update quote error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update quote'
    });
  }
});

// GET /api/requirements/notifications - Get manager's requirement notifications
router.get('/notifications/list', auth, requireRole('manager'), async (req: AuthRequest, res: Response) => {
  try {
    const { page = 1, limit = 20, unread = false } = req.query;
    const managerId = req.user!._id;

    let query: any = { managerId };

    if (unread === 'true') {
      query.isRead = false;
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const notifications = await RequirementNotification.find(query)
      .populate('requirementId', 'title description location.area')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit as string))
      .exec();

    const total = await RequirementNotification.countDocuments(query);

    res.json({
      success: true,
      data: notifications,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        pages: Math.ceil(total / parseInt(limit as string))
      }
    });

  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications'
    });
  }
});

// PUT /api/requirements/notifications/:id/read - Mark notification as read
router.put('/notifications/:id/read', auth, requireRole('manager'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const managerId = req.user!._id;

    const notification = await RequirementNotification.findOneAndUpdate(
      { _id: id, managerId },
      { isRead: true, readAt: new Date() },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.json({
      success: true,
      data: notification,
      message: 'Notification marked as read'
    });

  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read'
    });
  }
});

export default router;
