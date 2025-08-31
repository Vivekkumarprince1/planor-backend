import mongoose, { Document, Schema } from 'mongoose';

// Local type definitions to avoid import issues
type TierLabel = 'small' | 'medium' | 'large';
interface CartItem {
  serviceId: string;
  tierLabel?: TierLabel;
  qty: number;
  dateTime?: string;
  notes?: string;
  addOnIds?: string[];
  priceAtAdd: number;
}
interface CartType {
  _id: string;
  userId: string;
  items: CartItem[];
  subtotal: number;
  coupon?: string;
  total: number;
  updatedAt: string;
}

export interface CartDocument extends Omit<CartType, '_id'>, Document {}

const cartItemSchema = new Schema<CartItem>({
  serviceId: { type: String, required: true }, // Store as string for simplicity
  tierLabel: { type: String, enum: ['small', 'medium', 'large'] },
  qty: { type: Number, required: true, min: 1 },
  dateTime: String,
  notes: String,
  addOnIds: [String],
  priceAtAdd: { type: Number, required: true },
});

const cartSchema = new Schema<CartDocument>({
  userId: { type: String, required: true }, // Store as string for simplicity
  items: [cartItemSchema],
  subtotal: { type: Number, required: true, default: 0 },
  coupon: String,
  total: { type: Number, required: true, default: 0 },
}, {
  timestamps: { createdAt: false, updatedAt: true },
});

cartSchema.index({ userId: 1 });

export const CartModel = mongoose.model<CartDocument>('Cart', cartSchema);
