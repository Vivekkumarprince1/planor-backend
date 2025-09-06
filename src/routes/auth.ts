import bcrypt from 'bcrypt';
import { Router } from 'express';
import jwt, { Secret } from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../config/env';
import { auth } from '../middleware/auth';
import { OtpModel } from '../models/OTP';
import { User } from '../models/User';
import { OTPService } from '../services/OTPService';

const router = Router();

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  phone: z.string().optional(),
  area: z.string().optional(),
  role: z.enum(['user', 'manager']).optional(),
});

// New registration endpoint - sends OTP
router.post('/register', async (req, res) => {
  try {
    console.log('🔐 Registration attempt:', { 
      email: req.body.email, 
      name: req.body.name,
      role: req.body.role,
      hasPhone: !!req.body.phone,
      hasArea: !!req.body.area
    });
    
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      console.log('❌ Registration validation failed:', parsed.error.flatten());
      return res.status(400).json({ success: false, error: parsed.error.flatten() });
    }
    
    const { name, email, password, phone, area, role } = parsed.data;
    console.log('✅ Registration validation passed, checking if user exists...');
    
    const exists = await User.findOne({ email });
    if (exists) {
      console.log('❌ User already exists with email:', email);
      return res.status(409).json({ success: false, error: 'Email already exists' });
    }
    
    // Check if phone exists (if provided)
    if (phone && phone.trim()) {
      const phoneExists = await User.findOne({ phone: phone.trim() });
      if (phoneExists) {
        return res.status(409).json({ success: false, error: 'Phone number already exists' });
      }
    }
    
    console.log('✅ Email and phone are available, preparing user data...');
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Create user data object
    const userData: any = {
      name,
      email,
      password: passwordHash,
      role: role || 'user'
    };
    
    // Only add phone if it's provided and not empty
    if (phone && phone.trim()) {
      userData.phone = phone.trim();
    }
    
    // Only add area if it's provided and not empty
    if (area && area.trim()) {
      userData.area = area.trim();
    }
    
    console.log('� Sending OTP to email and phone...');
    
    // Send OTP to email
    const emailOTPResult = await OTPService.createAndSendOTP(
      email,
      'email',
      'registration',
      userData
    );
    
    if (!emailOTPResult.success) {
      return res.status(500).json({ 
        success: false, 
        error: emailOTPResult.message 
      });
    }
    
    // Send OTP to phone if provided
    let phoneOTPResult: { success: boolean; message: string } | null = null;
    if (phone && phone.trim()) {
      try {
        phoneOTPResult = await OTPService.createAndSendOTP(
          phone.trim(),
          'phone',
          'registration',
          userData
        );
      } catch (error) {
        console.error('Phone OTP sending failed:', error);
        phoneOTPResult = { success: false, message: 'Failed to send phone OTP' };
      }
    }
    
    console.log('✅ OTP sent successfully');
    
    return res.json({ 
      success: true, 
      message: 'Registration initiated. Please verify OTP sent to your email' + (phone && phoneOTPResult?.success ? ' and phone' : ''),
      data: {
        email,
        phone: phone?.trim() || null,
        otpSentToEmail: true,
        otpSentToPhone: phoneOTPResult?.success || false
      }
    });
  } catch (error: any) {
    console.error('❌ Registration error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Registration failed. Please try again.',
      details: error.message 
    });
  }
});

// Verify OTP and complete registration
const verifyOTPSchema = z.object({
  identifier: z.string().min(1),
  otp: z.string().min(6).max(6),
  purpose: z.enum(['registration', 'forgot_password']),
});

router.post('/verify-otp', async (req, res) => {
  try {
    const parsed = verifyOTPSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.flatten() });
    }
    
    const { identifier, otp, purpose } = parsed.data;
    console.log('🔍 OTP verification attempt:', { identifier, purpose });
    
    const result = await OTPService.verifyOTP(identifier, otp, purpose);
    
    if (!result.success) {
      return res.status(400).json({ success: false, error: result.message });
    }
    
    if (purpose === 'registration') {
      // Complete user registration
      const userData = result.userData!;
      
      const user = await User.create({
        name: userData.name,
        email: userData.email,
        passwordHash: userData.password,
        phone: userData.phone || undefined,
        area: userData.area || undefined,
        role: userData.role || 'user'
      });
      
      console.log('✅ User created successfully after OTP verification:', { 
        id: user._id, 
        email: user.email, 
        role: user.role 
      });
      
      // Generate tokens for automatic login
      const uid = (user._id as any).toString();
      const access = jwt.sign({ _id: uid, role: user.role }, env.JWT_ACCESS_SECRET as Secret, { expiresIn: env.JWT_ACCESS_TTL as any });
      const refresh = jwt.sign({ _id: uid, role: user.role }, env.JWT_REFRESH_SECRET as Secret, { expiresIn: env.JWT_REFRESH_TTL as any });
      
      // Clean up verified OTP
      await OtpModel.findByIdAndDelete(result.otpRecord!._id);
      
      return res.json({ 
        success: true,
        message: 'Registration completed successfully',
        accessToken: access,
        refreshToken: refresh,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          phone: user.phone,
          area: user.area
        }
      });
    } else if (purpose === 'forgot_password') {
      // For forgot password, we'll return a reset token
      const resetToken = jwt.sign(
        { identifier, otpId: result.otpRecord!._id }, 
        env.JWT_ACCESS_SECRET as Secret, 
        { expiresIn: '30m' }
      );
      
      return res.json({
        success: true,
        message: 'OTP verified successfully. You can now reset your password.',
        resetToken
      });
    }
  } catch (error: any) {
    console.error('❌ OTP verification error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'OTP verification failed. Please try again.',
      details: error.message 
    });
  }
});

