import { Router } from 'express';
import { CartModel } from '../models/Cart';
import { RequirementQuote } from '../models/Requirement';
import { auth } from '../middleware/auth';
import { z } from 'zod';
import mongoose from 'mongoose';

interface AuthRequest extends Request {
  user?: {
    _id: string;
    role: 'user' | 'manager' | 'admin';
  };
}

const router = Router();

// Validation schemas
const addItemSchema = z.object({
  serviceId: z.string(),
  tierLabel: z.enum(['small', 'medium', 'large']).optional(),
  qty: z.number().min(1),
  dateTime: z.string().optional(),
  notes: z.string().optional(),
  addOnIds: z.array(z.string()).optional(),
  priceAtAdd: z.number(),
  // New fields for requirement quotes
  requirementId: z.string().optional(),
  quoteId: z.string().optional(),
  managerId: z.string().optional(),
  isCustomQuote: z.boolean().optional(),
});

const updateItemSchema = z.object({
  qty: z.number().min(1).optional(),
  dateTime: z.string().optional(),
  notes: z.string().optional(),
});

// GET /api/v1/cart - Get user's cart
router.get('/', auth, async (req: any, res) => {
  try {
    const cart = await CartModel.findOne({ userId: new mongoose.Types.ObjectId(req.user!._id) })
      .populate('items.serviceId', 'title basePrice priceTiers media shortDescription');
    
    if (!cart) {
      return res.json({ success: true, data: null });
    }
    
    res.json({ success: true, data: cart });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch cart' });
  }
});

// POST /api/v1/cart/items - Add item to cart
router.post('/items', auth, async (req: any, res) => {
  try {
    const parsed = addItemSchema.parse(req.body);
    
    let cart = await CartModel.findOne({ userId: new mongoose.Types.ObjectId(req.user!._id) });
    
    if (!cart) {
      cart = new CartModel({ 
        userId: new mongoose.Types.ObjectId(req.user!._id), 
        items: [], 
        subtotal: 0, 
        total: 0 
      });
    }

    // If this is a requirement quote, mark it as in cart
    if (parsed.quoteId) {
      const quote = await RequirementQuote.findById(parsed.quoteId);
      if (quote) {
        quote.inCart = true;
        await quote.save();
      }
    }
    
    // Convert serviceId string to ObjectId
    const cartItem = {
      ...parsed,
      serviceId: new mongoose.Types.ObjectId(parsed.serviceId)
    };
    
    cart.items.push(cartItem);
    
    // Recalculate totals
    cart.subtotal = cart.items.reduce((sum, item) => sum + (item.priceAtAdd * item.qty), 0);
    cart.total = cart.subtotal; // Add fees/taxes later
    
    await cart.save();
    
    res.json({ success: true, data: cart });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.errors });
    }
    res.status(500).json({ success: false, error: 'Failed to add item to cart' });
  }
});

// PATCH /api/v1/cart/items/:itemId - Update cart item
router.patch('/items/:itemId', auth, async (req: any, res) => {
  try {
    const parsed = updateItemSchema.parse(req.body);
    
    const cart = await CartModel.findOne({ userId: new mongoose.Types.ObjectId(req.user!._id) });
    if (!cart) {
      return res.status(404).json({ success: false, error: 'Cart not found' });
    }
    
    const itemIndex = cart.items.findIndex((item: any) => item._id.toString() === req.params.itemId);
    if (itemIndex === -1) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }
    
    Object.assign(cart.items[itemIndex], parsed);
    
    // Recalculate totals
    cart.subtotal = cart.items.reduce((sum, item) => sum + (item.priceAtAdd * item.qty), 0);
    cart.total = cart.subtotal;
    
    await cart.save();
    
    res.json({ success: true, data: cart });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.errors });
    }
    res.status(500).json({ success: false, error: 'Failed to update cart item' });
  }
});

// DELETE /api/v1/cart/items/:itemId - Remove item from cart
router.delete('/items/:itemId', auth, async (req: any, res) => {
  try {
    const cart = await CartModel.findOne({ userId: new mongoose.Types.ObjectId(req.user!._id) });
    if (!cart) {
      return res.status(404).json({ success: false, error: 'Cart not found' });
    }
    
    cart.items = cart.items.filter((item: any) => item._id.toString() !== req.params.itemId);
    
    // Recalculate totals
    cart.subtotal = cart.items.reduce((sum, item) => sum + (item.priceAtAdd * item.qty), 0);
    cart.total = cart.subtotal;
    
    await cart.save();
    
    res.json({ success: true, data: cart });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to remove cart item' });
  }
});

export default router;
