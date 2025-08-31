"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const Requirement_1 = require("../models/Requirement");
const Service_1 = require("../models/Service");
const User_1 = require("../models/User");
const Chat_1 = require("../models/Chat");
const mongoose_1 = require("mongoose");
const router = express_1.default.Router();
// POST /api/requirements - Create a new requirement
router.post('/', auth_1.auth, async (req, res) => {
    try {
        const { title, description, categoryId, subcategoryId, media, location, attendeesCapacity, budget, timeframe } = req.body;
        // Validate required fields
        if (!categoryId || !location?.area) {
            return res.status(400).json({
                success: false,
                message: 'Category and location area are required'
            });
        }
        // Create the requirement
        const requirement = new Requirement_1.Requirement({
            userId: req.user._id,
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
        const managers = await User_1.User.find({
            role: 'manager',
            isActive: true,
            'location.area': location.area
        });
        // Get services matching the requirement
        const serviceQuery = {
            categoryId,
            status: 'approved',
            isActive: true
        };
        if (subcategoryId) {
            serviceQuery.subcategoryId = subcategoryId;
        }
        const matchingServices = await Service_1.Service.find(serviceQuery)
            .populate('managerId', '_id name')
            .exec();
        // Get unique manager IDs from matching services
        const serviceManagerIds = matchingServices
            .map(service => service.managerId._id.toString())
            .filter((value, index, self) => self.indexOf(value) === index);
        // Combine managers from location and services
        const allManagerIds = [
            ...managers.map(m => m._id.toString()),
            ...serviceManagerIds
        ].filter((value, index, self) => self.indexOf(value) === index);
        // Create notifications for relevant managers
        const notifications = await Promise.all(allManagerIds.map(async (managerId) => {
            const notification = new Requirement_1.RequirementNotification({
                requirementId: requirement._id,
                managerId: new mongoose_1.Types.ObjectId(managerId),
                type: 'new_requirement',
                title: 'New Requirement Available',
                message: `A new ${title || 'service requirement'} is available in ${location.area}${attendeesCapacity ? ` for ${attendeesCapacity} people` : ''}`
            });
            await notification.save();
            return notification;
        }));
        // Update requirement with notification references
        requirement.notifications = notifications.map(n => n._id);
        await requirement.save();
        // Populate the response
        const populatedRequirement = await Requirement_1.Requirement.findById(requirement._id)
            .populate('categoryId', 'name')
            .populate('subcategoryId', 'name')
            .populate('userId', 'name email')
            .exec();
        res.status(201).json({
            success: true,
            data: populatedRequirement,
            message: `Requirement created successfully. ${notifications.length} managers notified.`
        });
    }
    catch (error) {
        console.error('Create requirement error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create requirement'
        });
    }
});
// GET /api/requirements - Get user's requirements or manager's relevant requirements
router.get('/', auth_1.auth, async (req, res) => {
    try {
        const { status, page = 1, limit = 10 } = req.query;
        const user = req.user;
        let query = {};
        if (user.role === 'manager') {
            // For managers, get requirements they can quote on
            const managerServices = await Service_1.Service.find({
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
        }
        else {
            // For users, get their own requirements
            query = { userId: user._id };
        }
        if (status) {
            query.status = status;
        }
        const skip = (parseInt(page) - 1) * parseInt(limit);
        let requirements;
        if (user.role === 'manager') {
            requirements = await Requirement_1.Requirement.find(query)
                .populate('userId', 'name email phone')
                .populate('categoryId', 'name')
                .populate('subcategoryId', 'name')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .exec();
        }
        else {
            requirements = await Requirement_1.Requirement.find(query)
                .populate('categoryId', 'name')
                .populate('subcategoryId', 'name')
                .populate({
                path: 'quotes',
                populate: { path: 'managerId', select: 'name email' }
            })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .exec();
        }
        const total = await Requirement_1.Requirement.countDocuments(query);
        res.json({
            success: true,
            data: requirements,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    }
    catch (error) {
        console.error('Get requirements error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch requirements'
        });
    }
});
// GET /api/requirements/:id - Get specific requirement
router.get('/:id', auth_1.auth, async (req, res) => {
    try {
        const { id } = req.params;
        const user = req.user;
        const requirement = await Requirement_1.Requirement.findById(id)
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
    }
    catch (error) {
        console.error('Get requirement error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch requirement'
        });
    }
});
// POST /api/requirements/:id/quotes - Manager creates a quote for a requirement
router.post('/:id/quotes', auth_1.auth, (0, auth_1.requireRole)('manager'), async (req, res) => {
    try {
        const { id } = req.params;
        const { price, notes, availability, serviceId, validUntil } = req.body;
        const managerId = req.user._id;
        // Validate required fields
        if (!price || price <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Valid price is required'
            });
        }
        // Check if requirement exists
        const requirement = await Requirement_1.Requirement.findById(id)
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
        const existingQuote = await Requirement_1.RequirementQuote.findOne({
            requirementId: id,
            managerId
        });
        if (existingQuote) {
            return res.status(400).json({
                success: false,
                message: 'You have already submitted a quote for this requirement'
            });
        }
        // Create or find existing chat room between manager and user
        let chat = await Chat_1.ChatModel.findOne({
            userId: requirement.userId._id.toString(),
            managerId: managerId.toString()
        });
        if (!chat) {
            chat = new Chat_1.ChatModel({
                userId: requirement.userId._id.toString(),
                managerId: managerId.toString(),
                participants: [managerId.toString(), requirement.userId._id.toString()]
            });
            await chat.save();
        }
        // Create the quote
        const quote = new Requirement_1.RequirementQuote({
            requirementId: id,
            managerId,
            serviceId,
            price,
            notes,
            availability,
            chatId: chat._id,
            validUntil
        });
        await quote.save();
        // Add quote to requirement
        requirement.quotes.push(quote._id);
        await requirement.save();
        // Send a message to the chat with the quote details
        const quoteMessage = new Chat_1.MessageModel({
            chatId: chat._id.toString(),
            senderId: managerId.toString(),
            content: `I'd like to quote ₹${price} for your requirement${notes ? `\n\nNotes: ${notes}` : ''}`,
            type: 'text'
        });
        await quoteMessage.save();
        // Populate the response
        const populatedQuote = await Requirement_1.RequirementQuote.findById(quote._id)
            .populate('managerId', 'name email businessName')
            .populate('serviceId', 'title')
            .exec();
        res.status(201).json({
            success: true,
            data: populatedQuote,
            chatId: chat._id,
            message: 'Quote submitted successfully'
        });
    }
    catch (error) {
        console.error('Create quote error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create quote'
        });
    }
});
// PUT /api/requirements/:id/quotes/:quoteId - Update quote status (accept/reject)
router.put('/:id/quotes/:quoteId', auth_1.auth, async (req, res) => {
    try {
        const { id, quoteId } = req.params;
        const { status, message } = req.body;
        const userId = req.user._id;
        // Validate status
        if (!['accepted', 'rejected'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status. Must be "accepted" or "rejected"'
            });
        }
        // Check if requirement belongs to user
        const requirement = await Requirement_1.Requirement.findOne({
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
        const quote = await Requirement_1.RequirementQuote.findById(quoteId)
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
            const responseMessage = new Chat_1.MessageModel({
                chatId: quote.chatId.toString(),
                senderId: userId.toString(),
                content: message || `Quote ${status}`,
                type: 'text'
            });
            await responseMessage.save();
        }
        // Create notification for manager
        const notification = new Requirement_1.RequirementNotification({
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
    }
    catch (error) {
        console.error('Update quote error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update quote'
        });
    }
});
// GET /api/requirements/notifications - Get manager's requirement notifications
router.get('/notifications/list', auth_1.auth, (0, auth_1.requireRole)('manager'), async (req, res) => {
    try {
        const { page = 1, limit = 20, unread = false } = req.query;
        const managerId = req.user._id;
        let query = { managerId };
        if (unread === 'true') {
            query.isRead = false;
        }
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const notifications = await Requirement_1.RequirementNotification.find(query)
            .populate('requirementId', 'title description location.area')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .exec();
        const total = await Requirement_1.RequirementNotification.countDocuments(query);
        res.json({
            success: true,
            data: notifications,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    }
    catch (error) {
        console.error('Get notifications error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch notifications'
        });
    }
});
// PUT /api/requirements/notifications/:id/read - Mark notification as read
router.put('/notifications/:id/read', auth_1.auth, (0, auth_1.requireRole)('manager'), async (req, res) => {
    try {
        const { id } = req.params;
        const managerId = req.user._id;
        const notification = await Requirement_1.RequirementNotification.findOneAndUpdate({ _id: id, managerId }, { isRead: true, readAt: new Date() }, { new: true });
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
    }
    catch (error) {
        console.error('Mark notification read error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to mark notification as read'
        });
    }
});
exports.default = router;
