import mongoose, { Document, Schema } from 'mongoose';

export interface IOtp extends Document {
  identifier: string; // email or phone number
  identifierType: 'email' | 'phone';
  otp: string;
  purpose: 'registration' | 'forgot_password' | 'login_verification';
  attempts: number;
  verified: boolean;
  expiresAt: Date;
  userData?: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    area?: string;
    role?: 'user' | 'manager';
  };
  createdAt: Date;
}

const otpSchema = new Schema<IOtp>({
  identifier: { type: String, required: true, index: true },
  identifierType: { type: String, enum: ['email', 'phone'], required: true },
  otp: { type: String, required: true },
  purpose: { 
    type: String, 
    enum: ['registration', 'forgot_password', 'login_verification'], 
    required: true 
  },
  attempts: { type: Number, default: 0 },
  verified: { type: Boolean, default: false },
  expiresAt: { type: Date, required: true },
  userData: {
    name: String,
    email: String,
    password: String,
    phone: String,
    area: String,
    role: { type: String, enum: ['user', 'manager'] }
  }
}, { 
  timestamps: { createdAt: true, updatedAt: false }
});

// Create compound index for efficient queries
otpSchema.index({ identifier: 1, purpose: 1 });
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const OtpModel = mongoose.model<IOtp>('OTP', otpSchema);
