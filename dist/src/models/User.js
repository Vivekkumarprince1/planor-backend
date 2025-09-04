"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.User = void 0;
const mongoose_1 = require("mongoose");
const AddressSchema = new mongoose_1.Schema({
    label: { type: String, required: true },
    line1: { type: String, required: true },
    line2: String,
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
    geo: { lat: Number, lng: Number },
    isDefault: { type: Boolean, default: false },
});
const AadharCardSchema = new mongoose_1.Schema({
    number: { type: String, required: true },
    imageUrl: { type: String, required: true },
    verified: { type: Boolean, default: false },
    verifiedAt: Date,
    verifiedBy: String,
});
const BankDetailsSchema = new mongoose_1.Schema({
    accountNumber: { type: String, required: true },
    ifscCode: { type: String, required: true },
    bankName: { type: String, required: true },
    branchName: { type: String, required: true },
    accountHolderName: { type: String, required: true },
    verified: { type: Boolean, default: false },
    verifiedAt: Date,
    verifiedBy: String,
});
const UserSchema = new mongoose_1.Schema({
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
UserSchema.pre('save', function (next) {
    if (this.role === 'manager' && this.isNew) {
        this.approved = false; // New managers need approval
    }
    else if (this.role !== 'manager' && this.approved === undefined) {
        this.approved = true; // Users and admins are auto-approved
    }
    next();
});
exports.User = (0, mongoose_1.model)('User', UserSchema);
