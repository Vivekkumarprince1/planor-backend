import { Schema, model, Document, Types } from 'mongoose';

export type CommissionStatus = 'pending' | 'negotiating' | 'accepted' | 'rejected' | 'expired';
export type CommissionType = 'manager_offer' | 'admin_counter' | 'final_agreement';

export interface INegotiationEntry {
  timestamp: Date;
  action: string;
  percentage?: number;
  notes?: string;
  byUser: Types.ObjectId;
  byRole: 'manager' | 'admin';
}

export interface ICommissionOffer extends Document {
  managerId: Types.ObjectId;
  serviceId?: Types.ObjectId; // Optional - can be global or per-service
  offeredPercentage: number; // Percentage of service price
  status: CommissionStatus;
  type: CommissionType;
  
  // Admin counter offer fields
  adminCounterPercentage?: number;
  adminNotes?: string;
  adminRespondedBy?: Types.ObjectId;
  adminRespondedAt?: Date;
  
  // Manager response to counter offer
  managerResponse?: 'accept' | 'reject' | 'counter';
  managerNotes?: string;
  managerRespondedAt?: Date;
  
  // Final agreement
  finalPercentage?: number; // The agreed percentage
  agreedAt?: Date;
  agreedBy?: Types.ObjectId; // Who finalized the agreement
  
  // Validity and terms
  validFrom?: Date;
  validUntil?: Date;
  isActive: boolean;
  
  // Additional terms
  minOrderValue?: number; // Minimum order value for commission to apply
  maxOrderValue?: number; // Maximum order value for commission
  applicableCategories?: Types.ObjectId[]; // If limited to specific categories
  
  // Audit trail
  negotiationHistory: INegotiationEntry[];
  
  createdAt: Date;
  updatedAt: Date;
  
  // Instance methods
  addNegotiationEntry(action: string, byUser: Types.ObjectId, byRole: 'manager' | 'admin', percentage?: number, notes?: string): void;
  getEffectivePercentage(): number;
}

const NegotiationHistorySchema = new Schema<INegotiationEntry>({
  timestamp: { type: Date, default: Date.now },
  action: { type: String, required: true }, // 'offer', 'counter', 'accept', 'reject'
  percentage: Number,
  notes: String,
  byUser: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  byRole: { type: String, enum: ['manager', 'admin'], required: true },
});

const CommissionSchema = new Schema<ICommissionOffer>({
  managerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  serviceId: { type: Schema.Types.ObjectId, ref: 'Service', index: true }, // Optional for global commissions
  
  offeredPercentage: { 
    type: Number, 
    required: true, 
    min: 0, 
    max: 100,
    validate: {
      validator: function(v: number) {
        return v >= 0 && v <= 100;
      },
      message: 'Commission percentage must be between 0 and 100'
    }
  },
  
  status: { 
    type: String, 
    enum: ['pending', 'negotiating', 'accepted', 'rejected', 'expired'], 
    default: 'pending',
    index: true 
  },
  
  type: { 
    type: String, 
    enum: ['manager_offer', 'admin_counter', 'final_agreement'], 
    default: 'manager_offer' 
  },
  
  // Admin counter offer
  adminCounterPercentage: { 
    type: Number, 
    min: 0, 
    max: 100,
    validate: {
      validator: function(v: number) {
        return !v || (v >= 0 && v <= 100);
      },
      message: 'Admin counter percentage must be between 0 and 100'
    }
  },
  adminNotes: { type: String, maxlength: 500 },
  adminRespondedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  adminRespondedAt: Date,
  
  // Manager response
  managerResponse: { type: String, enum: ['accept', 'reject', 'counter'] },
  managerNotes: { type: String, maxlength: 500 },
  managerRespondedAt: Date,
  
  // Final agreement
  finalPercentage: { 
    type: Number, 
    min: 0, 
    max: 100,
    validate: {
      validator: function(v: number) {
        return !v || (v >= 0 && v <= 100);
      },
      message: 'Final percentage must be between 0 and 100'
    }
  },
  agreedAt: Date,
  agreedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  
  // Validity
  validFrom: { type: Date, default: Date.now },
  validUntil: Date,
  isActive: { type: Boolean, default: true },
  
  // Terms
  minOrderValue: { type: Number, min: 0 },
  maxOrderValue: { type: Number, min: 0 },
  applicableCategories: [{ type: Schema.Types.ObjectId, ref: 'Category' }],
  
  negotiationHistory: [NegotiationHistorySchema],
  
}, { timestamps: true });

// Indexes for efficient querying
CommissionSchema.index({ managerId: 1, serviceId: 1, isActive: 1 });
CommissionSchema.index({ status: 1, createdAt: -1 });
CommissionSchema.index({ validFrom: 1, validUntil: 1 });

// Virtual to check if commission is currently valid
CommissionSchema.virtual('isCurrentlyValid').get(function() {
  const now = new Date();
  const validFrom = this.validFrom || this.createdAt;
  const validUntil = this.validUntil;
  
  return this.isActive && 
         this.status === 'accepted' && 
         now >= validFrom && 
         (!validUntil || now <= validUntil);
});

// Method to get effective commission percentage
CommissionSchema.methods.getEffectivePercentage = function() {
  if (this.status === 'accepted' && this.finalPercentage !== undefined) {
    return this.finalPercentage;
  }
  if (this.status === 'accepted' && this.adminCounterPercentage !== undefined) {
    return this.adminCounterPercentage;
  }
  if (this.status === 'accepted') {
    return this.offeredPercentage;
  }
  return 0;
};

// Method to add negotiation history entry
CommissionSchema.methods.addNegotiationEntry = function(action: string, byUser: Types.ObjectId, byRole: 'manager' | 'admin', percentage?: number, notes?: string) {
  this.negotiationHistory.push({
    timestamp: new Date(),
    action,
    percentage,
    notes,
    byUser,
    byRole,
  });
};

// Pre-save middleware to update negotiation history
CommissionSchema.pre('save', function(next) {
  if (this.isModified('status') || this.isModified('adminCounterPercentage') || this.isModified('managerResponse')) {
    // This will be handled explicitly in route handlers to ensure proper user context
  }
  next();
});

CommissionSchema.set('toJSON', { virtuals: true });
CommissionSchema.set('toObject', { virtuals: true });

export const Commission = model<ICommissionOffer>('Commission', CommissionSchema);
