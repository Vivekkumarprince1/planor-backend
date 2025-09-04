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
    maxCapacity: zod_1.z.number().positive().optional(),
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
    areaServed: zod_1.z.array(zod_1.z.string()).min(1, "At least one service area is required").optional(),
    features: zod_1.z.array(zod_1.z.string()).optional(),
    tags: zod_1.z.array(zod_1.z.string()).optional(),
    specifications: zod_1.z.record(zod_1.z.any()).optional(),
    location: zod_1.z.object({
        address: zod_1.z.string().min(1),
        city: zod_1.z.string().min(1),
        state: zod_1.z.string().min(1),
        pincode: zod_1.z.string().min(1),
        coordinates: zod_1.z.array(zod_1.z.number()).length(2).optional()
    }).optional().nullable().refine((val) => !val || (val.address && val.city && val.state && val.pincode), "All location fields are required when location is provided"),
    contactInfo: zod_1.z.object({
        phone: zod_1.z.string().min(1, "Phone number is required"),
        email: zod_1.z.string().email().optional().or(zod_1.z.literal("")).or(zod_1.z.literal(null)).nullable(),
        whatsapp: zod_1.z.string().optional().or(zod_1.z.literal("")).nullable()
    }).optional().nullable().refine((val) => !val || (val.phone && val.phone.trim().length > 0), "Phone number is required when contact info is provided"),
    businessHours: zod_1.z.record(zod_1.z.object({
        open: zod_1.z.string().optional().or(zod_1.z.literal("")),
        close: zod_1.z.string().optional().or(zod_1.z.literal("")),
        isOpen: zod_1.z.boolean()
    })).optional().nullable().refine((val) => {
        if (!val)
            return true; // null/undefined is okay
        // Check if any day has valid hours when marked as open
        const validHours = Object.values(val).every((day) => {
            if (!day.isOpen)
                return true; // closed days don't need hours
            return day.open && day.close; // open days need both open and close times
        });
        return validHours;
    }, "Open days must have both open and close times"),
    portfolio: zod_1.z.array(zod_1.z.object({
        title: zod_1.z.string(),
        description: zod_1.z.string(),
        images: zod_1.z.array(zod_1.z.string()).optional(),
        completedAt: zod_1.z.string().datetime().optional().or(zod_1.z.date().optional())
    })).optional().nullable(),
    media: zod_1.z.array(zod_1.z.object({
        type: zod_1.z.enum(['image', 'video']),
        url: zod_1.z.string().url(),
        publicId: zod_1.z.string().optional(),
        filename: zod_1.z.string().optional(),
        caption: zod_1.z.string().optional().or(zod_1.z.literal("")),
        description: zod_1.z.string().optional().or(zod_1.z.literal("")),
        isMain: zod_1.z.boolean().optional()
    })).optional(),
    mediaPackages: zod_1.z.array(zod_1.z.object({
        name: zod_1.z.string(),
        description: zod_1.z.string().optional(),
        mediaItems: zod_1.z.array(zod_1.z.string()).optional(),
        price: zod_1.z.number().positive(),
        isDefault: zod_1.z.boolean().optional()
    })).optional(),
    customFields: zod_1.z.array(zod_1.z.object({
        fieldName: zod_1.z.string(),
        fieldType: zod_1.z.enum(['text', 'number', 'boolean', 'select', 'multiselect']),
        fieldValue: zod_1.z.any(),
        isRequired: zod_1.z.boolean().optional()
    })).optional(),
    // Commission fields - REQUIRED
    commissionOffered: zod_1.z.number().min(0.1).max(100, "Commission percentage cannot exceed 100%").refine((val) => val >= 0.1 && val <= 100, "Commission percentage is required and must be between 0.1% and 100%"),
    commissionNotes: zod_1.z.string().max(500).optional(),
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
        // Create the service with required commission
        const service = new Service_1.Service({
            ...data,
            managerId: req.user._id,
            slug,
            status: 'pending', // Requires admin approval
            // Commission is now required
            commissionOffered: data.commissionOffered,
            commissionStatus: 'pending',
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
        console.log('=== SERVICE UPDATE DEBUG ===');
        console.log('Request body:', JSON.stringify(req.body, null, 2));
        const parsed = createServiceSchema.partial().safeParse(req.body);
        if (!parsed.success) {
            console.log('Validation failed:', JSON.stringify(parsed.error.flatten(), null, 2));
            return res.status(400).json({ success: false, error: parsed.error.flatten() });
        }
        const updates = parsed.data; // Use 'any' to allow commission fields
        // Clean up data before updating
        if (updates.addOns) {
            // Remove _id fields from addOns to avoid conflicts
            updates.addOns = updates.addOns.map(addOn => {
                const { _id, ...cleanAddOn } = addOn;
                return cleanAddOn;
            });
        }
        if (updates.priceTiers) {
            // Remove _id fields from priceTiers to avoid conflicts  
            updates.priceTiers = updates.priceTiers.map(tier => {
                const { _id, ...cleanTier } = tier;
                return cleanTier;
            });
        }
        if (updates.portfolio) {
            // Remove _id fields from portfolio to avoid conflicts
            updates.portfolio = updates.portfolio.map(item => {
                const { _id, ...cleanItem } = item;
                return cleanItem;
            });
        }
        if (updates.media) {
            // Remove _id fields from media to avoid conflicts
            updates.media = updates.media.map(mediaItem => {
                const { _id, ...cleanMediaItem } = mediaItem;
                return cleanMediaItem;
            });
        }
        if (updates.businessHours) {
            // Remove invalid _id field from businessHours
            const { _id, ...cleanBusinessHours } = updates.businessHours;
            updates.businessHours = cleanBusinessHours;
        }
        // If manager is updating, set status to pending for re-approval
        if (isOwner && !isAdmin) {
            // updates.status = 'pending';
        }
        // Handle commission updates
        if ('commissionOffered' in updates && updates.commissionOffered !== service.commissionOffered) {
            // Commission has been changed, update commission status
            updates.commissionStatus = 'pending';
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
        console.log('Cleaned updates data:', JSON.stringify(updates, null, 2));
        const updatedService = await Service_1.Service.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true }).populate('categoryId subcategoryId');
        console.log('Service updated successfully:', updatedService?._id);
        return res.json({ success: true, data: updatedService });
    }
    catch (error) {
        console.error('Service update error:', error);
        if (error instanceof Error) {
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);
        }
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
// Get subcategories where a specific manager has services
router.get('/manager/:managerId/subcategories', async (req, res) => {
    try {
        const { managerId } = req.params;
        const { categoryId } = req.query;
        if (!mongoose_1.default.Types.ObjectId.isValid(managerId)) {
            return res.status(400).json({ success: false, error: 'Invalid managerId format' });
        }
        const filter = {
            managerId: new mongoose_1.default.Types.ObjectId(managerId),
            isActive: true,
            status: 'approved'
        };
        if (categoryId && mongoose_1.default.Types.ObjectId.isValid(categoryId)) {
            filter.categoryId = new mongoose_1.default.Types.ObjectId(categoryId);
        }
        // Get distinct subcategory IDs where this manager has services
        const subcategoryIds = await Service_1.Service.distinct('subcategoryId', filter);
        // Filter out null/undefined values
        const validSubcategoryIds = subcategoryIds.filter(id => id != null);
        if (validSubcategoryIds.length === 0) {
            return res.json({ success: true, data: [] });
        }
        // Get the subcategory details
        const subcategories = await mongoose_1.default.model('Subcategory').find({
            _id: { $in: validSubcategoryIds },
            isActive: true
        }).populate('categoryId', 'name slug').sort({ name: 1 });
        return res.json({ success: true, data: subcategories });
    }
    catch (error) {
        console.error('Get manager subcategories error:', error);
        return res.status(500).json({ success: false, error: 'Failed to fetch manager subcategories' });
    }
});
// Get services by manager and category/subcategory
router.get('/manager/:managerId/services', async (req, res) => {
    try {
        const { managerId } = req.params;
        const { categoryId, subcategoryId, page = 1, limit = 12 } = req.query;
        if (!mongoose_1.default.Types.ObjectId.isValid(managerId)) {
            return res.status(400).json({ success: false, error: 'Invalid managerId format' });
        }
        const filter = {
            managerId: new mongoose_1.default.Types.ObjectId(managerId),
            isActive: true,
            status: 'approved'
        };
        if (categoryId && mongoose_1.default.Types.ObjectId.isValid(categoryId)) {
            filter.categoryId = new mongoose_1.default.Types.ObjectId(categoryId);
        }
        if (subcategoryId && mongoose_1.default.Types.ObjectId.isValid(subcategoryId)) {
            filter.subcategoryId = new mongoose_1.default.Types.ObjectId(subcategoryId);
        }
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;
        const [services, total] = await Promise.all([
            Service_1.Service.find(filter)
                .populate('categoryId', 'name slug')
                .populate('subcategoryId', 'name slug')
                .populate('managerId', 'name email phone businessName profileImage')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum)
                .lean(),
            Service_1.Service.countDocuments(filter)
        ]);
        return res.json({
            success: true,
            data: services,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum)
            }
        });
    }
    catch (error) {
        console.error('Get manager services error:', error);
        return res.status(500).json({ success: false, error: 'Failed to fetch manager services' });
    }
});
exports.default = router;
