import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { User } from '../models/User';
import { auth } from '../middleware/auth';

const router = Router();

// Get user profile
router.get('/', auth, async (req, res) => {
  try {
    const user = await User.findById((req as any).user._id).select('-passwordHash');
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    return res.json({ success: true, data: user });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Update basic profile information
const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().optional(),
  area: z.string().optional(),
  avatarUrl: z.string().url().optional(),
  businessName: z.string().optional(),
  businessDescription: z.string().optional(),
  businessLicense: z.string().optional(),
});

router.patch('/', auth, async (req, res) => {
  try {
    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.flatten() });
    }

    const user = await User.findByIdAndUpdate(
      (req as any).user._id,
      { $set: parsed.data },
      { new: true }
    ).select('-passwordHash');

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    return res.json({ success: true, data: user });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Change password
const changePasswordSchema = z.object({
  currentPassword: z.string().min(6),
  newPassword: z.string().min(6),
});

router.patch('/password', auth, async (req, res) => {
  try {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.flatten() });
    }

    const user = await User.findById((req as any).user._id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const isCurrentPasswordValid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({ success: false, error: 'Current password is incorrect' });
    }

    const newPasswordHash = await bcrypt.hash(parsed.data.newPassword, 10);
    await User.findByIdAndUpdate(user._id, { passwordHash: newPasswordHash });

    return res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Add address
const addAddressSchema = z.object({
  label: z.string().min(1),
  line1: z.string().min(1),
  line2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().min(1),
  pincode: z.string().min(6).max(6),
  geo: z.object({
    lat: z.number(),
    lng: z.number(),
  }).optional(),
  isDefault: z.boolean().optional(),
});

router.post('/addresses', auth, async (req, res) => {
  try {
    const parsed = addAddressSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.flatten() });
    }

    const userId = (req as any).user._id;
    const addressData = parsed.data;

    // If this is set as default, make sure no other address is default
    if (addressData.isDefault) {
      await User.findByIdAndUpdate(userId, {
        $set: { 'addresses.$[].isDefault': false }
      });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $push: { addresses: addressData } },
      { new: true }
    ).select('-passwordHash');

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    return res.json({ success: true, data: user });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Update address
router.patch('/addresses/:addressId', auth, async (req, res) => {
  try {
    const parsed = addAddressSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.flatten() });
    }

    const userId = (req as any).user._id;
    const { addressId } = req.params;
    const addressData = parsed.data;

    // If this is set as default, make sure no other address is default
    if (addressData.isDefault) {
      await User.findByIdAndUpdate(userId, {
        $set: { 'addresses.$[].isDefault': false }
      });
    }

    const user = await User.findOneAndUpdate(
      { _id: userId, 'addresses._id': addressId },
      { $set: { 'addresses.$': addressData } },
      { new: true }
    ).select('-passwordHash');

    if (!user) {
      return res.status(404).json({ success: false, error: 'User or address not found' });
    }

    return res.json({ success: true, data: user });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Delete address
router.delete('/addresses/:addressId', auth, async (req, res) => {
  try {
    const userId = (req as any).user._id;
    const { addressId } = req.params;

    const user = await User.findByIdAndUpdate(
      userId,
      { $pull: { addresses: { _id: addressId } } },
      { new: true }
    ).select('-passwordHash');

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    return res.json({ success: true, data: user });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Update Aadhar Card (Manager only)
const aadharCardSchema = z.object({
  number: z.string().min(12).max(12),
  imageUrl: z.string().url(),
});

router.patch('/aadhar', auth, async (req, res) => {
  try {
    const user = await User.findById((req as any).user._id);
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

    const updatedUser = await User.findByIdAndUpdate(
      user._id,
      { 
        $set: { 
          aadharCard: {
            ...parsed.data,
            verified: false, // Reset verification when updated
            verifiedAt: undefined,
            verifiedBy: undefined,
          }
        }
      },
      { new: true }
    ).select('-passwordHash');

    return res.json({ success: true, data: updatedUser });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Update Bank Details (Manager only)
const bankDetailsSchema = z.object({
  accountNumber: z.string().min(8),
  ifscCode: z.string().min(11).max(11),
  bankName: z.string().min(1),
  branchName: z.string().min(1),
  accountHolderName: z.string().min(1),
});

router.patch('/bank-details', auth, async (req, res) => {
  try {
    const user = await User.findById((req as any).user._id);
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

    const updatedUser = await User.findByIdAndUpdate(
      user._id,
      { 
        $set: { 
          bankDetails: {
            ...parsed.data,
            verified: false, // Reset verification when updated
            verifiedAt: undefined,
            verifiedBy: undefined,
          }
        }
      },
      { new: true }
    ).select('-passwordHash');

    return res.json({ success: true, data: updatedUser });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});

export default router;
