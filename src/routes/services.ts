import { Router, Request, Response } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { Service } from '../models/Service';
import { Category, Subcategory } from '../models/Taxonomy';
import { Commission } from '../models/Commission';
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
  maxCapacity: z.number().positive().optional(),
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
  areaServed: z.array(z.string()).min(1, "At least one service area is required").optional(),
  features: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  specifications: z.record(z.any()).optional(),
  location: z.object({
    address: z.string().min(1),
    city: z.string().min(1),
    state: z.string().min(1),
    pincode: z.string().min(1),
    coordinates: z.array(z.number()).length(2).optional()
  }).optional().nullable().refine(
    (val) => !val || (val.address && val.city && val.state && val.pincode), 
    "All location fields are required when location is provided"
  ),
  contactInfo: z.object({
    phone: z.string().min(1, "Phone number is required"),
    email: z.string().email().optional().or(z.literal("")).or(z.literal(null)).nullable(),
    whatsapp: z.string().optional().or(z.literal("")).nullable()
  }).optional().nullable().refine(
    (val) => !val || (val.phone && val.phone.trim().length > 0), 
    "Phone number is required when contact info is provided"
  ),
  businessHours: z.record(z.object({
    open: z.string().optional().or(z.literal("")),
    close: z.string().optional().or(z.literal("")),
    isOpen: z.boolean()
  })).optional().nullable().refine(
    (val) => {
      if (!val) return true; // null/undefined is okay
      // Check if any day has valid hours when marked as open
      const validHours = Object.values(val).every((day: any) => {
        if (!day.isOpen) return true; // closed days don't need hours
        return day.open && day.close; // open days need both open and close times
      });
      return validHours;
    },
    "Open days must have both open and close times"
  ),
  portfolio: z.array(z.object({
    title: z.string(),
    description: z.string(),
    images: z.array(z.string()).optional(),
    completedAt: z.string().datetime().optional().or(z.date().optional())
  })).optional().nullable(),
  media: z.array(z.object({
    type: z.enum(['image', 'video']),
    url: z.string().url(),
    publicId: z.string().optional(),
    filename: z.string().optional(),
    caption: z.string().optional().or(z.literal("")),
    description: z.string().optional().or(z.literal("")),
    isMain: z.boolean().optional()
  })).optional(),
  mediaPackages: z.array(z.object({
    name: z.string(),
    description: z.string().optional(),
    mediaItems: z.array(z.string()).optional(),
    price: z.number().positive(),
    isDefault: z.boolean().optional()
  })).optional(),
  customFields: z.array(z.object({
    fieldName: z.string(),
    fieldType: z.enum(['text', 'number', 'boolean', 'select', 'multiselect']),
    fieldValue: z.any(),
    isRequired: z.boolean().optional()
  })).optional(),
  // Commission fields - REQUIRED
  commissionOffered: z.number().min(0.1).max(100, "Commission percentage cannot exceed 100%").refine(
    (val) => val >= 0.1 && val <= 100,
    "Commission percentage is required and must be between 0.1% and 100%"
  ),
  commissionNotes: z.string().max(500).optional(),
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
    
    // Create the service with required commission
    const service = new Service({
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
    const commission = new Commission({
      managerId: req.user._id,
      serviceId: service._id,
      offeredPercentage: data.commissionOffered,
      status: 'pending',
      type: 'manager_offer',
    });
    
    // Add initial negotiation entry
    commission.addNegotiationEntry(
      'offer',
      new mongoose.Types.ObjectId(req.user._id),
      'manager',
      data.commissionOffered,
      data.commissionNotes || `Initial commission offer of ${data.commissionOffered}%`
    );
    
    await commission.save();
    
    // Link the commission to the service
    service.commissionId = commission._id as mongoose.Types.ObjectId;
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
    
    console.log('=== SERVICE UPDATE DEBUG ===');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    
    const parsed = createServiceSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      console.log('Validation failed:', JSON.stringify(parsed.error.flatten(), null, 2));
      return res.status(400).json({ success: false, error: parsed.error.flatten() });
    }
    
    const updates = parsed.data as any; // Use 'any' to allow commission fields
    
    // Clean up data before updating
    if (updates.addOns) {
      // Remove _id fields from addOns to avoid conflicts
      updates.addOns = updates.addOns.map(addOn => {
        const { _id, ...cleanAddOn } = addOn as any;
        return cleanAddOn;
      });
    }
    
    if (updates.priceTiers) {
      // Remove _id fields from priceTiers to avoid conflicts  
      updates.priceTiers = updates.priceTiers.map(tier => {
        const { _id, ...cleanTier } = tier as any;
        return cleanTier;
      });
    }
    
    if (updates.portfolio) {
      // Remove _id fields from portfolio to avoid conflicts
      updates.portfolio = updates.portfolio.map(item => {
        const { _id, ...cleanItem } = item as any;
        return cleanItem;
      });
    }
    
    if (updates.media) {
      // Remove _id fields from media to avoid conflicts
      updates.media = updates.media.map(mediaItem => {
        const { _id, ...cleanMediaItem } = mediaItem as any;
        return cleanMediaItem;
      });
    }
    
    if (updates.businessHours) {
      // Remove invalid _id field from businessHours
      const { _id, ...cleanBusinessHours } = updates.businessHours as any;
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
          const existingCommission = await Commission.findById(service.commissionId);
          if (existingCommission) {
            existingCommission.offeredPercentage = updates.commissionOffered;
            existingCommission.status = 'pending';
            existingCommission.type = 'manager_offer';
            existingCommission.addNegotiationEntry(
              'offer_updated',
              new mongoose.Types.ObjectId(req.user._id),
              'manager',
              updates.commissionOffered,
              updates.commissionNotes || 'Commission offer updated'
            );
            await existingCommission.save();
          }
        } else {
          // Create new commission
          const commission = new Commission({
            managerId: req.user._id,
            serviceId: service._id,
            offeredPercentage: updates.commissionOffered,
            status: 'pending',
            type: 'manager_offer',
          });
          
          commission.addNegotiationEntry(
            'offer',
            new mongoose.Types.ObjectId(req.user._id),
            'manager',
            updates.commissionOffered,
            updates.commissionNotes
          );
          
          await commission.save();
          updates.commissionId = commission._id as mongoose.Types.ObjectId;
        }
      }
    }
    
    console.log('Cleaned updates data:', JSON.stringify(updates, null, 2));
    
    const updatedService = await Service.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    ).populate('categoryId subcategoryId');
    
    console.log('Service updated successfully:', updatedService?._id);
    
    return res.json({ success: true, data: updatedService });
  } catch (error) {
    console.error('Service update error:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
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

// Get subcategories where a specific manager has services
router.get('/manager/:managerId/subcategories', async (req: Request, res: Response) => {
  try {
    const { managerId } = req.params;
    const { categoryId } = req.query;

    if (!mongoose.Types.ObjectId.isValid(managerId)) {
      return res.status(400).json({ success: false, error: 'Invalid managerId format' });
    }

    const filter: any = { 
      managerId: new mongoose.Types.ObjectId(managerId),
      isActive: true, 
      status: 'approved' 
    };

    if (categoryId && mongoose.Types.ObjectId.isValid(categoryId as string)) {
      filter.categoryId = new mongoose.Types.ObjectId(categoryId as string);
    }

    // Get distinct subcategory IDs where this manager has services
    const subcategoryIds = await Service.distinct('subcategoryId', filter);
    
    // Filter out null/undefined values
    const validSubcategoryIds = subcategoryIds.filter(id => id != null);

    if (validSubcategoryIds.length === 0) {
      return res.json({ success: true, data: [] });
    }

    // Get the subcategory details
    const subcategories = await mongoose.model('Subcategory').find({
      _id: { $in: validSubcategoryIds },
      isActive: true
    }).populate('categoryId', 'name slug').sort({ name: 1 });

    return res.json({ success: true, data: subcategories });
  } catch (error) {
    console.error('Get manager subcategories error:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch manager subcategories' });
  }
});

// Get services by manager and category/subcategory
router.get('/manager/:managerId/services', async (req: Request, res: Response) => {
  try {
    const { managerId } = req.params;
    const { categoryId, subcategoryId, page = 1, limit = 12 } = req.query;

    if (!mongoose.Types.ObjectId.isValid(managerId)) {
      return res.status(400).json({ success: false, error: 'Invalid managerId format' });
    }

    const filter: any = { 
      managerId: new mongoose.Types.ObjectId(managerId),
      isActive: true, 
      status: 'approved' 
    };

    if (categoryId && mongoose.Types.ObjectId.isValid(categoryId as string)) {
      filter.categoryId = new mongoose.Types.ObjectId(categoryId as string);
    }

    if (subcategoryId && mongoose.Types.ObjectId.isValid(subcategoryId as string)) {
      filter.subcategoryId = new mongoose.Types.ObjectId(subcategoryId as string);
    }

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const [services, total] = await Promise.all([
      Service.find(filter)
        .populate('categoryId', 'name slug')
        .populate('subcategoryId', 'name slug')
        .populate('managerId', 'name email phone businessName profileImage')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Service.countDocuments(filter)
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
  } catch (error) {
    console.error('Get manager services error:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch manager services' });
  }
});

export default router;
