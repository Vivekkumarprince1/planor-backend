import mongoose, { Document, Schema } from 'mongoose';

// Local type definitions
type OrderStatus = 'pending' | 'accepted' | 'in_progress' | 'completed' | 'cancelled' | 'refunded';
type TierLabel = 'small' | 'medium' | 'large';

interface OrderItem {
  serviceId: string;
  tierLabel?: TierLabel;
  qty: number;
  unitPrice: number;
  addOns?: { name: string; price: number }[];
  notes?: string;
}

interface PaymentInfo {
  provider: 'razorpay';
  orderId: string;
  paymentId?: string;
  signature?: string;
  status: 'created' | 'paid' | 'failed' | 'refunded';
}

interface OrderTimelineEntry {
  at: string;
  by: string;
  action: string;
  note?: string;
}

interface Address {
  label?: string;
  line1?: string;
  city?: string;
  state?: string;
  pincode?: string;
  geo?: { lat: number; lng: number };
}

interface OrderType {
  _id: string;
  userId: string | mongoose.Types.ObjectId;
  managerId: string | mongoose.Types.ObjectId;
  serviceId?: string | mongoose.Types.ObjectId; // Added for easier reference
  items: OrderItem[];
  subtotal: number;
  fee: number;
  tax: number;
  total: number;
  totalAmount: number; // Alias for total for admin consistency
  status: OrderStatus;
  addressSnapshot?: Address;
  scheduledAt?: string;
  payment: PaymentInfo;
  timeline: OrderTimelineEntry[];
  refundAmount?: number;
  refundReason?: string;
  refundedAt?: Date;
  refundedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrderDocument extends Omit<OrderType, '_id'>, Document {}

const orderItemSchema = new Schema<OrderItem>({
  serviceId: { type: String, required: true },
  tierLabel: { type: String, enum: ['small', 'medium', 'large'] },
  qty: { type: Number, required: true, min: 1 },
  unitPrice: { type: Number, required: true },
  addOns: [{
    name: { type: String, required: true },
    price: { type: Number, required: true },
  }],
  notes: String,
});

const paymentSchema = new Schema<PaymentInfo>({
  provider: { type: String, enum: ['razorpay'], required: true },
  orderId: { type: String, required: true },
  paymentId: String,
  signature: String,
  status: { 
    type: String, 
    enum: ['created', 'paid', 'failed', 'refunded'], 
    default: 'created' 
  },
});

const timelineSchema = new Schema<OrderTimelineEntry>({
  at: { type: String, default: () => new Date().toISOString() },
  by: { type: String, required: true },
  action: { type: String, required: true },
  note: String,
});

const addressSnapshotSchema = new Schema<Address>({
  label: String,
  line1: String,
  city: String,
  state: String,
  pincode: String,
  geo: { lat: Number, lng: Number },
});

const orderSchema = new Schema<OrderDocument>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  managerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  serviceId: { type: Schema.Types.ObjectId, ref: 'Service' }, // Added for easier reference
  items: [orderItemSchema],
  subtotal: { type: Number, required: true },
  fee: { type: Number, default: 0 },
  tax: { type: Number, default: 0 },
  total: { type: Number, required: true },
  status: { 
    type: String, 
    enum: ['pending', 'accepted', 'in_progress', 'completed', 'cancelled', 'refunded'], 
    default: 'pending' 
  },
  addressSnapshot: addressSnapshotSchema,
  scheduledAt: String,
  payment: paymentSchema,
  timeline: [timelineSchema],
  refundAmount: Number,
  refundReason: String,
  refundedAt: Date,
  refundedBy: String,
}, {
  timestamps: true,
});

// Virtual field for totalAmount (alias for total)
orderSchema.virtual('totalAmount').get(function() {
  return (this as any).total;
});

// Ensure virtuals are included when converting to JSON
orderSchema.set('toJSON', { virtuals: true });
orderSchema.set('toObject', { virtuals: true });

orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ managerId: 1, status: 1 });
orderSchema.index({ status: 1 });

export const OrderModel = mongoose.model<OrderDocument>('Order', orderSchema);
