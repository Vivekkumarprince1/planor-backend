import mongoose, { Document, Schema } from 'mongoose';

// Local type definitions
interface ReviewType {
  _id: string;
  orderId: string;
  serviceId: string;
  userId: string;
  rating: number;
  comment?: string;
  createdAt: string;
}

interface NotificationDoc {
  _id: string;
  userId: string;
  title: string;
  body: string;
  type: string;
  data?: any;
  read: boolean;
  createdAt: string;
}

export interface ReviewDocument extends Omit<ReviewType, '_id'>, Document {}
export interface NotificationDocument extends Omit<NotificationDoc, '_id'>, Document {}

const reviewSchema = new Schema<ReviewDocument>({
  orderId: { type: String, required: true },
  serviceId: { type: String, required: true },
  userId: { type: String, required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: String,
}, {
  timestamps: { createdAt: true, updatedAt: false },
});

const notificationSchema = new Schema<NotificationDocument>({
  userId: { type: String, required: true },
  title: { type: String, required: true },
  body: { type: String, required: true },
  type: { type: String, required: true },
  data: Schema.Types.Mixed,
  read: { type: Boolean, default: false },
}, {
  timestamps: { createdAt: true, updatedAt: false },
});

reviewSchema.index({ serviceId: 1, userId: 1 }, { unique: true });
reviewSchema.index({ orderId: 1 });
notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

export const ReviewModel = mongoose.model<ReviewDocument>('Review', reviewSchema);
export const NotificationModel = mongoose.model<NotificationDocument>('Notification', notificationSchema);
