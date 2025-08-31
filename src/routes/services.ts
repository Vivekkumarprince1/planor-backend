import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { Service } from '../models/Service';
import { Category, Subcategory } from '../models/Taxonomy';
import { auth, AuthPayload } from '../middleware/auth';

const router = Router();

interface AuthRequest extends Request {
  user?: AuthPayload;
}

const listQuery = z.object({
  category: z.string().optional(),
  subcategory: z.string().optional(),
  area: z.string().optional(),
  city: z.string().optional(),
  q: z.string().optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  minCapacity: z.coerce.number().optional(),
  maxCapacity: z.coerce.number().optional(),
  features: z.string().optional(), // comma-separated
  sort: z.enum(['rating', 'price', 'new', 'distance']).optional(),
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
  radius: z.coerce.number().optional(), // in km
  status: z.enum(['approved', 'pending', 'rejected']).optional(),
  limit: z.coerce.number().min(1).max(50).default(12),
  page: z.coerce.number().min(1).default(1),
});

// Get all services with advanced filtering
router.get('/', async (req: Request, res: Response) => {
  try {
    const parsed = listQuery.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.flatten() });
    }
    
    const { 
      category, subcategory, area, city, q, minPrice, maxPrice, 
      minCapacity, maxCapacity, features, sort, lat, lng, radius,
      status, limit, page 
    } = parsed.data;
    
    const filter: any = { 
      isActive: true, 
      status: status || 'approved' 
    };
    
    // Category and subcategory filters
    if (category) filter.categoryId = category;
    if (subcategory) filter.subcategoryId = subcategory;
    
    // Location filters
    if (area) filter.areaServed = { $in: [area] };
    if (city) filter['location.city'] = new RegExp(city, 'i');
    
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
    
    let query = Service.find(filter)
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
    if (sort === 'rating') query = query.sort({ ratingAverage: -1, ratingCount: -1 });
    else if (sort === 'price') query = query.sort({ basePrice: 1 });
    else if (sort === 'new') query = query.sort({ createdAt: -1 });
    else if (sort === 'distance' && lat && lng) {
      // Distance sorting is handled by $near
      query = query.sort({ createdAt: -1 });
    } else {
      query = query.sort({ ratingAverage: -1, createdAt: -1 });
    }
    
    const total = await Service.countDocuments(filter);
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
  } catch (error) {
    console.error('Services list error:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch services' });
  }
});

// Get single service with full details
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const service = await Service.findById(req.params.id)
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
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch service' });
  }
});

// Get services by manager (for manager dashboard)
router.get('/manager/services', auth, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || (req.user.role !== 'manager' && req.user.role !== 'admin')) {
      return res.status(403).json({ success: false, error: 'Manager or admin access required' });
    }
    
    const managerId = req.user.role === 'admin' ? req.query.managerId : req.user._id;
    const filter: any = managerId ? { managerId } : {};
    
    const services = await Service.find(filter)
      .populate('categoryId', 'name slug')
      .populate('subcategoryId', 'name slug')
      .sort({ createdAt: -1 })
      .lean();
    
    return res.json({ success: true, data: services });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch manager services' });
  }
});

// Schema for creating/updating services
const createServiceSchema = z.object({
  categoryId: z.string().min(1, "Category is required").regex(/^[0-9a-fA-F]{24}$/, "Invalid categoryId format"),
  subcategoryId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid subcategoryId format").optional().nullable().transform(val => val === null || val === "" ? undefined : val),
  title: z.string().min(1).max(200),
  shortDescription: z.string().max(200).optional(),
  description: z.string().min(1),
  basePrice: z.number().positive(),
  priceTiers: z.array(z.object({
    label: z.enum(['small', 'medium', 'large']),
    price: z.number().positive(),
    description: z.string().optional(),
    capacity: z.number().optional()
  })).optional(),
  addOns: z.array(z.object({
    name: z.string(),
    price: z.number().positive(),
    description: z.string().optional()
  })).optional(),
  areaServed: z.array(z.string()).optional(),
  maxCapacity: z.number().optional(),
  features: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  location: z.object({
    address: z.string(),
    city: z.string(),
    state: z.string(),
    pincode: z.string(),
    coordinates: z.array(z.number()).length(2).optional()
  }).optional(),
  contactInfo: z.object({
    phone: z.string(),
    email: z.string().email().optional(),
    whatsapp: z.string().optional()
  }).optional(),
  businessHours: z.record(z.object({
    open: z.string(),
    close: z.string(),
    isOpen: z.boolean()
  })).optional(),
});

// Create service (Manager only)
router.post('/', auth, async (req: AuthRequest, res: Response) => {
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
    const category = await Category.findById(data.categoryId);
    if (!category) {
      return res.status(400).json({ success: false, error: 'Category not found' });
    }
    
    // Verify subcategory if provided
    if (data.subcategoryId) {
      const subcategory = await Subcategory.findById(data.subcategoryId);
      if (!subcategory || subcategory.categoryId.toString() !== data.categoryId) {
        return res.status(400).json({ success: false, error: 'Invalid subcategory' });
      }
    }
    
    // Generate slug
    const slug = data.title.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') + '-' + Date.now();
    
    const service = new Service({
      ...data,
      managerId: req.user._id,
      slug,
      status: 'pending', // Requires admin approval
    });
    
    await service.save();
    
    return res.status(201).json({ success: true, data: service });
  } catch (error) {
    console.error('Create service error:', error);
    return res.status(500).json({ success: false, error: 'Failed to create service' });
  }
});

// Update service (Manager only - own services)
router.put('/:id', auth, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    
    const service = await Service.findById(req.params.id);
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
    
    const updatedService = await Service.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    ).populate('categoryId subcategoryId');
    
    return res.json({ success: true, data: updatedService });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to update service' });
  }
});

// Admin: Approve/Reject service
router.patch('/:id/status', auth, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }
    
    const { status, adminNotes } = req.body;
    
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }
    
    const service = await Service.findByIdAndUpdate(
      req.params.id,
      { status, adminNotes, isActive: status === 'approved' },
      { new: true }
    ).populate('managerId categoryId subcategoryId');
    
    if (!service) {
      return res.status(404).json({ success: false, error: 'Service not found' });
    }
    
    return res.json({ success: true, data: service });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to update service status' });
  }
});

// Delete service
router.delete('/:id', auth, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    
    const service = await Service.findById(req.params.id);
    if (!service) {
      return res.status(404).json({ success: false, error: 'Service not found' });
    }
    
    // Check permissions
    const isOwner = service.managerId.toString() === req.user._id;
    const isAdmin = req.user.role === 'admin';
    
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
    
    await Service.findByIdAndDelete(req.params.id);
    
    return res.json({ success: true, message: 'Service deleted successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to delete service' });
  }
});

export default router;
