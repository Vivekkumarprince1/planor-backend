import { Router } from 'express';
import { OrderModel } from '../models/Order';
import { CartModel } from '../models/Cart';
import { auth, requireRole, requireActiveUser } from '../middleware/auth';
import { z } from 'zod';

interface AuthRequest extends Request {
  user?: {
    _id: string;
    role: 'user' | 'manager' | 'admin';
  };
}

const router = Router();

// Validation schemas
const checkoutSchema = z.object({
  customerInfo: z.object({
    firstName: z.string(),
    lastName: z.string(),
    email: z.string().email(),
    phone: z.string(),
  }),
  eventDetails: z.object({
    sameForAllServices: z.boolean(),
    baseDetails: z.object({
      date: z.string().optional(),
      time: z.string().optional(),
      location: z.string().optional(),
    }).optional(),
    perServiceDetails: z.record(z.object({
      date: z.string().optional(),
      time: z.string().optional(),
      location: z.string().optional(),
      numberOfGuests: z.number().optional(),
      specialRequirements: z.string().optional(),
    })).optional(),
  }),
  servicesDetails: z.array(z.object({
    serviceId: z.string(),
    title: z.string(),
    tierLabel: z.string().optional(),
    qty: z.number(),
    unitPrice: z.number(),
    eventDate: z.string().optional(),
    eventTime: z.string().optional(),
    eventLocation: z.string().optional(),
    numberOfGuests: z.number().optional(),
    specialRequirements: z.string().optional(),
  })),
  differentAddressesForServices: z.boolean(),
});

const verifyPaymentSchema = z.object({
  orderId: z.string(),
  razorpay_payment_id: z.string(),
  razorpay_signature: z.string(),
});

const updateStatusSchema = z.object({
  status: z.enum(['pending', 'accepted', 'in_progress', 'completed', 'cancelled', 'refunded']),
  note: z.string().optional(),
});

// POST /api/v1/orders/checkout - Create order and Razorpay payment
router.post('/orders/checkout', auth, async (req: any, res) => {
  try {
    const parsed = checkoutSchema.parse(req.body);
    
    // Get user's cart
    const cart = await CartModel.findOne({ userId: req.user!._id })
      .populate('items.serviceId', 'title managerId');
    
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ success: false, error: 'Cart is empty' });
    }
    
    // For simplicity, assume all items are from the same manager
    const managerId = (cart.items[0].serviceId as any).managerId;
    
    // Create order with the new event details structure
    const eventInfo = parsed.eventDetails.sameForAllServices 
      ? parsed.eventDetails.baseDetails 
      : null;
    
    const order = new OrderModel({
      userId: req.user!._id,
      managerId,
      items: cart.items.map((item: any, index: number) => {
        const serviceDetails = parsed.servicesDetails[index];
        return {
          serviceId: item.serviceId._id,
          tierLabel: item.tierLabel,
          qty: item.qty,
          unitPrice: item.priceAtAdd,
          notes: serviceDetails?.specialRequirements || item.notes,
        };
      }),
      subtotal: cart.subtotal,
      fee: 0,
      tax: 0,
      total: cart.total,
      // Store event details in addressSnapshot for now (can create new field later)
      addressSnapshot: {
        label: 'Event Details',
        line1: eventInfo?.location || 'Multiple locations',
        city: parsed.customerInfo.firstName + ' ' + parsed.customerInfo.lastName,
        state: parsed.customerInfo.email,
        pincode: parsed.customerInfo.phone,
      },
      scheduledAt: eventInfo?.date && eventInfo?.time 
        ? `${eventInfo.date}T${eventInfo.time}:00.000Z` 
        : undefined,
      payment: {
        provider: 'razorpay',
        orderId: `order_${Date.now()}`, // Replace with actual Razorpay order
        status: 'created',
      },
      timeline: [{
        at: new Date().toISOString(),
        by: req.user!._id,
        action: 'order_created',
        note: `Customer: ${parsed.customerInfo.firstName} ${parsed.customerInfo.lastName}, Email: ${parsed.customerInfo.email}, Phone: ${parsed.customerInfo.phone}`,
      }],
    });
    
    await order.save();
    
    // Clear cart
    await CartModel.deleteOne({ userId: req.user!._id });
    
    res.json({ 
      success: true, 
      data: { 
        order,
        message: 'Order created successfully! You will be contacted by the service provider within 24 hours.',
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.errors });
    }
    res.status(500).json({ success: false, error: 'Failed to create order' });
  }
});

// POST /api/v1/orders/verify - Verify Razorpay payment
router.post('/orders/verify', auth, async (req: any, res) => {
  try {
    const parsed = verifyPaymentSchema.parse(req.body);
    
    // TODO: Verify Razorpay signature
    
    const order = await OrderModel.findOne({ 
      'payment.orderId': parsed.orderId,
      userId: req.user!._id 
    });
    
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }
    
    order.payment.paymentId = parsed.razorpay_payment_id;
    order.payment.signature = parsed.razorpay_signature;
    order.payment.status = 'paid';
    order.timeline.push({
      at: new Date().toISOString(),
      by: req.user!._id,
      action: 'payment_completed',
    });
    
    await order.save();
    
    res.json({ success: true, data: order });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.errors });
    }
    res.status(500).json({ success: false, error: 'Failed to verify payment' });
  }
});

// GET /api/v1/orders/my - Get user's orders
router.get('/orders/my', auth, async (req: any, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    
    const orders = await OrderModel.find({ userId: req.user!._id })
      .populate('items.serviceId', 'title')
      .populate('managerId', 'name')
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));
    
    res.json({ success: true, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch orders' });
  }
});

// GET /api/v1/manager/orders - Get manager's orders
router.get('/manager/orders', auth, requireRole('manager'), async (req: any, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    
    const filter: any = { managerId: req.user!._id };
    if (status) filter.status = status;
    
    const orders = await OrderModel.find(filter)
      .populate('userId', 'name')
      .populate('items.serviceId', 'title')
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));
    
    res.json({ success: true, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch orders' });
  }
});

// PATCH /api/v1/orders/:id/status - Update order status (manager/admin)
router.patch('/orders/:id/status', auth, requireRole('manager'), async (req: any, res) => {
  try {
    const parsed = updateStatusSchema.parse(req.body);
    
    const order = await OrderModel.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }
    
    // Check if user is manager of this order or admin
    if (req.user!.role !== 'admin' && order.managerId.toString() !== req.user!._id) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }
    
    order.status = parsed.status;
    order.timeline.push({
      at: new Date().toISOString(),
      by: req.user!._id,
      action: `status_changed_to_${parsed.status}`,
      note: parsed.note,
    });
    
    await order.save();
    
    res.json({ success: true, data: order });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.errors });
    }
    res.status(500).json({ success: false, error: 'Failed to update order status' });
  }
});

// GET /api/v1/orders/:id - Get order details
router.get('/orders/:id', auth, async (req: any, res) => {
  try {
    const order = await OrderModel.findById(req.params.id)
      .populate('userId', 'name')
      .populate('managerId', 'name')
      .populate('items.serviceId', 'title')
      .populate('timeline.by', 'name');
    
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }
    
    // Check if user can view this order
    const canView = req.user!._id === order.userId.toString() || 
                   req.user!._id === order.managerId.toString() || 
                   req.user!.role === 'admin';
    
    if (!canView) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }
    
    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch order' });
  }
});

export default router;
