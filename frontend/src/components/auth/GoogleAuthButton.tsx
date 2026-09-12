'use client';

import React, { useState } from 'react';
import { GoogleLogin, CredentialResponse } from '@react-oauth/google';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { googleAuthApi } from '@/api/auth/google.auth.api';
import { useAuth as useVisitorAuth } from '@/contexts/VisitorAuthContext';
import { useVendorAuth } from '@/contexts/VendorAuthContext';

interface GoogleAuthButtonProps {
  role?: 'visitor' | 'vendor';
  text?: 'signin_with' | 'signup_with' | 'continue_with';
  redirectTo?: string;
}

export default function GoogleAuthButton({
  role = 'visitor',
  text = 'continue_with',
  redirectTo,
}: GoogleAuthButtonProps) {
  const router = useRouter();
  const visitorAuth = useVisitorAuth();
  const vendorAuth = useVendorAuth();
  const [loading, setLoading] = useState(false);

  const handleSuccess = async (credentialResponse: CredentialResponse) => {
    if (!credentialResponse.credential) {
      toast.error('No credential received from Google.');
      return;
    }

    setLoading(true);
    const toastId = toast.loading('Signing in with Google...', {
      style: { background: '#333', color: '#fff' },
    });

    try {
      const response = await googleAuthApi(credentialResponse.credential, role);

      if (response && response.access_token) {
        if (role === 'vendor') {
          vendorAuth.login(response.access_token);
        } else {
          visitorAuth.login(response.access_token);
        }

        toast.success(
          response.isNewUser
            ? 'Account created and signed in with Google!'
            : 'Welcome back!',
          { id: toastId, style: { background: '#333', color: '#fff' } },
        );

        const target =
          redirectTo ||
          (role === 'vendor'
            ? (response.isNewUser ? '/vendor-onboarding' : '/vendor-dashboard')
            : '/visitor-dashboard');
        router.push(target);
      } else {
        toast.error('Failed to retrieve authentication token.', { id: toastId });
      }
    } catch (err: any) {
      const errorMsg =
        err?.response?.data?.message || 'Google authentication failed. Please try again.';
      toast.error(errorMsg, {
        id: toastId,
        style: { background: '#333', color: '#fff' },
      });
    } finally {
      setLoading(false);
    }
  };

  const handleError = () => {
    toast.error('Google Sign-In was cancelled or failed.', {
      style: { background: '#333', color: '#fff' },
    });
  };

  return (
    <div className="w-full flex flex-col items-center justify-center my-2">
      <div className={`w-full flex justify-center ${loading ? 'opacity-50 pointer-events-none' : ''}`}>
        <GoogleLogin
          onSuccess={handleSuccess}
          onError={handleError}
          text={text}
          theme="outline"
          size="large"
          shape="rectangular"
          width="100%"
        />
      </div>
    </div>
  );
}
