"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const Cart_1 = require("../models/Cart");
const auth_1 = require("../middleware/auth");
const zod_1 = require("zod");
const router = (0, express_1.Router)();
// Validation schemas
const addItemSchema = zod_1.z.object({
    serviceId: zod_1.z.string(),
    tierLabel: zod_1.z.enum(['small', 'medium', 'large']).optional(),
    qty: zod_1.z.number().min(1),
    dateTime: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional(),
    addOnIds: zod_1.z.array(zod_1.z.string()).optional(),
    priceAtAdd: zod_1.z.number(),
});
const updateItemSchema = zod_1.z.object({
    qty: zod_1.z.number().min(1).optional(),
    dateTime: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional(),
});
// GET /api/v1/cart - Get user's cart
router.get('/', auth_1.auth, async (req, res) => {
    try {
        const cart = await Cart_1.CartModel.findOne({ userId: req.user._id })
            .populate('items.serviceId', 'title basePrice priceTiers');
        if (!cart) {
            return res.json({ success: true, data: null });
        }
        res.json({ success: true, data: cart });
    }
    catch (error) {
        res.status(500).json({ success: false, error: 'Failed to fetch cart' });
    }
});
// POST /api/v1/cart/items - Add item to cart
router.post('/items', auth_1.auth, async (req, res) => {
    try {
        const parsed = addItemSchema.parse(req.body);
        let cart = await Cart_1.CartModel.findOne({ userId: req.user._id });
        if (!cart) {
            cart = new Cart_1.CartModel({
                userId: req.user._id,
                items: [],
                subtotal: 0,
                total: 0
            });
        }
        cart.items.push(parsed);
        // Recalculate totals
        cart.subtotal = cart.items.reduce((sum, item) => sum + (item.priceAtAdd * item.qty), 0);
        cart.total = cart.subtotal; // Add fees/taxes later
        await cart.save();
        res.json({ success: true, data: cart });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ success: false, error: error.errors });
        }
        res.status(500).json({ success: false, error: 'Failed to add item to cart' });
    }
});
// PATCH /api/v1/cart/items/:itemId - Update cart item
router.patch('/items/:itemId', auth_1.auth, async (req, res) => {
    try {
        const parsed = updateItemSchema.parse(req.body);
        const cart = await Cart_1.CartModel.findOne({ userId: req.user._id });
        if (!cart) {
            return res.status(404).json({ success: false, error: 'Cart not found' });
        }
        const itemIndex = cart.items.findIndex((item) => item._id.toString() === req.params.itemId);
        if (itemIndex === -1) {
            return res.status(404).json({ success: false, error: 'Item not found' });
        }
        Object.assign(cart.items[itemIndex], parsed);
        // Recalculate totals
        cart.subtotal = cart.items.reduce((sum, item) => sum + (item.priceAtAdd * item.qty), 0);
        cart.total = cart.subtotal;
        await cart.save();
        res.json({ success: true, data: cart });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ success: false, error: error.errors });
        }
        res.status(500).json({ success: false, error: 'Failed to update cart item' });
    }
});
// DELETE /api/v1/cart/items/:itemId - Remove item from cart
router.delete('/items/:itemId', auth_1.auth, async (req, res) => {
    try {
        const cart = await Cart_1.CartModel.findOne({ userId: req.user._id });
        if (!cart) {
            return res.status(404).json({ success: false, error: 'Cart not found' });
        }
        cart.items = cart.items.filter((item) => item._id.toString() !== req.params.itemId);
        // Recalculate totals
        cart.subtotal = cart.items.reduce((sum, item) => sum + (item.priceAtAdd * item.qty), 0);
        cart.total = cart.subtotal;
        await cart.save();
        res.json({ success: true, data: cart });
    }
    catch (error) {
        res.status(500).json({ success: false, error: 'Failed to remove cart item' });
    }
});
exports.default = router;
