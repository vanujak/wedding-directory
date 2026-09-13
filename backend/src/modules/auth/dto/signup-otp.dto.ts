export class RequestSignupOtpDto {
  email: string;
  role: 'visitor' | 'vendor';
}

export class VerifySignupOtpDto {
  email: string;
  otp: string;
  role: 'visitor' | 'vendor';
}

export class CompleteVisitorSignupDto {
  email: string;
  password: string;
  signupVerificationToken: string;
}

export class CompleteVendorSignupDto {
  email: string;
  password: string;
  fname?: string;
  lname?: string;
  busname?: string;
  phone?: string;
  city?: string;
  location?: string;
  signupVerificationToken: string;
}
