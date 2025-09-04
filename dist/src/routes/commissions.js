"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const mongoose_1 = require("mongoose");
const Commission_1 = require("../models/Commission");
const Service_1 = require("../models/Service");
const Order_1 = require("../models/Order");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// =====================================================
// MANAGER COMMISSION ROUTES
// =====================================================
// Manager: Create commission offer
const createCommissionSchema = zod_1.z.object({
    serviceId: zod_1.z.string().regex(/^[0-9a-fA-F]{24}$/).optional(), // Optional for global commission
    offeredPercentage: zod_1.z.number().min(0).max(100),
    validUntil: zod_1.z.string().datetime().optional(),
    minOrderValue: zod_1.z.number().min(0).optional(),
    maxOrderValue: zod_1.z.number().min(0).optional(),
    applicableCategories: zod_1.z.array(zod_1.z.string().regex(/^[0-9a-fA-F]{24}$/)).optional(),
    notes: zod_1.z.string().max(500).optional(),
});
router.post('/offers', auth_1.auth, auth_1.requireApprovedManager, async (req, res) => {
    try {
        const parsed = createCommissionSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ success: false, error: parsed.error.flatten() });
        }
        const { serviceId, offeredPercentage, validUntil, minOrderValue, maxOrderValue, applicableCategories, notes } = parsed.data;
        const managerId = req.user._id;
        // Check if service belongs to manager (if serviceId provided)
        if (serviceId) {
            const service = await Service_1.Service.findById(serviceId);
            if (!service || service.managerId.toString() !== managerId) {
                return res.status(403).json({ success: false, error: 'Service not found or access denied' });
            }
        }
        // Check if there's already an active offer for this service/manager
        const existingOffer = await Commission_1.Commission.findOne({
            managerId,
            serviceId: serviceId || { $exists: false },
            status: { $in: ['pending', 'accepted'] },
            isActive: true,
        });
        if (existingOffer) {
            return res.status(400).json({
                success: false,
                error: 'An active commission offer already exists for this service'
            });
        }
        const commission = new Commission_1.Commission({
            managerId,
            serviceId,
            offeredPercentage,
            validFrom: new Date(),
            validUntil: validUntil ? new Date(validUntil) : undefined,
            minOrderValue,
            maxOrderValue,
            applicableCategories,
            status: 'pending',
            type: 'manager_offer',
        });
        // Add to negotiation history
        commission.negotiationHistory.push({
            timestamp: new Date(),
            action: 'offer',
            percentage: offeredPercentage,
            notes,
            byUser: new mongoose_1.Types.ObjectId(req.user._id),
            byRole: 'manager',
        });
        await commission.save();
        const populatedCommission = await Commission_1.Commission.findById(commission._id)
            .populate('serviceId', 'title basePrice')
            .populate('managerId', 'name email businessName');
        return res.status(201).json({ success: true, data: populatedCommission });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});
