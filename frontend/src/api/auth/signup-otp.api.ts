import request from '../../utils/request';

export interface RequestSignupOtpResponse {
  message: string;
}

export interface VerifySignupOtpResponse {
  message: string;
  signupVerificationToken: string;
}

export interface CompleteVisitorSignupResponse {
  message: string;
  access_token: string;
  visitorId: string;
  visitorEmail: string;
}

export interface CompleteVendorSignupResponse {
  message: string;
  access_token: string;
  vendorId: string;
  vendorEmail: string;
}

export const requestSignupOtp = async (
  email: string,
  role: 'visitor' | 'vendor',
): Promise<RequestSignupOtpResponse> => {
  const response = await request.post<RequestSignupOtpResponse>(
    '/auth/signup/request-otp',
    { email, role },
  );
  return response.data;
};

export const verifySignupOtp = async (
  email: string,
  otp: string,
  role: 'visitor' | 'vendor',
): Promise<VerifySignupOtpResponse> => {
  const response = await request.post<VerifySignupOtpResponse>(
    '/auth/signup/verify-otp',
    { email, otp, role },
  );
  return response.data;
};

export const completeVisitorSignup = async (
  email: string,
  password: string,
  signupVerificationToken: string,
): Promise<CompleteVisitorSignupResponse> => {
  const response = await request.post<CompleteVisitorSignupResponse>(
    '/auth/signup/complete-visitor',
    { email, password, signupVerificationToken },
    { withCredentials: true },
  );
  return response.data;
};

export const completeVendorSignup = async (
  vendorData: {
    email: string;
    password: string;
    fname?: string;
    lname?: string;
    busname?: string;
    phone?: string;
    city?: string;
    location?: string;
  },
  signupVerificationToken: string,
): Promise<CompleteVendorSignupResponse> => {
  const response = await request.post<CompleteVendorSignupResponse>(
    '/auth/signup/complete-vendor',
    { ...vendorData, signupVerificationToken },
    { withCredentials: true },
  );
  return response.data;
};
