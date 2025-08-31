import { Schema, model, Document, Types } from 'mongoose';

export interface INotification extends Document {
  userId: Types.ObjectId;
  title: string;
  body: string;
  type: string;
  data?: any;
  read: boolean;
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true },
  body: { type: String, required: true },
  type: { type: String, required: true },
  data: Schema.Types.Mixed,
  read: { type: Boolean, default: false },
}, { timestamps: { createdAt: true, updatedAt: false } });

NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, read: 1 });

export const Notification = model<INotification>('Notification', NotificationSchema);
