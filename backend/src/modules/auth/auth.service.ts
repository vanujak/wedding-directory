import { Injectable, BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { VisitorService } from '../visitor/visitor.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OAuth2Client, TokenPayload } from 'google-auth-library';

import { VisitorEntity } from '../../database/entities/visitor.entity';
import { jwtSecret } from './constants';
import { VendorService } from '../vendor/vendor.service';
import { VendorEntity } from '../../database/entities/vendor.entity';
import { PasswordResetOtpEntity } from '../../database/entities/password_reset_otp.entity';
import { MailService } from '../mail/mail.service';
import { ResetRole } from './dto/password-reset.dto';
import {
  CompleteVisitorSignupDto,
  CompleteVendorSignupDto,
} from './dto/signup-otp.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly visitorService: VisitorService,
    private readonly vendorService: VendorService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    @InjectRepository(PasswordResetOtpEntity)
    private readonly otpRepository: Repository<PasswordResetOtpEntity>,
  ) {}

  async validateVisitor(email: string, password: string): Promise<VisitorEntity | null> {
    const visitor = await this.visitorService.getVisitorByEmail(email);

    if (!visitor) {
      return null;
    }

    const passwordIsValid = await bcrypt.compare(password, visitor.password);
    return passwordIsValid ? visitor : null;
  }

  async validateVendor(email: string, password: string): Promise<VendorEntity | null> {
    const vendor = await this.vendorService.getVendorByEmail(email);

    if (!vendor) {
      return null;
    }
    const passwordIsValid = await bcrypt.compare(password, vendor.password);
    return passwordIsValid ? vendor : null;
  }

  loginVisitor(visitor: VisitorEntity): { access_token: string } {
    const payload = {
      email: visitor.email,
      sub: visitor.id,
      role: 'visitor',
    };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  loginVendor(vendor: VendorEntity): { access_token: string } {
    const payload = {
      email: vendor.email,
      sub: vendor.id,
      role: 'vendor',
    };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  async verifyVisitor(token: string): Promise<VisitorEntity> {
    const decoded = this.jwtService.verify(token, {
      secret: jwtSecret,
    });

    const visitor = await this.visitorService.getVisitorByEmail(decoded.email);

    if (!visitor) {
      throw new Error('Unable to get the visitor from decoded token');
    }
    return visitor;
  }

  async verifyVendor(token: string): Promise<VendorEntity> {
    const decoded = this.jwtService.verify(token, {
      secret: jwtSecret,
    });

    const vendor = await this.vendorService.getVendorByEmail(decoded.email);

    if (!vendor) {
      throw new Error('Unable to get the vendor from decoded token');
    }
    return vendor;
  }

  /**
   * Generates and emails a 6-digit OTP code to the requested email.
   * Prevents user enumeration by returning a generic success message.
   */
  async requestPasswordResetOtp(
    rawEmail: string,
    role?: ResetRole,
  ): Promise<{ message: string; role?: ResetRole }> {
    const email = rawEmail?.trim().toLowerCase();
    if (!email) {
      throw new BadRequestException('Email address is required.');
    }

    let detectedRole: ResetRole | null = role || null;

    // Check account existence based on role or detect automatically
    if (detectedRole === 'visitor') {
      const visitor = await this.visitorService.getVisitorByEmail(email);
      if (!visitor) {
        return {
          message: 'If an account exists with this email address, a verification code has been sent.',
        };
      }
    } else if (detectedRole === 'vendor') {
      const vendor = await this.vendorService.getVendorByEmail(email);
      if (!vendor) {
        return {
          message: 'If an account exists with this email address, a verification code has been sent.',
        };
      }
    } else {
      const visitor = await this.visitorService.getVisitorByEmail(email);
      if (visitor) {
        detectedRole = 'visitor';
      } else {
        const vendor = await this.vendorService.getVendorByEmail(email);
        if (vendor) {
          detectedRole = 'vendor';
        } else {
          return {
            message: 'If an account exists with this email address, a verification code has been sent.',
          };
        }
      }
    }

    // Cooldown check (60 seconds)
    const recentOtp = await this.otpRepository.findOne({
      where: { email, userType: detectedRole, isUsed: false },
      order: { createdAt: 'DESC' },
    });

    if (
      recentOtp &&
      Date.now() - new Date(recentOtp.createdAt).getTime() < 60 * 1000
    ) {
      const secondsLeft = Math.ceil(
        (60 * 1000 - (Date.now() - new Date(recentOtp.createdAt).getTime())) / 1000,
      );
      throw new BadRequestException(
        `Please wait ${secondsLeft} second${secondsLeft === 1 ? '' : 's'} before requesting another code.`,
      );
    }

    // Invalidate existing active OTPs for this email and role
    await this.otpRepository.update(
      { email, userType: detectedRole, isUsed: false },
      { isUsed: true },
    );

    // Generate secure 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await bcrypt.hash(otp, 10);

    const otpEntity = this.otpRepository.create({
      email,
      userType: detectedRole,
      otpHash,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      attempts: 0,
      isUsed: false,
    });
    await this.otpRepository.save(otpEntity);

    // Send email (or log to console in dev fallback mode)
    await this.mailService.sendOtpEmail(email, otp, detectedRole);

    return {
      message: 'If an account exists with this email address, a verification code has been sent.',
      role: detectedRole,
    };
  }

  /**
   * Verifies the 6-digit OTP and returns a signed single-use JWT reset token.
   */
  async verifyPasswordResetOtp(
    rawEmail: string,
    rawOtp: string,
    role?: ResetRole,
  ): Promise<{ message: string; resetToken: string; role: ResetRole }> {
    const email = rawEmail?.trim().toLowerCase();
    const otp = rawOtp?.trim();

    if (!email || !otp) {
      throw new BadRequestException('Email and verification code are required.');
    }

    const whereCondition: any = { email, isUsed: false };
    if (role) {
      whereCondition.userType = role;
    }

    const record = await this.otpRepository.findOne({
      where: whereCondition,
      order: { createdAt: 'DESC' },
    });

    if (!record) {
      throw new BadRequestException('The verification code is invalid or has expired.');
    }

    if (new Date() > new Date(record.expiresAt)) {
      throw new BadRequestException('The verification code has expired. Please request a new code.');
    }

    if (record.attempts >= 5) {
      throw new BadRequestException('Too many incorrect attempts. Please request a new code.');
    }

    const isValid = await bcrypt.compare(otp, record.otpHash);
    if (!isValid) {
      record.attempts += 1;
      await this.otpRepository.save(record);
      const remaining = 5 - record.attempts;
      throw new BadRequestException(
        remaining > 0
          ? `Invalid code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
          : 'Too many incorrect attempts. Please request a new code.',
      );
    }

    // Mark as used
    record.isUsed = true;
    await this.otpRepository.save(record);

    // Retrieve user id
    let userId = '';
    if (record.userType === 'visitor') {
      const visitor = await this.visitorService.getVisitorByEmail(record.email);
      if (!visitor) throw new NotFoundException('Visitor account not found');
      userId = visitor.id;
    } else {
      const vendor = await this.vendorService.getVendorByEmail(record.email);
      if (!vendor) throw new NotFoundException('Vendor account not found');
      userId = vendor.id;
    }

    // Create 15-minute reset JWT
    const resetToken = this.jwtService.sign(
      {
        sub: userId,
        email: record.email,
        role: record.userType,
        purpose: 'reset_password',
      },
      { expiresIn: '15m' },
    );

    return {
      message: 'Code verified successfully.',
      resetToken,
      role: record.userType,
    };
  }

  /**
   * Updates password after validating the resetToken JWT.
   */
  async resetPassword(
    resetToken: string,
    newPassword: string,
    role?: ResetRole,
  ): Promise<{ message: string; role: ResetRole }> {
    if (!resetToken) {
      throw new BadRequestException('Reset token is required.');
    }
    if (!newPassword || newPassword.length < 6) {
      throw new BadRequestException('Password must be at least 6 characters long.');
    }

    let decoded: any;
    try {
      decoded = this.jwtService.verify(resetToken, { secret: jwtSecret });
    } catch {
      throw new BadRequestException(
        'Your password reset session has expired or is invalid. Please request a new code.',
      );
    }

    if (decoded.purpose !== 'reset_password') {
      throw new BadRequestException('Invalid token purpose.');
    }

    const resolvedRole: ResetRole = role || decoded.role;
    if (resolvedRole === 'visitor') {
      await this.visitorService.updatePassword(decoded.sub, newPassword);
    } else {
      await this.vendorService.updatePassword(decoded.sub, newPassword);
    }

    return {
      message: 'Password reset successfully. You can now log in with your new password.',
      role: resolvedRole,
    };
  }

  /**
   * Validates Google ID token and creates or logs in Visitor/Vendor.
   */
  async googleAuth(idToken: string, role: 'visitor' | 'vendor' = 'visitor') {
    if (!idToken) {
      throw new BadRequestException('Google ID token is required.');
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const client = new OAuth2Client(clientId);

    let payload: TokenPayload | undefined;
    try {
      const ticket = await client.verifyIdToken({
        idToken,
        audience: clientId,
      });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException('Invalid Google ID token');
    }

    if (!payload || !payload.email) {
      throw new UnauthorizedException('Google account did not return an email address');
    }

    const email = payload.email.toLowerCase();

    if (role === 'visitor') {
      let visitor = await this.visitorService.getVisitorByEmail(email);
      let isNewUser = false;
      if (!visitor) {
        visitor = await this.visitorService.createGoogleVisitor({
          email,
          visitor_fname: payload.given_name || payload.name || 'Visitor',
          visitor_lname: payload.family_name || '',
          profile_pic_url: payload.picture,
        });
        isNewUser = true;
      }
      const { access_token } = this.loginVisitor(visitor);
      return {
        access_token,
        visitorId: visitor.id,
        visitorEmail: visitor.email,
        role: 'visitor' as const,
        isNewUser,
      };
    } else {
      let vendor = await this.vendorService.getVendorByEmail(email);
      let isNewUser = false;
      if (!vendor) {
        vendor = await this.vendorService.createGoogleVendor({
          email,
          fname: payload.given_name || payload.name || 'Vendor',
          lname: payload.family_name || '',
          profile_pic_url: payload.picture,
        });
        isNewUser = true;
      }
      const { access_token } = this.loginVendor(vendor);
      return {
        access_token,
        vendorId: vendor.id,
        vendorEmail: vendor.email,
        role: 'vendor' as const,
        isNewUser,
      };
    }
  }

  /**
   * Generates and sends a 6-digit OTP code to verify email before registration.
   */
  async requestSignupOtp(rawEmail: string, role: 'visitor' | 'vendor') {
    const email = rawEmail?.trim().toLowerCase();
    if (!email) {
      throw new BadRequestException('Email address is required.');
    }

    // Check if account already exists
    if (role === 'visitor') {
      const existing = await this.visitorService.getVisitorByEmail(email);
      if (existing) {
        throw new BadRequestException(
          'An account with this email address already exists. Please log in instead.',
        );
      }
    } else {
      const existing = await this.vendorService.getVendorByEmail(email);
      if (existing) {
        throw new BadRequestException(
          'A vendor account with this email address already exists. Please log in instead.',
        );
      }
    }

    // Cooldown check (60s)
    const recentOtp = await this.otpRepository.findOne({
      where: { email, userType: role, isUsed: false },
      order: { createdAt: 'DESC' },
    });

    if (
      recentOtp &&
      Date.now() - new Date(recentOtp.createdAt).getTime() < 60 * 1000
    ) {
      const secondsLeft = Math.ceil(
        (60 * 1000 - (Date.now() - new Date(recentOtp.createdAt).getTime())) / 1000,
      );
      throw new BadRequestException(
        `Please wait ${secondsLeft} second${secondsLeft === 1 ? '' : 's'} before requesting another verification code.`,
      );
    }

    // Invalidate existing active signup OTPs for this email and role
    await this.otpRepository.update(
      { email, userType: role, isUsed: false },
      { isUsed: true },
    );

    // Generate secure 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await bcrypt.hash(otp, 10);

    const otpEntity = this.otpRepository.create({
      email,
      userType: role,
      otpHash,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      attempts: 0,
      isUsed: false,
    });
    await this.otpRepository.save(otpEntity);

    await this.mailService.sendSignupOtpEmail(email, otp, role);

    return {
      message: 'Verification code sent to your email address.',
    };
  }

  /**
   * Verifies signup OTP and returns a signed single-use JWT token.
   */
  async verifySignupOtp(
    rawEmail: string,
    rawOtp: string,
    role: 'visitor' | 'vendor',
  ) {
    const email = rawEmail?.trim().toLowerCase();
    const otp = rawOtp?.trim();

    if (!email || !otp) {
      throw new BadRequestException('Email and verification code are required.');
    }

    const record = await this.otpRepository.findOne({
      where: { email, userType: role, isUsed: false },
      order: { createdAt: 'DESC' },
    });

    if (!record) {
      throw new BadRequestException('The verification code is invalid or has expired.');
    }

    if (new Date() > new Date(record.expiresAt)) {
      throw new BadRequestException('The verification code has expired. Please request a new code.');
    }

    if (record.attempts >= 5) {
      throw new BadRequestException('Too many incorrect attempts. Please request a new code.');
    }

    const isValid = await bcrypt.compare(otp, record.otpHash);
    if (!isValid) {
      record.attempts += 1;
      await this.otpRepository.save(record);
      const remaining = 5 - record.attempts;
      throw new BadRequestException(
        remaining > 0
          ? `Invalid code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
          : 'Too many incorrect attempts. Please request a new code.',
      );
    }

    // Mark as used
    record.isUsed = true;
    await this.otpRepository.save(record);

    // Issue 15-minute signup verification token
    const signupVerificationToken = this.jwtService.sign(
      {
        email,
        role,
        purpose: 'signup_verified',
      },
      { expiresIn: '15m' },
    );

    return {
      message: 'Email verified successfully.',
      signupVerificationToken,
    };
  }

  /**
   * Completes visitor registration after verifying signup token.
   */
  async completeVisitorSignup(dto: CompleteVisitorSignupDto) {
    let decoded: any;
    try {
      decoded = this.jwtService.verify(dto.signupVerificationToken, {
        secret: jwtSecret,
      });
    } catch {
      throw new BadRequestException(
        'Your verification session has expired. Please verify your email again.',
      );
    }

    if (decoded.purpose !== 'signup_verified' || decoded.role !== 'visitor') {
      throw new BadRequestException('Invalid verification token.');
    }

    const normalizedEmail = dto.email.trim().toLowerCase();
    if (decoded.email !== normalizedEmail) {
      throw new BadRequestException('Verified email does not match form email.');
    }

    const existing = await this.visitorService.getVisitorByEmail(normalizedEmail);
    if (existing) {
      throw new BadRequestException('An account with this email address already exists.');
    }

    const visitor = await this.visitorService.create({
      email: normalizedEmail,
      password: dto.password,
    });

    const { access_token } = this.loginVisitor(visitor);

    return {
      message: 'Registration successful!',
      access_token,
      visitorId: visitor.id,
      visitorEmail: visitor.email,
    };
  }

  /**
   * Completes vendor registration after verifying signup token.
   */
  async completeVendorSignup(dto: CompleteVendorSignupDto) {
    let decoded: any;
    try {
      decoded = this.jwtService.verify(dto.signupVerificationToken, {
        secret: jwtSecret,
      });
    } catch {
      throw new BadRequestException(
        'Your verification session has expired. Please verify your email again.',
      );
    }

    if (decoded.purpose !== 'signup_verified' || decoded.role !== 'vendor') {
      throw new BadRequestException('Invalid verification token.');
    }

    const normalizedEmail = dto.email.trim().toLowerCase();
    if (decoded.email !== normalizedEmail) {
      throw new BadRequestException('Verified email does not match form email.');
    }

    const existing = await this.vendorService.getVendorByEmail(normalizedEmail);
    if (existing) {
      throw new BadRequestException('A vendor with this email address already exists.');
    }

    const vendor = await this.vendorService.createVendor({
      email: normalizedEmail,
      password: dto.password,
      fname: dto.fname || 'Vendor',
      lname: dto.lname || '',
      busname: dto.busname || 'My Business',
      phone: dto.phone || '',
      city: dto.city || '',
      location: dto.location || '',
    });

    const { access_token } = this.loginVendor(vendor);

    return {
      message: 'Vendor registration successful!',
      access_token,
      vendorId: vendor.id,
      vendorEmail: vendor.email,
    };
  }
}