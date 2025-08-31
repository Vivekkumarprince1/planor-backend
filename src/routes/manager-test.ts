import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { Service } from '../models/Service';
import { Category, Subcategory } from '../models/Taxonomy';
import { auth, requireApprovedManager, AuthPayload } from '../middleware/auth';

const router = Router();

interface AuthRequest extends Request {
  user?: AuthPayload;
}

// Get manager's services
router.get('/services', auth, requireApprovedManager, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'manager') {
      return res.status(403).json({ success: false, error: 'Manager access required' });
    }
    
    const services = await Service.find({ managerId: req.user._id })
      .populate('categoryId', 'name slug')
      .populate('subcategoryId', 'name slug')
      .sort({ createdAt: -1 })
      .lean();
    
    return res.json({ success: true, data: services });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch services' });
  }
});

// Get service statistics for manager
router.get('/stats', auth, requireApprovedManager, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'manager') {
      return res.status(403).json({ success: false, error: 'Manager access required' });
    }
    
    const managerId = req.user._id;
    
    // Get service counts by status
    const [pending, approved, rejected, draft, total] = await Promise.all([
      Service.countDocuments({ managerId, status: 'pending' }),
      Service.countDocuments({ managerId, status: 'approved' }),
      Service.countDocuments({ managerId, status: 'rejected' }),
      Service.countDocuments({ managerId, status: 'draft' }),
      Service.countDocuments({ managerId })
    ]);
    
    // Get average rating
    const ratingAgg = await Service.aggregate([
      { $match: { managerId: managerId } },
      { $group: { 
        _id: null, 
        avgRating: { $avg: '$ratingAverage' },
        totalReviews: { $sum: '$reviewCount' }
      }}
    ]);
    
    const stats = {
      services: { pending, approved, rejected, draft, total },
      rating: ratingAgg[0] ? {
        average: Math.round(ratingAgg[0].avgRating * 10) / 10,
        totalReviews: ratingAgg[0].totalReviews
      } : { average: 0, totalReviews: 0 }
    };
    
    return res.json({ success: true, data: stats });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch stats' });
  }
});

// Create service schema
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
  specifications: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
  customFields: z.array(z.object({
    fieldName: z.string(),
    fieldType: z.enum(['text', 'number', 'boolean', 'select', 'multiselect']),
    fieldValue: z.any(),
    isRequired: z.boolean().optional()
  })).optional(),
  mediaPackages: z.array(z.object({
    name: z.string(),
    description: z.string(),
    mediaItems: z.array(z.string()),
    price: z.number().positive(),
    isDefault: z.boolean().optional()
  })).optional(),
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
  portfolio: z.array(z.object({
    title: z.string(),
    description: z.string(),
    images: z.array(z.string()),
    completedAt: z.string().datetime().optional()
  })).optional(),
});

// Create service
router.post('/services', auth, requireApprovedManager, async (req: AuthRequest, res: Response) => {
  try {
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
      managerId: req.user!._id,
      slug,
      status: 'pending', // Requires admin approval
    });
    
    await service.save();
    
    const populatedService = await Service.findById(service._id)
      .populate('categoryId', 'name slug')
      .populate('subcategoryId', 'name slug');
    
    return res.status(201).json({ success: true, data: populatedService });
  } catch (error) {
    console.error('Create service error:', error);
    return res.status(500).json({ success: false, error: 'Failed to create service' });
  }
});

// Update service
router.put('/services/:id', auth, requireApprovedManager, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'manager') {
      return res.status(403).json({ success: false, error: 'Manager access required' });
    }
    
    const service = await Service.findById(req.params.id);
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
    
    const updates: any = parsed.data;
    
    // If updating, set status to pending for re-approval (unless it's draft)
    if (service.status !== 'draft') {
      updates.status = 'pending';
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

// Delete service
router.delete('/services/:id', auth, requireApprovedManager, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'manager') {
      return res.status(403).json({ success: false, error: 'Manager access required' });
    }
    
    const service = await Service.findById(req.params.id);
    if (!service) {
      return res.status(404).json({ success: false, error: 'Service not found' });
    }
    
    // Check ownership
    if (service.managerId.toString() !== req.user._id) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
    
    await Service.findByIdAndDelete(req.params.id);
    
    return res.json({ success: true, message: 'Service deleted successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to delete service' });
  }
});

// Get single service for editing
router.get('/services/:id', auth, requireApprovedManager, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'manager') {
      return res.status(403).json({ success: false, error: 'Manager access required' });
    }
    
    const service = await Service.findById(req.params.id)
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
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch service' });
  }
});

export default router;
