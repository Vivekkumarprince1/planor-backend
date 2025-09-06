"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const mongoose_1 = __importDefault(require("mongoose"));
const Service_1 = require("../models/Service");
const Taxonomy_1 = require("../models/Taxonomy");
const Commission_1 = require("../models/Commission");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Get manager's services
router.get('/services', auth_1.auth, auth_1.requireApprovedManager, async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'manager') {
            return res.status(403).json({ success: false, error: 'Manager access required' });
        }
        const services = await Service_1.Service.find({ managerId: req.user._id })
            .populate('categoryId', 'name slug')
            .populate('subcategoryId', 'name slug')
            .sort({ createdAt: -1 })
            .lean();
        return res.json({ success: true, data: services });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to fetch services' });
    }
});
// Get service statistics for manager
router.get('/stats', auth_1.auth, auth_1.requireApprovedManager, async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'manager') {
            return res.status(403).json({ success: false, error: 'Manager access required' });
        }
        const managerId = req.user._id;
        // Get service counts by status
        const [pending, approved, rejected, draft, total] = await Promise.all([
            Service_1.Service.countDocuments({ managerId, status: 'pending' }),
            Service_1.Service.countDocuments({ managerId, status: 'approved' }),
            Service_1.Service.countDocuments({ managerId, status: 'rejected' }),
            Service_1.Service.countDocuments({ managerId, status: 'draft' }),
            Service_1.Service.countDocuments({ managerId })
        ]);
        // Get average rating
        const ratingAgg = await Service_1.Service.aggregate([
            { $match: { managerId: managerId } },
            { $group: {
                    _id: null,
                    avgRating: { $avg: '$ratingAverage' },
                    totalReviews: { $sum: '$reviewCount' }
                } }
        ]);
        const stats = {
            services: { pending, approved, rejected, draft, total },
            rating: ratingAgg[0] ? {
                average: Math.round(ratingAgg[0].avgRating * 10) / 10,
                totalReviews: ratingAgg[0].totalReviews
            } : { average: 0, totalReviews: 0 }
        };
        return res.json({ success: true, data: stats });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to fetch stats' });
    }
});
// Create service schema
const createServiceSchema = zod_1.z.object({
    categoryId: zod_1.z.string().min(1, "Category is required").regex(/^[0-9a-fA-F]{24}$/, "Invalid categoryId format"),
    subcategoryId: zod_1.z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid subcategoryId format").optional().nullable().transform(val => val === null || val === "" ? undefined : val),
    title: zod_1.z.string().min(1).max(200),
    shortDescription: zod_1.z.string().max(200).optional(),
    description: zod_1.z.string().min(1),
    basePrice: zod_1.z.number().positive(),
    priceTiers: zod_1.z.array(zod_1.z.object({
        label: zod_1.z.enum(['small', 'medium', 'large']),
        price: zod_1.z.number().positive(),
        description: zod_1.z.string().optional(),
        capacity: zod_1.z.number().optional()
    })).optional(),
    addOns: zod_1.z.array(zod_1.z.object({
        name: zod_1.z.string(),
        price: zod_1.z.number().positive(),
        description: zod_1.z.string().optional()
    })).optional(),
    areaServed: zod_1.z.array(zod_1.z.string()).min(1, "At least one service area is required"),
    maxCapacity: zod_1.z.number().optional(),
    features: zod_1.z.array(zod_1.z.string()).optional(),
    tags: zod_1.z.array(zod_1.z.string()).optional(),
    specifications: zod_1.z.record(zod_1.z.union([zod_1.z.string(), zod_1.z.number(), zod_1.z.boolean()])).optional(),
    customFields: zod_1.z.array(zod_1.z.object({
        fieldName: zod_1.z.string(),
        fieldType: zod_1.z.enum(['text', 'number', 'boolean', 'select', 'multiselect']),
        fieldValue: zod_1.z.any(),
        isRequired: zod_1.z.boolean().optional()
    })).optional(),
    mediaPackages: zod_1.z.array(zod_1.z.object({
        name: zod_1.z.string(),
        description: zod_1.z.string(),
        mediaItems: zod_1.z.array(zod_1.z.string()),
        price: zod_1.z.number().positive(),
        isDefault: zod_1.z.boolean().optional()
    })).optional(),
    location: zod_1.z.object({
        address: zod_1.z.string(),
        city: zod_1.z.string(),
        state: zod_1.z.string(),
        pincode: zod_1.z.string(),
        coordinates: zod_1.z.array(zod_1.z.number()).length(2).optional()
    }).optional(),
    contactInfo: zod_1.z.object({
        phone: zod_1.z.string(),
        email: zod_1.z.string().email().optional(),
        whatsapp: zod_1.z.string().optional()
    }).optional(),
    businessHours: zod_1.z.record(zod_1.z.object({
        open: zod_1.z.string(),
        close: zod_1.z.string(),
        isOpen: zod_1.z.boolean()
    })).optional(),
    portfolio: zod_1.z.array(zod_1.z.object({
        title: zod_1.z.string(),
        description: zod_1.z.string(),
        images: zod_1.z.array(zod_1.z.string()),
        completedAt: zod_1.z.string().datetime().optional()
    })).optional(),
    // Commission fields - REQUIRED
    commissionOffered: zod_1.z.number().min(0.1).max(100, "Commission percentage cannot exceed 100%").refine((val) => val >= 0.1 && val <= 100, "Commission percentage is required and must be between 0.1% and 100%"),
    commissionNotes: zod_1.z.string().max(500).optional(),
});
// Create service
router.post('/services', auth_1.auth, auth_1.requireApprovedManager, async (req, res) => {
    try {
        const parsed = createServiceSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ success: false, error: parsed.error.flatten() });
        }
        const data = parsed.data;
        // Verify category exists
        const category = await Taxonomy_1.Category.findById(data.categoryId);
        if (!category) {
            return res.status(400).json({ success: false, error: 'Category not found' });
        }
        // Verify subcategory if provided
        if (data.subcategoryId) {
            const subcategory = await Taxonomy_1.Subcategory.findById(data.subcategoryId);
            if (!subcategory || subcategory.categoryId.toString() !== data.categoryId) {
                return res.status(400).json({ success: false, error: 'Invalid subcategory' });
            }
        }
        // Generate slug
        const slug = data.title.toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '') + '-' + Date.now();
        // Create the service with required commission
        const service = new Service_1.Service({
            ...data,
            managerId: req.user._id,
            slug,
            status: 'pending', // Requires admin approval
            // Set commission fields (commission is now required)
            commissionOffered: data.commissionOffered,
            commissionStatus: 'pending', // Always pending since commission is required
            commissionNotes: data.commissionNotes,
        });
        await service.save();
        // Create Commission record for detailed tracking (always created since commission is required)
        const commission = new Commission_1.Commission({
            managerId: req.user._id,
            serviceId: service._id,
            offeredPercentage: data.commissionOffered,
            status: 'pending',
            type: 'manager_offer',
        });
        // Add initial negotiation entry
        commission.addNegotiationEntry('offer', new mongoose_1.default.Types.ObjectId(req.user._id), 'manager', data.commissionOffered, data.commissionNotes || `Initial commission offer of ${data.commissionOffered}%`);
        await commission.save();
        // Link the commission to the service
        service.commissionId = commission._id;
        await service.save();
        const populatedService = await Service_1.Service.findById(service._id)
            .populate('categoryId', 'name slug')
            .populate('subcategoryId', 'name slug');
        return res.status(201).json({ success: true, data: populatedService });
    }
    catch (error) {
        console.error('Create service error:', error);
        return res.status(500).json({ success: false, error: 'Failed to create service' });
    }
});
// Update service
router.put('/services/:id', auth_1.auth, auth_1.requireApprovedManager, async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'manager') {
            return res.status(403).json({ success: false, error: 'Manager access required' });
        }
        const service = await Service_1.Service.findById(req.params.id);
        if (!service) {
            return res.status(404).json({ success: false, error: 'Service not found' });
        }
        // Check ownership
        if (service.managerId.toString() !== req.user._id) {
            return res.status(403).json({ success: false, error: 'Access denied' });
        }
        const parsed = createServiceSchema.partial().safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ success: false, error: parsed.error.flatten() });
        }
        const updates = parsed.data;
        // If updating, set status to pending for re-approval (unless it's draft)
        if (service.status !== 'draft') {
            updates.status = 'pending';
        }
        // Handle commission updates
        if ('commissionOffered' in updates && updates.commissionOffered !== service.commissionOffered) {
            // Commission has been changed, update commission status
            updates.commissionStatus = updates.commissionOffered ? 'pending' : undefined;
            if (updates.commissionOffered) {
                // Create new commission or update existing one
                if (service.commissionId) {
                    // Update existing commission
                    const existingCommission = await Commission_1.Commission.findById(service.commissionId);
                    if (existingCommission) {
                        existingCommission.offeredPercentage = updates.commissionOffered;
                        existingCommission.status = 'pending';
                        existingCommission.type = 'manager_offer';
                        existingCommission.addNegotiationEntry('offer_updated', new mongoose_1.default.Types.ObjectId(req.user._id), 'manager', updates.commissionOffered, updates.commissionNotes || 'Commission offer updated');
                        await existingCommission.save();
                    }
                }
                else {
                    // Create new commission
                    const commission = new Commission_1.Commission({
                        managerId: req.user._id,
                        serviceId: service._id,
                        offeredPercentage: updates.commissionOffered,
                        status: 'pending',
                        type: 'manager_offer',
                    });
                    commission.addNegotiationEntry('offer', new mongoose_1.default.Types.ObjectId(req.user._id), 'manager', updates.commissionOffered, updates.commissionNotes);
                    await commission.save();
                    updates.commissionId = commission._id;
                }
            }
        }
        const updatedService = await Service_1.Service.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true }).populate('categoryId subcategoryId');
        return res.json({ success: true, data: updatedService });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to update service' });
    }
});
// Delete service
router.delete('/services/:id', auth_1.auth, auth_1.requireApprovedManager, async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'manager') {
            return res.status(403).json({ success: false, error: 'Manager access required' });
        }
        const service = await Service_1.Service.findById(req.params.id);
        if (!service) {
            return res.status(404).json({ success: false, error: 'Service not found' });
        }
        // Check ownership
        if (service.managerId.toString() !== req.user._id) {
            return res.status(403).json({ success: false, error: 'Access denied' });
        }
        await Service_1.Service.findByIdAndDelete(req.params.id);
        return res.json({ success: true, message: 'Service deleted successfully' });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to delete service' });
    }
});
// Get single service for editing
router.get('/services/:id', auth_1.auth, auth_1.requireApprovedManager, async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'manager') {
            return res.status(403).json({ success: false, error: 'Manager access required' });
        }
        const service = await Service_1.Service.findById(req.params.id)
            .populate('categoryId', 'name slug')
            .populate('subcategoryId', 'name slug')
            .lean();
        if (!service) {
            return res.status(404).json({ success: false, error: 'Service not found' });
        }
        // Check ownership
        if (service.managerId.toString() !== req.user._id) {
            return res.status(403).json({ success: false, error: 'Access denied' });
        }
        return res.json({ success: true, data: service });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to fetch service' });
    }
});
// =====================================================
// COMMISSION MANAGEMENT
// =====================================================
// Get manager's commissions
router.get('/commissions', auth_1.auth, auth_1.requireApprovedManager, async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'manager') {
            return res.status(403).json({ success: false, error: 'Manager access required' });
        }
        const { page = 1, limit = 20, status, serviceId } = req.query;
        const filter = { managerId: req.user._id };
        if (status)
            filter.status = status;
        if (serviceId)
            filter.serviceId = serviceId;
        const commissions = await Commission_1.Commission.find(filter)
            .populate('serviceId', 'title slug status')
            .populate('adminRespondedBy', 'name email')
            .sort({ createdAt: -1 })
            .limit(Number(limit))
            .skip((Number(page) - 1) * Number(limit))
            .lean();
        const total = await Commission_1.Commission.countDocuments(filter);
        return res.json({
            success: true,
            data: {
                items: commissions,
                total,
                page: Number(page),
                limit: Number(limit),
                totalPages: Math.ceil(total / Number(limit))
            }
        });
    }
    catch (error) {
        console.error('Get commissions error:', error);
        return res.status(500).json({ success: false, error: 'Failed to fetch commissions' });
    }
});
// Get commission summary for manager dashboard
router.get('/commissions/summary', auth_1.auth, auth_1.requireApprovedManager, async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'manager') {
            return res.status(403).json({ success: false, error: 'Manager access required' });
        }
        // Get commission counts by status
        const [pending, negotiating, accepted, rejected, total] = await Promise.all([
            Commission_1.Commission.countDocuments({ managerId: req.user._id, status: 'pending' }),
            Commission_1.Commission.countDocuments({ managerId: req.user._id, status: 'negotiating' }),
            Commission_1.Commission.countDocuments({ managerId: req.user._id, status: 'accepted' }),
            Commission_1.Commission.countDocuments({ managerId: req.user._id, status: 'rejected' }),
            Commission_1.Commission.countDocuments({ managerId: req.user._id })
        ]);
        // Get average commission percentage for accepted commissions
        const acceptedCommissions = await Commission_1.Commission.find({
            managerId: req.user._id,
            status: 'accepted'
        }).select('finalPercentage offeredPercentage').lean();
        const avgCommissionPercentage = acceptedCommissions.length > 0
            ? acceptedCommissions.reduce((sum, c) => sum + (c.finalPercentage || c.offeredPercentage), 0) / acceptedCommissions.length
            : 0;
        return res.json({
            success: true,
            data: {
                counts: {
                    pending,
                    negotiating,
                    accepted,
                    rejected,
                    total
                },
                averagePercentage: Math.round(avgCommissionPercentage * 100) / 100,
                recentActivity: [] // Can be expanded later
            }
        });
    }
    catch (error) {
        console.error('Get commission summary error:', error);
        return res.status(500).json({ success: false, error: 'Failed to fetch commission summary' });
    }
});
// Get single commission details
router.get('/commissions/:id', auth_1.auth, auth_1.requireApprovedManager, async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'manager') {
            return res.status(403).json({ success: false, error: 'Manager access required' });
        }
        const commission = await Commission_1.Commission.findById(req.params.id)
            .populate('serviceId', 'title slug status basePrice')
            .populate('adminRespondedBy', 'name email')
            .populate('negotiationHistory.byUser', 'name email role')
            .lean();
        if (!commission) {
            return res.status(404).json({ success: false, error: 'Commission not found' });
        }
        // Check ownership
        if (commission.managerId.toString() !== req.user._id) {
            return res.status(403).json({ success: false, error: 'Access denied' });
        }
        return res.json({ success: true, data: commission });
    }
    catch (error) {
        console.error('Get commission error:', error);
        return res.status(500).json({ success: false, error: 'Failed to fetch commission' });
    }
});
// Manager response to admin counter offer
router.patch('/commissions/:id/respond', auth_1.auth, auth_1.requireApprovedManager, async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'manager') {
            return res.status(403).json({ success: false, error: 'Manager access required' });
        }
        const { response, notes, counterPercentage } = zod_1.z.object({
            response: zod_1.z.enum(['accept', 'reject', 'counter']),
            notes: zod_1.z.string().max(500).optional(),
            counterPercentage: zod_1.z.number().min(0).max(100).optional()
        }).parse(req.body);
        const commission = await Commission_1.Commission.findById(req.params.id);
        if (!commission) {
            return res.status(404).json({ success: false, error: 'Commission not found' });
        }
        // Check ownership
        if (commission.managerId.toString() !== req.user._id) {
            return res.status(403).json({ success: false, error: 'Access denied' });
        }
        // Validate that commission is in negotiating state with admin counter offer
        if (commission.status !== 'negotiating' || !commission.adminCounterPercentage) {
            return res.status(400).json({
                success: false,
                error: 'No admin counter offer to respond to or commission not in negotiating state'
            });
        }
        // Validate counter offer requirements
        if (response === 'counter') {
            if (!counterPercentage || counterPercentage <= 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Counter percentage is required and must be greater than 0'
                });
            }
        }
        commission.managerResponse = response;
        commission.managerNotes = notes;
        commission.managerRespondedAt = new Date();
        if (response === 'accept') {
            commission.status = 'accepted';
            commission.finalPercentage = commission.adminCounterPercentage;
            commission.agreedAt = new Date();
            commission.agreedBy = new mongoose_1.default.Types.ObjectId(req.user._id);
            // Update service commission details
            if (commission.serviceId) {
                await Service_1.Service.findByIdAndUpdate(commission.serviceId, {
                    commissionStatus: 'agreed',
                    finalCommissionPercentage: commission.adminCounterPercentage,
                    commissionId: commission._id
                });
            }
            commission.addNegotiationEntry('manager_accept_counter', new mongoose_1.default.Types.ObjectId(req.user._id), 'manager', commission.adminCounterPercentage, notes);
        }
        else if (response === 'reject') {
            commission.status = 'rejected';
            // Update service commission status
            if (commission.serviceId) {
                await Service_1.Service.findByIdAndUpdate(commission.serviceId, {
                    commissionStatus: 'rejected',
                    commissionId: commission._id
                });
            }
            commission.addNegotiationEntry('manager_reject_counter', new mongoose_1.default.Types.ObjectId(req.user._id), 'manager', undefined, notes);
        }
        else if (response === 'counter') {
            commission.offeredPercentage = counterPercentage;
            commission.status = 'pending';
            commission.type = 'manager_offer';
            // Reset admin fields for new negotiation
            commission.adminCounterPercentage = undefined;
            commission.adminNotes = undefined;
            commission.adminRespondedBy = undefined;
            commission.adminRespondedAt = undefined;
            // Update service to show new offer pending
            if (commission.serviceId) {
                await Service_1.Service.findByIdAndUpdate(commission.serviceId, {
                    commissionStatus: 'pending',
                    commissionOffered: counterPercentage,
                    commissionId: commission._id
                });
            }
            commission.addNegotiationEntry('manager_counter', new mongoose_1.default.Types.ObjectId(req.user._id), 'manager', counterPercentage, notes);
        }
        await commission.save();
        const populatedCommission = await Commission_1.Commission.findById(commission._id)
            .populate('serviceId', 'title slug')
            .populate('adminRespondedBy', 'name email');
        return res.json({ success: true, data: populatedCommission });
    }
    catch (error) {
        console.error('Commission response error:', error);
        return res.status(500).json({ success: false, error: 'Failed to respond to commission' });
    }
});
exports.default = router;