// Manager: Get my commission offers
router.get('/my-offers', auth_1.auth, auth_1.requireApprovedManager, async (req, res) => {
    try {
        const { status, page = 1, limit = 20 } = req.query;
        const managerId = req.user._id;
        const filter = { managerId };
        if (status)
            filter.status = status;
        const offers = await Commission_1.Commission.find(filter)
            .populate('serviceId', 'title basePrice')
            .populate('adminRespondedBy', 'name email')
            .sort({ createdAt: -1 })
            .limit(Number(limit))
            .skip((Number(page) - 1) * Number(limit));
        const total = await Commission_1.Commission.countDocuments(filter);
        return res.json({
            success: true,
            data: { items: offers, total, page: Number(page), limit: Number(limit) }
        });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});
// Manager: Respond to admin counter offer
const respondToCounterSchema = zod_1.z.object({
    response: zod_1.z.enum(['accept', 'reject', 'counter']),
    counterPercentage: zod_1.z.number().min(0).max(100).optional(),
    notes: zod_1.z.string().max(500).optional(),
});
router.patch('/offers/:id/respond', auth_1.auth, auth_1.requireApprovedManager, async (req, res) => {
    try {
        const parsed = respondToCounterSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ success: false, error: parsed.error.flatten() });
        }
        const { response, counterPercentage, notes } = parsed.data;
        const managerId = req.user._id;
        const commission = await Commission_1.Commission.findById(req.params.id);
        if (!commission) {
            return res.status(404).json({ success: false, error: 'Commission offer not found' });
        }
        if (commission.managerId.toString() !== managerId) {
            return res.status(403).json({ success: false, error: 'Access denied' });
        }
        if (!commission.adminCounterPercentage) {
            return res.status(400).json({ success: false, error: 'No admin counter offer to respond to' });
        }
        commission.managerResponse = response;
        commission.managerNotes = notes;
        commission.managerRespondedAt = new Date();
        if (response === 'accept') {
            commission.status = 'accepted';
            commission.finalPercentage = commission.adminCounterPercentage;
            commission.agreedAt = new Date();
            commission.agreedBy = new mongoose_1.Types.ObjectId(req.user._id);
            commission.negotiationHistory.push({
                timestamp: new Date(),
                action: 'accept',
                percentage: commission.adminCounterPercentage,
                notes,
                byUser: new mongoose_1.Types.ObjectId(req.user._id),
                byRole: 'manager',
            });
        }
        else if (response === 'reject') {
            commission.status = 'rejected';
            commission.negotiationHistory.push({
                timestamp: new Date(),
                action: 'reject',
                notes,
                byUser: new mongoose_1.Types.ObjectId(req.user._id),
                byRole: 'manager',
            });
        }
        else if (response === 'counter' && counterPercentage !== undefined) {
            commission.offeredPercentage = counterPercentage; // Update with new counter
            commission.status = 'pending'; // Back to pending for admin review
            commission.negotiationHistory.push({
                timestamp: new Date(),
                action: 'counter',
                percentage: counterPercentage,
                notes,
                byUser: new mongoose_1.Types.ObjectId(req.user._id),
                byRole: 'manager',
            });
        }
        await commission.save();
        const populatedCommission = await Commission_1.Commission.findById(commission._id)
            .populate('serviceId', 'title basePrice')
            .populate('adminRespondedBy', 'name email');
        return res.json({ success: true, data: populatedCommission });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});
// Manager: Get commission earnings
router.get('/earnings', auth_1.auth, auth_1.requireApprovedManager, async (req, res) => {
    try {
        const { from, to, status, page = 1, limit = 20 } = req.query;
        const managerId = req.user._id;
        const matchStage = {
            managerId,
            'commission.status': { $exists: true }
        };
        if (status)
            matchStage['commission.status'] = status;
        if (from || to) {
            matchStage.createdAt = {};
            if (from)
                matchStage.createdAt.$gte = new Date(from);
            if (to)
                matchStage.createdAt.$lte = new Date(to);
        }
        const orders = await Order_1.OrderModel.find(matchStage)
            .populate('serviceId', 'title')
            .populate('userId', 'name email')
            .sort({ createdAt: -1 })
            .limit(Number(limit))
            .skip((Number(page) - 1) * Number(limit));
        const total = await Order_1.OrderModel.countDocuments(matchStage);
        // Calculate totals
        const totals = await Order_1.OrderModel.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: null,
                    totalOrders: { $sum: 1 },
                    totalOrderValue: { $sum: '$total' },
                    totalCommissionAmount: { $sum: '$commission.amount' },
                    pendingCommission: {
                        $sum: {
                            $cond: [
                                { $eq: ['$commission.status', 'pending'] },
                                '$commission.amount',
                                0
                            ]
                        }
                    },
                    paidCommission: {
                        $sum: {
                            $cond: [
                                { $eq: ['$commission.status', 'paid'] },
                                '$commission.amount',
                                0
                            ]
                        }
                    }
                }
            }
        ]);
        return res.json({
            success: true,
            data: {
                orders,
                pagination: { total, page: Number(page), limit: Number(limit) },
                summary: totals[0] || {
                    totalOrders: 0,
                    totalOrderValue: 0,
                    totalCommissionAmount: 0,
                    pendingCommission: 0,
                    paidCommission: 0
                }
            }
        });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});
