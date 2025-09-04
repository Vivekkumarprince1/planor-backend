import mongoose, { Document, Schema, Types } from 'mongoose';

// Local type definitions to avoid import issues
type TierLabel = 'small' | 'medium' | 'large';
interface CartItem {
  serviceId: Types.ObjectId;
  tierLabel?: TierLabel;
  qty: number;
  dateTime?: string;
  notes?: string;
  addOnIds?: string[];
  priceAtAdd: number;
  // New fields for requirement quotes
  requirementId?: string;
  quoteId?: string;
  managerId?: string;
  isCustomQuote?: boolean;
}
interface CartType {
  _id: string;
  userId: Types.ObjectId;
  items: CartItem[];
  subtotal: number;
  coupon?: string;
  total: number;
  updatedAt: string;
}

export interface CartDocument extends Omit<CartType, '_id'>, Document {}

const cartItemSchema = new Schema<CartItem>({
  serviceId: { type: Schema.Types.ObjectId, ref: 'Service', required: true },
  tierLabel: { type: String, enum: ['small', 'medium', 'large'] },
  qty: { type: Number, required: true, min: 1 },
  dateTime: String,
  notes: String,
  addOnIds: [String],
  priceAtAdd: { type: Number, required: true },
  // New fields for requirement quotes
  requirementId: String,
  quoteId: String,
  managerId: String,
  isCustomQuote: { type: Boolean, default: false },
});

const cartSchema = new Schema<CartDocument>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  items: [cartItemSchema],
  subtotal: { type: Number, required: true, default: 0 },
  coupon: String,
  total: { type: Number, required: true, default: 0 },
}, {
  timestamps: { createdAt: false, updatedAt: true },
});

cartSchema.index({ userId: 1 });

export const CartModel = mongoose.model<CartDocument>('Cart', cartSchema);
