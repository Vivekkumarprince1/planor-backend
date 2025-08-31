"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const Service_1 = require("../models/Service");
const Taxonomy_1 = require("../models/Taxonomy");
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
    areaServed: zod_1.z.array(zod_1.z.string()).optional(),
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
        const service = new Service_1.Service({
            ...data,
            managerId: req.user._id,
            slug,
            status: 'pending', // Requires admin approval
        });
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
exports.default = router;