// =====================================================
// ADMIN COMMISSION ROUTES
// =====================================================
// Admin: Get all commission offers
router.get('/admin/offers', auth_1.auth, (0, auth_1.requireRole)('admin'), async (req, res) => {
    try {
        const { status, managerId, serviceId, page = 1, limit = 20 } = req.query;
        const filter = {};
        if (status)
            filter.status = status;
        if (managerId)
            filter.managerId = managerId;
        if (serviceId)
            filter.serviceId = serviceId;
        const offers = await Commission_1.Commission.find(filter)
            .populate('managerId', 'name email businessName')
            .populate('serviceId', 'title basePrice')
            .populate('adminRespondedBy', 'name email')
            .sort({ createdAt: -1 })
            .limit(Number(limit))
            .skip((Number(page) - 1) * Number(limit));
        const total = await Commission_1.Commission.countDocuments(filter);
        return res.json({
            success: true,
            data: { items: offers, total, page: Number(page), limit: Number(limit) }
        });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});
// Admin: Counter offer or accept/reject
const adminResponseSchema = zod_1.z.object({
    action: zod_1.z.enum(['accept', 'reject', 'counter']),
    counterPercentage: zod_1.z.number().min(0).max(100).optional(),
    notes: zod_1.z.string().max(500).optional(),
    validUntil: zod_1.z.string().datetime().optional(),
});
router.patch('/admin/offers/:id/respond', auth_1.auth, (0, auth_1.requireRole)('admin'), async (req, res) => {
    try {
        const parsed = adminResponseSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ success: false, error: parsed.error.flatten() });
        }
        const { action, counterPercentage, notes, validUntil } = parsed.data;
        const commission = await Commission_1.Commission.findById(req.params.id);
        if (!commission) {
            return res.status(404).json({ success: false, error: 'Commission offer not found' });
        }
        commission.adminRespondedBy = new mongoose_1.Types.ObjectId(req.user._id);
        commission.adminRespondedAt = new Date();
        commission.adminNotes = notes;
        if (validUntil) {
            commission.validUntil = new Date(validUntil);
        }
        if (action === 'accept') {
            commission.status = 'accepted';
            commission.finalPercentage = commission.offeredPercentage;
            commission.agreedAt = new Date();
            commission.agreedBy = new mongoose_1.Types.ObjectId(req.user._id);
            commission.negotiationHistory.push({
                timestamp: new Date(),
                action: 'accept',
                percentage: commission.offeredPercentage,
                notes,
                byUser: new mongoose_1.Types.ObjectId(req.user._id),
                byRole: 'admin',
            });
        }
        else if (action === 'reject') {
            commission.status = 'rejected';
            commission.negotiationHistory.push({
                timestamp: new Date(),
                action: 'reject',
                notes,
                byUser: new mongoose_1.Types.ObjectId(req.user._id),
                byRole: 'admin',
            });
        }
        else if (action === 'counter' && counterPercentage !== undefined) {
            commission.adminCounterPercentage = counterPercentage;
            commission.type = 'admin_counter';
            commission.negotiationHistory.push({
                timestamp: new Date(),
                action: 'counter',
                percentage: counterPercentage,
                notes,
                byUser: new mongoose_1.Types.ObjectId(req.user._id),
                byRole: 'admin',
            });
        }
        await commission.save();
        const populatedCommission = await Commission_1.Commission.findById(commission._id)
            .populate('managerId', 'name email businessName')
            .populate('serviceId', 'title basePrice')
            .populate('adminRespondedBy', 'name email');
        return res.json({ success: true, data: populatedCommission });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});
