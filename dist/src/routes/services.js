"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const Service_1 = require("../models/Service");
const Taxonomy_1 = require("../models/Taxonomy");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const listQuery = zod_1.z.object({
    category: zod_1.z.string().optional(),
    subcategory: zod_1.z.string().optional(),
    area: zod_1.z.string().optional(),
    city: zod_1.z.string().optional(),
    q: zod_1.z.string().optional(),
    minPrice: zod_1.z.coerce.number().optional(),
    maxPrice: zod_1.z.coerce.number().optional(),
    minCapacity: zod_1.z.coerce.number().optional(),
    maxCapacity: zod_1.z.coerce.number().optional(),
    features: zod_1.z.string().optional(), // comma-separated
    sort: zod_1.z.enum(['rating', 'price', 'new', 'distance']).optional(),
    lat: zod_1.z.coerce.number().optional(),
    lng: zod_1.z.coerce.number().optional(),
    radius: zod_1.z.coerce.number().optional(), // in km
    status: zod_1.z.enum(['approved', 'pending', 'rejected']).optional(),
    limit: zod_1.z.coerce.number().min(1).max(50).default(12),
    page: zod_1.z.coerce.number().min(1).default(1),
});
// Get all services with advanced filtering
router.get('/', async (req, res) => {
    try {
        const parsed = listQuery.safeParse(req.query);
        if (!parsed.success) {
            return res.status(400).json({ success: false, error: parsed.error.flatten() });
        }
        const { category, subcategory, area, city, q, minPrice, maxPrice, minCapacity, maxCapacity, features, sort, lat, lng, radius, status, limit, page } = parsed.data;
        const filter = {
            isActive: true,
            status: status || 'approved'
        };
        // Category and subcategory filters
        if (category)
            filter.categoryId = category;
        if (subcategory)
            filter.subcategoryId = subcategory;
        // Location filters
        if (area)
            filter.areaServed = { $in: [area] };
        if (city)
            filter['location.city'] = new RegExp(city, 'i');
        // Price filters
        if (minPrice || maxPrice) {
            filter.basePrice = {
                ...(minPrice ? { $gte: minPrice } : {}),
                ...(maxPrice ? { $lte: maxPrice } : {})
            };
        }
        // Capacity filters
        if (minCapacity || maxCapacity) {
            filter.maxCapacity = {
                ...(minCapacity ? { $gte: minCapacity } : {}),
                ...(maxCapacity ? { $lte: maxCapacity } : {})
            };
        }
        // Features filter
        if (features) {
            const featureList = features.split(',').map(f => f.trim());
            filter.features = { $in: featureList };
        }
        let query = Service_1.Service.find(filter)
            .populate('categoryId', 'name slug')
            .populate('subcategoryId', 'name slug')
            .populate('managerId', 'name email phone');
        // Text search
        if (q) {
            query = query.find({ $text: { $search: q } });
        }
        // Location-based search
        if (lat && lng && radius) {
            filter['location.coordinates'] = {
                $near: {
                    $geometry: { type: 'Point', coordinates: [lng, lat] },
                    $maxDistance: radius * 1000 // convert km to meters
                }
            };
        }
        // Sorting
        if (sort === 'rating')
            query = query.sort({ ratingAverage: -1, ratingCount: -1 });
        else if (sort === 'price')
            query = query.sort({ basePrice: 1 });
        else if (sort === 'new')
            query = query.sort({ createdAt: -1 });
        else if (sort === 'distance' && lat && lng) {
            // Distance sorting is handled by $near
            query = query.sort({ createdAt: -1 });
        }
        else {
            query = query.sort({ ratingAverage: -1, createdAt: -1 });
        }
        const total = await Service_1.Service.countDocuments(filter);
        const items = await query
            .limit(limit)
            .skip((page - 1) * limit)
            .lean();
        return res.json({
            success: true,
            data: {
                items,
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });
    }
    catch (error) {
        console.error('Services list error:', error);
        return res.status(500).json({ success: false, error: 'Failed to fetch services' });
    }
});
// Get single service with full details
router.get('/:id', async (req, res) => {
    try {
        const service = await Service_1.Service.findById(req.params.id)
            .populate('categoryId', 'name slug description')
            .populate('subcategoryId', 'name slug description')
            .populate('managerId', 'name email phone profileImage businessName')
            .lean();
        if (!service) {
            return res.status(404).json({ success: false, error: 'Service not found' });
        }
        // Only return approved services to public (unless it's the manager or admin)
        if (service.status !== 'approved') {
            return res.status(404).json({ success: false, error: 'Service not found' });
        }
        return res.json({ success: true, data: service });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to fetch service' });
    }
});
// Get services by manager (for manager dashboard)
router.get('/manager/services', auth_1.auth, async (req, res) => {
    try {
        if (!req.user || (req.user.role !== 'manager' && req.user.role !== 'admin')) {
            return res.status(403).json({ success: false, error: 'Manager or admin access required' });
        }
        const managerId = req.user.role === 'admin' ? req.query.managerId : req.user._id;
        const filter = managerId ? { managerId } : {};
        const services = await Service_1.Service.find(filter)
            .populate('categoryId', 'name slug')
            .populate('subcategoryId', 'name slug')
            .sort({ createdAt: -1 })
            .lean();
        return res.json({ success: true, data: services });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to fetch manager services' });
    }
});
// Schema for creating/updating services
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
});
// Create service (Manager only)
router.post('/', auth_1.auth, async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'manager') {
            return res.status(403).json({ success: false, error: 'Manager access required' });
        }
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
        return res.status(201).json({ success: true, data: service });
    }
    catch (error) {
        console.error('Create service error:', error);
        return res.status(500).json({ success: false, error: 'Failed to create service' });
    }
});
// Update service (Manager only - own services)
router.put('/:id', auth_1.auth, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Authentication required' });
        }
        const service = await Service_1.Service.findById(req.params.id);
        if (!service) {
            return res.status(404).json({ success: false, error: 'Service not found' });
        }
        // Check permissions
        const isOwner = service.managerId.toString() === req.user._id;
        const isAdmin = req.user.role === 'admin';
        if (!isOwner && !isAdmin) {
            return res.status(403).json({ success: false, error: 'Access denied' });
        }
        const parsed = createServiceSchema.partial().safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ success: false, error: parsed.error.flatten() });
        }
        const updates = parsed.data;
        // If manager is updating, set status to pending for re-approval
        if (isOwner && !isAdmin) {
            // updates.status = 'pending';
        }
        const updatedService = await Service_1.Service.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true }).populate('categoryId subcategoryId');
        return res.json({ success: true, data: updatedService });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to update service' });
    }
});
// Admin: Approve/Reject service
router.patch('/:id/status', auth_1.auth, async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'admin') {
            return res.status(403).json({ success: false, error: 'Admin access required' });
        }
        const { status, adminNotes } = req.body;
        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ success: false, error: 'Invalid status' });
        }
        const service = await Service_1.Service.findByIdAndUpdate(req.params.id, { status, adminNotes, isActive: status === 'approved' }, { new: true }).populate('managerId categoryId subcategoryId');
        if (!service) {
            return res.status(404).json({ success: false, error: 'Service not found' });
        }
        return res.json({ success: true, data: service });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to update service status' });
    }
});
// Delete service
router.delete('/:id', auth_1.auth, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Authentication required' });
        }
        const service = await Service_1.Service.findById(req.params.id);
        if (!service) {
            return res.status(404).json({ success: false, error: 'Service not found' });
        }
        // Check permissions
        const isOwner = service.managerId.toString() === req.user._id;
        const isAdmin = req.user.role === 'admin';
        if (!isOwner && !isAdmin) {
            return res.status(403).json({ success: false, error: 'Access denied' });
        }
        await Service_1.Service.findByIdAndDelete(req.params.id);
        return res.json({ success: true, message: 'Service deleted successfully' });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to delete service' });
    }
});
exports.default = router;
