"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const bcrypt_1 = __importDefault(require("bcrypt"));
const User_1 = require("../models/User");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Get user profile
router.get('/', auth_1.auth, async (req, res) => {
    try {
        const user = await User_1.User.findById(req.user._id).select('-passwordHash');
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        return res.json({ success: true, data: user });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: 'Server error' });
    }
});
// Update basic profile information
const updateProfileSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).optional(),
    phone: zod_1.z.string().optional(),
    area: zod_1.z.string().optional(),
    avatarUrl: zod_1.z.string().url().optional(),
    businessName: zod_1.z.string().optional(),
    businessDescription: zod_1.z.string().optional(),
    businessLicense: zod_1.z.string().optional(),
});
router.patch('/', auth_1.auth, async (req, res) => {
    try {
        const parsed = updateProfileSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ success: false, error: parsed.error.flatten() });
        }
        const user = await User_1.User.findByIdAndUpdate(req.user._id, { $set: parsed.data }, { new: true }).select('-passwordHash');
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        return res.json({ success: true, data: user });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: 'Server error' });
    }
});
// Change password
const changePasswordSchema = zod_1.z.object({
    currentPassword: zod_1.z.string().min(6),
    newPassword: zod_1.z.string().min(6),
});
router.patch('/password', auth_1.auth, async (req, res) => {
    try {
        const parsed = changePasswordSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ success: false, error: parsed.error.flatten() });
        }
        const user = await User_1.User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        const isCurrentPasswordValid = await bcrypt_1.default.compare(parsed.data.currentPassword, user.passwordHash);
        if (!isCurrentPasswordValid) {
            return res.status(400).json({ success: false, error: 'Current password is incorrect' });
        }
        const newPasswordHash = await bcrypt_1.default.hash(parsed.data.newPassword, 10);
        await User_1.User.findByIdAndUpdate(user._id, { passwordHash: newPasswordHash });
        return res.json({ success: true, message: 'Password updated successfully' });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: 'Server error' });
    }
});
// Add address
const addAddressSchema = zod_1.z.object({
    label: zod_1.z.string().min(1),
    line1: zod_1.z.string().min(1),
    line2: zod_1.z.string().optional(),
    city: zod_1.z.string().min(1),
    state: zod_1.z.string().min(1),
    pincode: zod_1.z.string().min(6).max(6),
    geo: zod_1.z.object({
        lat: zod_1.z.number(),
        lng: zod_1.z.number(),
    }).optional(),
    isDefault: zod_1.z.boolean().optional(),
});
router.post('/addresses', auth_1.auth, async (req, res) => {
    try {
        const parsed = addAddressSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ success: false, error: parsed.error.flatten() });
        }
        const userId = req.user._id;
        const addressData = parsed.data;
        // If this is set as default, make sure no other address is default
        if (addressData.isDefault) {
            await User_1.User.findByIdAndUpdate(userId, {
                $set: { 'addresses.$[].isDefault': false }
            });
        }
        const user = await User_1.User.findByIdAndUpdate(userId, { $push: { addresses: addressData } }, { new: true }).select('-passwordHash');
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        return res.json({ success: true, data: user });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: 'Server error' });
    }
});
// Update address
router.patch('/addresses/:addressId', auth_1.auth, async (req, res) => {
    try {
        const parsed = addAddressSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ success: false, error: parsed.error.flatten() });
        }
        const userId = req.user._id;
        const { addressId } = req.params;
        const addressData = parsed.data;
        // If this is set as default, make sure no other address is default
        if (addressData.isDefault) {
            await User_1.User.findByIdAndUpdate(userId, {
                $set: { 'addresses.$[].isDefault': false }
            });
        }
        const user = await User_1.User.findOneAndUpdate({ _id: userId, 'addresses._id': addressId }, { $set: { 'addresses.$': addressData } }, { new: true }).select('-passwordHash');
        if (!user) {
            return res.status(404).json({ success: false, error: 'User or address not found' });
        }
        return res.json({ success: true, data: user });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: 'Server error' });
    }
});
// Delete address
router.delete('/addresses/:addressId', auth_1.auth, async (req, res) => {
    try {
        const userId = req.user._id;
        const { addressId } = req.params;
        const user = await User_1.User.findByIdAndUpdate(userId, { $pull: { addresses: { _id: addressId } } }, { new: true }).select('-passwordHash');
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        return res.json({ success: true, data: user });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: 'Server error' });
    }
});
// Update Aadhar Card (Manager only)
const aadharCardSchema = zod_1.z.object({
    number: zod_1.z.string().min(12).max(12),
    imageUrl: zod_1.z.string().url(),
});
router.patch('/aadhar', auth_1.auth, async (req, res) => {
    try {
        const user = await User_1.User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        if (user.role !== 'manager') {
            return res.status(403).json({ success: false, error: 'Only managers can update Aadhar card details' });
        }
        const parsed = aadharCardSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ success: false, error: parsed.error.flatten() });
        }
        const updatedUser = await User_1.User.findByIdAndUpdate(user._id, {
            $set: {
                aadharCard: {
                    ...parsed.data,
                    verified: false, // Reset verification when updated
                    verifiedAt: undefined,
                    verifiedBy: undefined,
                }
            }
        }, { new: true }).select('-passwordHash');
        return res.json({ success: true, data: updatedUser });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: 'Server error' });
    }
});
// Update Bank Details (Manager only)
const bankDetailsSchema = zod_1.z.object({
    accountNumber: zod_1.z.string().min(8),
    ifscCode: zod_1.z.string().min(11).max(11),
    bankName: zod_1.z.string().min(1),
    branchName: zod_1.z.string().min(1),
    accountHolderName: zod_1.z.string().min(1),
});
router.patch('/bank-details', auth_1.auth, async (req, res) => {
    try {
        const user = await User_1.User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        if (user.role !== 'manager') {
            return res.status(403).json({ success: false, error: 'Only managers can update bank details' });
        }
        const parsed = bankDetailsSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ success: false, error: parsed.error.flatten() });
        }
        const updatedUser = await User_1.User.findByIdAndUpdate(user._id, {
            $set: {
                bankDetails: {
                    ...parsed.data,
                    verified: false, // Reset verification when updated
                    verifiedAt: undefined,
                    verifiedBy: undefined,
                }
            }
        }, { new: true }).select('-passwordHash');
        return res.json({ success: true, data: updatedUser });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: 'Server error' });
    }
});
exports.default = router;