// Admin: Get commission analytics
router.get('/admin/analytics', auth_1.auth, (0, auth_1.requireRole)('admin'), async (req, res) => {
    try {
        const { from, to } = req.query;
        const matchStage = {};
        if (from || to) {
            matchStage.createdAt = {};
            if (from)
                matchStage.createdAt.$gte = new Date(from);
            if (to)
                matchStage.createdAt.$lte = new Date(to);
        }
        // Commission offers statistics
        const offerStats = await Commission_1.Commission.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                    avgPercentage: { $avg: '$offeredPercentage' },
                    minPercentage: { $min: '$offeredPercentage' },
                    maxPercentage: { $max: '$offeredPercentage' }
                }
            }
        ]);
        // Commission earnings from completed orders
        const orderMatchStage = {
            'commission.status': { $exists: true }
        };
        if (from || to) {
            orderMatchStage.createdAt = matchStage.createdAt;
        }
        const earningsStats = await Order_1.OrderModel.aggregate([
            { $match: orderMatchStage },
            {
                $group: {
                    _id: null,
                    totalOrders: { $sum: 1 },
                    totalOrderValue: { $sum: '$total' },
                    totalCommissionAmount: { $sum: '$commission.amount' },
                    avgCommissionRate: { $avg: '$commission.percentage' },
                    pendingCommission: {
                        $sum: {
                            $cond: [
                                { $eq: ['$commission.status', 'pending'] },
                                '$commission.amount',
                                0
                            ]
                        }
                    },
                    paidCommission: {
                        $sum: {
                            $cond: [
                                { $eq: ['$commission.status', 'paid'] },
                                '$commission.amount',
                                0
                            ]
                        }
                    }
                }
            }
        ]);
        // Top earning managers
        const topManagers = await Order_1.OrderModel.aggregate([
            { $match: orderMatchStage },
            {
                $group: {
                    _id: '$managerId',
                    totalOrders: { $sum: 1 },
                    totalCommissionEarned: { $sum: '$commission.amount' },
                    avgCommissionRate: { $avg: '$commission.percentage' }
                }
            },
            { $sort: { totalCommissionEarned: -1 } },
            { $limit: 10 },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'manager'
                }
            },
            { $unwind: '$manager' },
            {
                $project: {
                    managerName: '$manager.name',
                    managerEmail: '$manager.email',
                    businessName: '$manager.businessName',
                    totalOrders: 1,
                    totalCommissionEarned: 1,
                    avgCommissionRate: 1
                }
            }
        ]);
        return res.json({
            success: true,
            data: {
                offers: offerStats,
                earnings: earningsStats[0] || {
                    totalOrders: 0,
                    totalOrderValue: 0,
                    totalCommissionAmount: 0,
                    avgCommissionRate: 0,
                    pendingCommission: 0,
                    paidCommission: 0
                },
                topManagers
            }
        });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});
// Admin: Mark commission as paid
router.patch('/admin/commissions/:orderId/pay', auth_1.auth, (0, auth_1.requireRole)('admin'), async (req, res) => {
    try {
        const { notes } = req.body;
        const order = await Order_1.OrderModel.findById(req.params.orderId);
        if (!order || !order.commission) {
            return res.status(404).json({ success: false, error: 'Order or commission not found' });
        }
        order.commission.status = 'paid';
        order.commission.paidAt = new Date();
        order.commission.paidBy = req.user._id;
        order.commission.notes = notes;
        await order.save();
        return res.json({ success: true, data: order.commission });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});
// Get commission details for a specific offer
router.get('/offers/:id', auth_1.auth, async (req, res) => {
    try {
        const commission = await Commission_1.Commission.findById(req.params.id)
            .populate('managerId', 'name email businessName')
            .populate('serviceId', 'title basePrice categoryId')
            .populate('adminRespondedBy', 'name email')
            .populate('agreedBy', 'name email')
            .populate('negotiationHistory.byUser', 'name email');
        if (!commission) {
            return res.status(404).json({ success: false, error: 'Commission offer not found' });
        }
        // Check access rights
        const isAdmin = req.user?.role === 'admin';
        const isOwner = commission.managerId._id.toString() === req.user?._id;
        if (!isAdmin && !isOwner) {
            return res.status(403).json({ success: false, error: 'Access denied' });
        }
        return res.json({ success: true, data: commission });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});
exports.default = router;
