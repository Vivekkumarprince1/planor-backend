import { Schema, model, Document, Types } from 'mongoose';

export interface IRequirement extends Document {
  userId: Types.ObjectId;
  title?: string;
  description?: string;
  categoryId: Types.ObjectId;
  subcategoryId?: Types.ObjectId;
  media: Array<{
    type: 'image' | 'video' | 'link';
    url: string;
    thumbnail?: string;
  }>;
  location: {
    area: string;
    city?: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  attendeesCapacity?: number;
  budget?: {
    min?: number;
    max?: number;
  };
  timeframe?: {
    startDate?: Date;
    endDate?: Date;
    flexible?: boolean;
  };
  status: 'active' | 'closed' | 'cancelled';
  quotes: Types.ObjectId[]; // References to RequirementQuote
  notifications: Types.ObjectId[]; // References to RequirementNotification
  createdAt: Date;
  updatedAt: Date;
}

const RequirementSchema = new Schema<IRequirement>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, trim: true },
  description: { type: String, trim: true },
  categoryId: { type: Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
  subcategoryId: { type: Schema.Types.ObjectId, ref: 'Subcategory', index: true },
  media: [{
    type: { type: String, enum: ['image', 'video', 'link'], required: true },
    url: { type: String, required: true },
    thumbnail: String
  }],
  location: {
    area: { type: String, required: true, index: true },
    city: { type: String, index: true },
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  attendeesCapacity: { type: Number, min: 1 },
  budget: {
    min: { type: Number, min: 0 },
    max: { type: Number, min: 0 }
  },
  timeframe: {
    startDate: Date,
    endDate: Date,
    flexible: { type: Boolean, default: true }
  },
  status: { type: String, enum: ['active', 'closed', 'cancelled'], default: 'active', index: true },
  quotes: [{ type: Schema.Types.ObjectId, ref: 'RequirementQuote' }],
  notifications: [{ type: Schema.Types.ObjectId, ref: 'RequirementNotification' }]
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index for location-based queries
RequirementSchema.index({ 'location.area': 1, categoryId: 1, status: 1 });

export const Requirement = model<IRequirement>('Requirement', RequirementSchema);

export interface IRequirementQuote extends Document {
  requirementId: Types.ObjectId;
  managerId: Types.ObjectId;
  serviceId?: Types.ObjectId;
  price: number;
  notes?: string;
  availability?: {
    startDate?: Date;
    endDate?: Date;
    notes?: string;
  };
  status: 'pending' | 'accepted' | 'rejected' | 'withdrawn';
  chatId?: Types.ObjectId; // Reference to chat room
  validUntil?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const RequirementQuoteSchema = new Schema<IRequirementQuote>({
  requirementId: { type: Schema.Types.ObjectId, ref: 'Requirement', required: true, index: true },
  managerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  serviceId: { type: Schema.Types.ObjectId, ref: 'Service' },
  price: { type: Number, required: true, min: 0 },
  notes: { type: String, trim: true },
  availability: {
    startDate: Date,
    endDate: Date,
    notes: String
  },
  status: { type: String, enum: ['pending', 'accepted', 'rejected', 'withdrawn'], default: 'pending', index: true },
  chatId: { type: Schema.Types.ObjectId, ref: 'Chat' },
  validUntil: { type: Date, index: true }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index for efficient querying
RequirementQuoteSchema.index({ requirementId: 1, managerId: 1 }, { unique: true });

export const RequirementQuote = model<IRequirementQuote>('RequirementQuote', RequirementQuoteSchema);

export interface IRequirementNotification extends Document {
  requirementId: Types.ObjectId;
  managerId: Types.ObjectId;
  type: 'new_requirement' | 'requirement_updated' | 'quote_accepted' | 'quote_rejected';
  title: string;
  message: string;
  isRead: boolean;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const RequirementNotificationSchema = new Schema<IRequirementNotification>({
  requirementId: { type: Schema.Types.ObjectId, ref: 'Requirement', required: true, index: true },
  managerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, enum: ['new_requirement', 'requirement_updated', 'quote_accepted', 'quote_rejected'], required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  isRead: { type: Boolean, default: false, index: true },
  readAt: Date
}, { timestamps: true });

// Index for efficient querying of unread notifications
RequirementNotificationSchema.index({ managerId: 1, isRead: 1, createdAt: -1 });

export const RequirementNotification = model<IRequirementNotification>('RequirementNotification', RequirementNotificationSchema);
