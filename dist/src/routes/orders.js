"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const Order_1 = require("../models/Order");
const Cart_1 = require("../models/Cart");
const auth_1 = require("../middleware/auth");
const zod_1 = require("zod");
const router = (0, express_1.Router)();
// Validation schemas
const checkoutSchema = zod_1.z.object({
    customerInfo: zod_1.z.object({
        firstName: zod_1.z.string(),
        lastName: zod_1.z.string(),
        email: zod_1.z.string().email(),
        phone: zod_1.z.string(),
    }),
    eventDetails: zod_1.z.object({
        sameForAllServices: zod_1.z.boolean(),
        baseDetails: zod_1.z.object({
            date: zod_1.z.string().optional(),
            time: zod_1.z.string().optional(),
            location: zod_1.z.string().optional(),
        }).optional(),
        perServiceDetails: zod_1.z.record(zod_1.z.object({
            date: zod_1.z.string().optional(),
            time: zod_1.z.string().optional(),
            location: zod_1.z.string().optional(),
            numberOfGuests: zod_1.z.number().optional(),
            specialRequirements: zod_1.z.string().optional(),
        })).optional(),
    }),
    servicesDetails: zod_1.z.array(zod_1.z.object({
        serviceId: zod_1.z.string(),
        title: zod_1.z.string(),
        tierLabel: zod_1.z.string().optional(),
        qty: zod_1.z.number(),
        unitPrice: zod_1.z.number(),
        eventDate: zod_1.z.string().optional(),
        eventTime: zod_1.z.string().optional(),
        eventLocation: zod_1.z.string().optional(),
        numberOfGuests: zod_1.z.number().optional(),
        specialRequirements: zod_1.z.string().optional(),
    })),
    differentAddressesForServices: zod_1.z.boolean(),
});
const verifyPaymentSchema = zod_1.z.object({
    orderId: zod_1.z.string(),
    razorpay_payment_id: zod_1.z.string(),
    razorpay_signature: zod_1.z.string(),
});
const updateStatusSchema = zod_1.z.object({
    status: zod_1.z.enum(['pending', 'accepted', 'in_progress', 'completed', 'cancelled', 'refunded']),
    note: zod_1.z.string().optional(),
});
// POST /api/v1/orders/checkout - Create order and Razorpay payment
router.post('/orders/checkout', auth_1.auth, async (req, res) => {
    try {
        const parsed = checkoutSchema.parse(req.body);
        // Get user's cart
        const cart = await Cart_1.CartModel.findOne({ userId: req.user._id })
            .populate('items.serviceId', 'title managerId');
        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ success: false, error: 'Cart is empty' });
        }
        // For simplicity, assume all items are from the same manager
        const managerId = cart.items[0].serviceId.managerId;
        // Create order with the new event details structure
        const eventInfo = parsed.eventDetails.sameForAllServices
            ? parsed.eventDetails.baseDetails
            : null;
        const order = new Order_1.OrderModel({
            userId: req.user._id,
            managerId,
            items: cart.items.map((item, index) => {
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
                    by: req.user._id,
                    action: 'order_created',
                    note: `Customer: ${parsed.customerInfo.firstName} ${parsed.customerInfo.lastName}, Email: ${parsed.customerInfo.email}, Phone: ${parsed.customerInfo.phone}`,
                }],
        });
        await order.save();
        // Clear cart
        await Cart_1.CartModel.deleteOne({ userId: req.user._id });
        res.json({
            success: true,
            data: {
                order,
                message: 'Order created successfully! You will be contacted by the service provider within 24 hours.',
            }
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ success: false, error: error.errors });
        }
        res.status(500).json({ success: false, error: 'Failed to create order' });
    }
});
// POST /api/v1/orders/verify - Verify Razorpay payment
router.post('/orders/verify', auth_1.auth, async (req, res) => {
    try {
        const parsed = verifyPaymentSchema.parse(req.body);
        // TODO: Verify Razorpay signature
        const order = await Order_1.OrderModel.findOne({
            'payment.orderId': parsed.orderId,
            userId: req.user._id
        });
        if (!order) {
            return res.status(404).json({ success: false, error: 'Order not found' });
        }
        order.payment.paymentId = parsed.razorpay_payment_id;
        order.payment.signature = parsed.razorpay_signature;
        order.payment.status = 'paid';
        order.timeline.push({
            at: new Date().toISOString(),
            by: req.user._id,
            action: 'payment_completed',
        });
        await order.save();
        res.json({ success: true, data: order });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ success: false, error: error.errors });
        }
        res.status(500).json({ success: false, error: 'Failed to verify payment' });
    }
});
// GET /api/v1/orders/my - Get user's orders
router.get('/orders/my', auth_1.auth, async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const orders = await Order_1.OrderModel.find({ userId: req.user._id })
            .populate('items.serviceId', 'title')
            .populate('managerId', 'name')
            .sort({ createdAt: -1 })
            .limit(Number(limit))
            .skip((Number(page) - 1) * Number(limit));
        res.json({ success: true, data: orders });
    }
    catch (error) {
        res.status(500).json({ success: false, error: 'Failed to fetch orders' });
    }
});
// GET /api/v1/manager/orders - Get manager's orders
router.get('/manager/orders', auth_1.auth, (0, auth_1.requireRole)('manager'), async (req, res) => {
    try {
        const { page = 1, limit = 10, status } = req.query;
        const filter = { managerId: req.user._id };
        if (status)
            filter.status = status;
        const orders = await Order_1.OrderModel.find(filter)
            .populate('userId', 'name')
            .populate('items.serviceId', 'title')
            .sort({ createdAt: -1 })
            .limit(Number(limit))
            .skip((Number(page) - 1) * Number(limit));
        res.json({ success: true, data: orders });
    }
    catch (error) {
        res.status(500).json({ success: false, error: 'Failed to fetch orders' });
    }
});
// PATCH /api/v1/orders/:id/status - Update order status (manager/admin)
router.patch('/orders/:id/status', auth_1.auth, (0, auth_1.requireRole)('manager'), async (req, res) => {
    try {
        const parsed = updateStatusSchema.parse(req.body);
        const order = await Order_1.OrderModel.findById(req.params.id);
        if (!order) {
            return res.status(404).json({ success: false, error: 'Order not found' });
        }
        // Check if user is manager of this order or admin
        if (req.user.role !== 'admin' && order.managerId.toString() !== req.user._id) {
            return res.status(403).json({ success: false, error: 'Not authorized' });
        }
        order.status = parsed.status;
        order.timeline.push({
            at: new Date().toISOString(),
            by: req.user._id,
            action: `status_changed_to_${parsed.status}`,
            note: parsed.note,
        });
        await order.save();
        res.json({ success: true, data: order });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ success: false, error: error.errors });
        }
        res.status(500).json({ success: false, error: 'Failed to update order status' });
    }
});
// GET /api/v1/orders/:id - Get order details
router.get('/orders/:id', auth_1.auth, async (req, res) => {
    try {
        const order = await Order_1.OrderModel.findById(req.params.id)
            .populate('userId', 'name')
            .populate('managerId', 'name')
            .populate('items.serviceId', 'title')
            .populate('timeline.by', 'name');
        if (!order) {
            return res.status(404).json({ success: false, error: 'Order not found' });
        }
        // Check if user can view this order
        const canView = req.user._id === order.userId.toString() ||
            req.user._id === order.managerId.toString() ||
            req.user.role === 'admin';
        if (!canView) {
            return res.status(403).json({ success: false, error: 'Not authorized' });
        }
        res.json({ success: true, data: order });
    }
    catch (error) {
        res.status(500).json({ success: false, error: 'Failed to fetch order' });
    }
});
exports.default = router;