// Resend OTP
const resendOTPSchema = z.object({
  identifier: z.string().min(1),
  purpose: z.enum(['registration', 'forgot_password']),
});

router.post('/resend-otp', async (req, res) => {
  try {
    const parsed = resendOTPSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.flatten() });
    }
    
    const { identifier, purpose } = parsed.data;
    console.log('📧 Resending OTP:', { identifier, purpose });
    
    const result = await OTPService.resendOTP(identifier, purpose);
    
    return res.json(result);
  } catch (error: any) {
    console.error('❌ Resend OTP error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to resend OTP. Please try again.' 
    });
  }
});

// Forgot password - send OTP
const forgotPasswordSchema = z.object({
  identifier: z.string().min(1), // can be email or phone
});

router.post('/forgot-password', async (req, res) => {
  try {
    const parsed = forgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.flatten() });
    }
    
    const { identifier } = parsed.data;
    console.log('🔑 Forgot password request:', { identifier });
    
    // Check if identifier is email or phone
    const isEmail = identifier.includes('@');
    const identifierType = isEmail ? 'email' : 'phone';
    
    // Find user by email or phone
    const user = await User.findOne({
      [isEmail ? 'email' : 'phone']: identifier
    });
    
    if (!user) {
      // Don't reveal if user exists or not for security
      return res.json({
        success: true,
        message: 'If this account exists, you will receive an OTP shortly.'
      });
    }
    
    // Send OTP
    const result = await OTPService.createAndSendOTP(
      identifier,
      identifierType,
      'forgot_password'
    );
    
    if (result.success) {
      return res.json({
        success: true,
        message: 'OTP sent successfully. Please check your ' + (isEmail ? 'email' : 'phone')
      });
    } else {
      return res.status(500).json(result);
    }
  } catch (error: any) {
    console.error('❌ Forgot password error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to process forgot password request. Please try again.' 
    });
  }
});

// Reset password with verified OTP
const resetPasswordSchema = z.object({
  resetToken: z.string(),
  newPassword: z.string().min(6),
});

router.post('/reset-password', async (req, res) => {
  try {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.flatten() });
    }
    
    const { resetToken, newPassword } = parsed.data;
    console.log('🔑 Reset password attempt');
    
    // Verify reset token
    let decoded: any;
    try {
      decoded = jwt.verify(resetToken, env.JWT_ACCESS_SECRET as Secret);
    } catch (error) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid or expired reset token' 
      });
    }
    
    // Verify OTP record still exists and is verified
    const otpRecord = await OtpModel.findOne({
      _id: decoded.otpId,
      identifier: decoded.identifier,
      purpose: 'forgot_password',
      verified: true
    });
    
    if (!otpRecord) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid or expired reset session' 
      });
    }
    
    // Find user and update password
    const isEmail = decoded.identifier.includes('@');
    const user = await User.findOne({
      [isEmail ? 'email' : 'phone']: decoded.identifier
    });
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
    }
    
    // Hash new password and update
    const passwordHash = await bcrypt.hash(newPassword, 10);
    user.passwordHash = passwordHash;
    await user.save();
    
    // Clean up OTP record
    await OtpModel.findByIdAndDelete(otpRecord._id);
    
    console.log('✅ Password reset successfully for user:', user.email);
    
    return res.json({
      success: true,
      message: 'Password reset successfully. You can now login with your new password.'
    });
  } catch (error: any) {
    console.error('❌ Reset password error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to reset password. Please try again.' 
    });
  }
});

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(6) });
router.post('/login', async (req, res) => {
  console.log('🔐 Login attempt:', { email: req.body.email, passwordLength: req.body.password?.length });
  
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    console.log('❌ Validation failed:', parsed.error.flatten());
    return res.status(400).json({ success: false, error: parsed.error.flatten() });
  }
  
  const { email, password } = parsed.data;
  console.log('✅ Validation passed, finding user with email:', email);
  
  const user = await User.findOne({ email });
  if (!user) {
    console.log('❌ User not found in database for email:', email);
    return res.status(401).json({ success: false, error: 'Invalid credentials' });
  }
  
  console.log('✅ User found:', { id: user._id, email: user.email, hasPassword: !!user.passwordHash });
  
  const ok = await bcrypt.compare(password, user.passwordHash);
  console.log('🔍 Password comparison result:', ok);
  
  if (!ok) {
    console.log('❌ Password comparison failed');
    return res.status(401).json({ success: false, error: 'Invalid credentials' });
  }
  
  console.log('✅ Login successful, generating tokens...');
  
  const uid = (user._id as any).toString();
  const access = jwt.sign({ _id: uid, role: user.role }, env.JWT_ACCESS_SECRET as Secret, { expiresIn: env.JWT_ACCESS_TTL as any });
  const refresh = jwt.sign({ _id: uid, role: user.role }, env.JWT_REFRESH_SECRET as Secret, { expiresIn: env.JWT_REFRESH_TTL as any });
  
  // Return format that matches mobile app expectations
  return res.json({ 
    success: true, 
    accessToken: access,
    refreshToken: refresh,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      area: user.area
    }
  });
});

router.get('/me', auth, async (req, res) => {
  const user = await User.findById((req as any).user._id).select('-passwordHash');
  if (!user) return res.status(404).json({ success: false, error: 'Not found' });
  return res.json({ success: true, data: user });
});

export default router;
