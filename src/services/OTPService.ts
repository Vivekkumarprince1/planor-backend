import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { IOtp, OtpModel } from '../models/OTP';

export class OTPService {
  private static emailTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER || 'your-email@gmail.com',
      pass: process.env.EMAIL_PASS || 'your-app-password'
    }
  });

  /**
   * Generate a 6-digit OTP
   */
  static generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Create and send OTP
   */
  static async createAndSendOTP(
    identifier: string,
    identifierType: 'email' | 'phone',
    purpose: 'registration' | 'forgot_password' | 'login_verification',
    userData?: {
      name: string;
      email: string;
      password: string;
      phone?: string;
      area?: string;
      role?: 'user' | 'manager';
    }
  ): Promise<{ success: boolean; message: string; otpId?: string }> {
    try {
      // Delete any existing OTP for this identifier and purpose
      await OtpModel.deleteMany({ identifier, purpose });

      // Generate new OTP
      const otpCode = this.generateOTP();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Create OTP record
      const otpRecord = new OtpModel({
        identifier,
        identifierType,
        otp: otpCode,
        purpose,
        expiresAt,
        userData: userData || undefined
      });

      await otpRecord.save();

      // Send OTP
      let sendResult: { success: boolean; message: string };

      if (identifierType === 'email') {
        sendResult = await this.sendEmailOTP(identifier, otpCode, purpose);
      } else {
        sendResult = await this.sendSMSOTP(identifier, otpCode, purpose);
      }

      if (sendResult.success) {
        return {
          success: true,
          message: `OTP sent successfully to ${identifierType === 'email' ? 'email' : 'phone number'}`,
          otpId: (otpRecord._id as any).toString()
        };
      } else {
        // Delete OTP record if sending failed
        await OtpModel.findByIdAndDelete(otpRecord._id);
        return sendResult;
      }
    } catch (error: any) {
      console.error('Error creating and sending OTP:', error);
      return {
        success: false,
        message: 'Failed to generate and send OTP. Please try again.'
      };
    }
  }

  /**
   * Send OTP via email
   */
  private static async sendEmailOTP(
    email: string,
    otp: string,
    purpose: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      // In development mode, just log the OTP instead of sending email
      if (env.NODE_ENV === 'development' && (!process.env.EMAIL_USER || !process.env.EMAIL_PASS)) {
        console.log(`📧 EMAIL OTP for ${email}: ${otp} (Purpose: ${purpose})`);
        console.log(`🔗 Email Subject: ${this.getEmailSubject(purpose)}`);
        return { success: true, message: 'OTP sent to email successfully (logged to console in development)' };
      }

      const subject = this.getEmailSubject(purpose);
      const htmlContent = this.getEmailTemplate(otp, purpose);

      const mailOptions = {
        from: `"Planner App" <${process.env.EMAIL_USER || 'noreply@planner.com'}>`,
        to: email,
        subject,
        html: htmlContent
      };

      await this.emailTransporter.sendMail(mailOptions);
      return { success: true, message: 'OTP sent to email successfully' };
    } catch (error: any) {
      console.error('Email sending error:', error);
      
      // In development, still succeed but log the error
      if (env.NODE_ENV === 'development') {
        console.log(`📧 DEV EMAIL OTP for ${email}: ${otp} (Purpose: ${purpose})`);
        return { success: true, message: 'OTP sent to email successfully (logged to console in development)' };
      }
      
      return { 
        success: false, 
        message: 'Failed to send email. Please check your email address and try again.' 
      };
    }
  }

  /**
   * Send OTP via SMS (Mock implementation)
   * In production, integrate with SMS service like Twilio, AWS SNS, or local SMS gateway
   */
  private static async sendSMSOTP(
    phone: string,
    otp: string,
    purpose: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Mock SMS sending - replace with actual SMS service
      console.log(`📱 SMS OTP for ${phone}: ${otp} (Purpose: ${purpose})`);
      
      // In production, implement actual SMS sending here:
      /*
      const smsService = new TwilioService(); // or your preferred SMS service
      await smsService.sendSMS({
        to: phone,
        message: `Your Planner App OTP is: ${otp}. Valid for 10 minutes. Don't share this code with anyone.`
      });
      */

      return { success: true, message: 'OTP sent to phone successfully' };
    } catch (error: any) {
      console.error('SMS sending error:', error);
      return { 
        success: false, 
        message: 'Failed to send SMS. Please check your phone number and try again.' 
      };
    }
  }

  /**
   * Verify OTP
   */
  static async verifyOTP(
    identifier: string,
    otp: string,
    purpose: string
  ): Promise<{ success: boolean; message: string; userData?: any; otpRecord?: IOtp }> {
    try {
      const otpRecord = await OtpModel.findOne({
        identifier,
        purpose,
        verified: false,
        expiresAt: { $gt: new Date() }
      });

      if (!otpRecord) {
        return {
          success: false,
          message: 'Invalid or expired OTP. Please request a new one.'
        };
      }

      // Check attempts limit
      if (otpRecord.attempts >= 3) {
        await OtpModel.findByIdAndDelete(otpRecord._id);
        return {
          success: false,
          message: 'Too many failed attempts. Please request a new OTP.'
        };
      }

      // Verify OTP
      if (otpRecord.otp !== otp) {
        otpRecord.attempts += 1;
        await otpRecord.save();
        
        return {
          success: false,
          message: `Invalid OTP. ${3 - otpRecord.attempts} attempts remaining.`
        };
      }

      // Mark as verified
      otpRecord.verified = true;
      await otpRecord.save();

      return {
        success: true,
        message: 'OTP verified successfully',
        userData: otpRecord.userData,
        otpRecord
      };
    } catch (error: any) {
      console.error('OTP verification error:', error);
      return {
        success: false,
        message: 'Failed to verify OTP. Please try again.'
      };
    }
  }

  /**
   * Resend OTP
   */
  static async resendOTP(
    identifier: string,
    purpose: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const existingOTP = await OtpModel.findOne({ identifier, purpose, verified: false });
      
      if (!existingOTP) {
        return {
          success: false,
          message: 'No pending OTP found. Please start the process again.'
        };
      }

      // Delete existing OTP
      await OtpModel.findByIdAndDelete(existingOTP._id);

      // Create new OTP with same data
      const result = await this.createAndSendOTP(
        identifier,
        existingOTP.identifierType,
        purpose as any,
        existingOTP.userData
      );

      return result;
    } catch (error: any) {
      console.error('Resend OTP error:', error);
      return {
        success: false,
        message: 'Failed to resend OTP. Please try again.'
      };
    }
  }

  /**
   * Cleanup expired OTPs
   */
  static async cleanupExpiredOTPs(): Promise<void> {
    try {
      await OtpModel.deleteMany({
        expiresAt: { $lt: new Date() }
      });
    } catch (error) {
      console.error('Error cleaning up expired OTPs:', error);
    }
  }

  /**
   * Get email subject based on purpose
   */
  private static getEmailSubject(purpose: string): string {
    switch (purpose) {
      case 'registration':
        return 'Verify Your Account - Planner App';
      case 'forgot_password':
        return 'Reset Your Password - Planner App';
      case 'login_verification':
        return 'Login Verification - Planner App';
      default:
        return 'Verification Code - Planner App';
    }
  }

  /**
   * Get email template
   */
  private static getEmailTemplate(otp: string, purpose: string): string {
    const purposeText = {
      'registration': 'complete your registration',
      'forgot_password': 'reset your password',
      'login_verification': 'verify your login'
    };

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>OTP Verification</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #007AFF; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
            .otp-box { background: white; border: 2px solid #007AFF; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
            .otp-code { font-size: 32px; font-weight: bold; color: #007AFF; letter-spacing: 8px; margin: 10px 0; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Planner App</h1>
                <p>Verification Code</p>
            </div>
            <div class="content">
                <h2>Hello!</h2>
                <p>You have requested to ${purposeText[purpose as keyof typeof purposeText] || 'verify your identity'}. Please use the following OTP to continue:</p>
                
                <div class="otp-box">
                    <p style="margin: 0; color: #666;">Your verification code is:</p>
                    <div class="otp-code">${otp}</div>
                </div>
                
                <p><strong>Important:</strong></p>
                <ul>
                    <li>This code is valid for 10 minutes only</li>
                    <li>Don't share this code with anyone</li>
                    <li>If you didn't request this code, please ignore this email</li>
                </ul>
                
                <p>Thank you for using Planner App!</p>
            </div>
            <div class="footer">
                <p>This is an automated message, please do not reply to this email.</p>
                <p>&copy; 2024 Planner App. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
    `;
  }
}

// Schedule cleanup of expired OTPs every hour
setInterval(() => {
  OTPService.cleanupExpiredOTPs();
}, 60 * 60 * 1000);
