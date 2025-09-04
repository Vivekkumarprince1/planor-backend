import { Schema, model, Document } from 'mongoose';
type Role = 'user' | 'manager' | 'admin';

export interface Address {
  label: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  geo?: { lat: number; lng: number };
  isDefault?: boolean;
}

export interface AadharCard {
  number: string;
  imageUrl: string;
  verified?: boolean;
  verifiedAt?: Date;
  verifiedBy?: string;
}

export interface BankDetails {
  accountNumber: string;
  ifscCode: string;
  bankName: string;
  branchName: string;
  accountHolderName: string;
  verified?: boolean;
  verifiedAt?: Date;
  verifiedBy?: string;
}

export interface IUser extends Document {
  role: Role;
  name: string;
  email: string;
  phone?: string;
  passwordHash: string;
  avatarUrl?: string;
  area?: string;
  addresses?: Address[];
  // Manager specific fields
  aadharCard?: AadharCard;
  bankDetails?: BankDetails;
  businessName?: string;
  businessDescription?: string;
  businessLicense?: string;
  // Common fields
  ratingsAverage?: number;
  blocked?: boolean;
  blockReason?: string;
  blockedAt?: Date;
  blockedBy?: string;
  approved?: boolean;
  adminNotes?: string;
  approvedAt?: Date;
  approvedBy?: string;
  createdAt: Date;
}

const AddressSchema = new Schema<Address>({
  label: { type: String, required: true },
  line1: { type: String, required: true },
  line2: String,
  city: { type: String, required: true },
  state: { type: String, required: true },
  pincode: { type: String, required: true },
  geo: { lat: Number, lng: Number },
  isDefault: { type: Boolean, default: false },
});

const AadharCardSchema = new Schema<AadharCard>({
  number: { type: String, required: true },
  imageUrl: { type: String, required: true },
  verified: { type: Boolean, default: false },
  verifiedAt: Date,
  verifiedBy: String,
});

const BankDetailsSchema = new Schema<BankDetails>({
  accountNumber: { type: String, required: true },
  ifscCode: { type: String, required: true },
  bankName: { type: String, required: true },
  branchName: { type: String, required: true },
  accountHolderName: { type: String, required: true },
  verified: { type: Boolean, default: false },
  verifiedAt: Date,
  verifiedBy: String,
});

const UserSchema = new Schema<IUser>({
  role: { type: String, enum: ['user', 'manager', 'admin'], default: 'user', index: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, index: true },
  phone: String,
  passwordHash: { type: String, required: true },
  avatarUrl: String,
  area: String,
  addresses: [AddressSchema],
  // Manager specific fields
  aadharCard: AadharCardSchema,
  bankDetails: BankDetailsSchema,
  businessName: String,
  businessDescription: String,
  businessLicense: String,
  // Common fields
  ratingsAverage: { type: Number, default: 0 },
  blocked: { type: Boolean, default: false, index: true },
  blockReason: String,
  blockedAt: Date,
  blockedBy: String,
  approved: { type: Boolean, default: true, index: true },
  adminNotes: String,
  approvedAt: Date,
  approvedBy: String,
}, { timestamps: { createdAt: true, updatedAt: false } });

// Pre-save middleware to handle approval logic for managers
UserSchema.pre('save', function(next) {
  if (this.role === 'manager' && this.isNew) {
    this.approved = false; // New managers need approval
  } else if (this.role !== 'manager' && this.approved === undefined) {
    this.approved = true; // Users and admins are auto-approved
  }
  next();
});

export const User = model<IUser>('User', UserSchema);
