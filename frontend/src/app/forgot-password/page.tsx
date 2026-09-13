'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import Header from '@/components/shared/Headers/Header';
import Image from 'next/image';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'react-hot-toast';
import LoaderJelly from '@/components/shared/Loaders/LoaderJelly';
import OtpInput from '@/components/auth/OtpInput';
import {
  requestPasswordResetOtp,
  verifyPasswordResetOtp,
  resetPassword,
  UserRole,
} from '@/api/auth/password-reset.api';
import { Eye, EyeOff, CheckCircle2, ArrowLeft, Mail, KeyRound } from 'lucide-react';

const ForgotPasswordForm = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialRoleParam = searchParams.get('role');
  const [role, setRole] = useState<UserRole>(
    initialRoleParam === 'vendor' ? 'vendor' : 'visitor',
  );

  // Wizard step: 1 = Request OTP, 2 = Verify OTP, 3 = Reset Password, 4 = Done
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resend cooldown timer
  const [resendTimer, setResendTimer] = useState<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (resendTimer > 0) {
      timerRef.current = setTimeout(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [resendTimer]);

  // Step 1: Request OTP
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Please enter your email address.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await requestPasswordResetOtp(trimmedEmail, role);
      toast.success(response.message || 'Verification code sent to your email!', {
        style: { background: '#333', color: '#fff' },
      });
      setResendTimer(60);
      setOtp('');
      setStep(2);
    } catch (err: any) {
      const errorMsg =
        err?.response?.data?.message || 'Failed to send verification code. Please try again.';
      setError(errorMsg);
      toast.error(errorMsg, {
        style: { background: '#333', color: '#fff' },
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (resendTimer > 0) return;
    setError(null);
    setIsLoading(true);
    try {
      const response = await requestPasswordResetOtp(email.trim(), role);
      toast.success(response.message || 'A new code has been sent.', {
        style: { background: '#333', color: '#fff' },
      });
      setResendTimer(60);
    } catch (err: any) {
      const errorMsg =
        err?.response?.data?.message || 'Failed to resend code. Please try again.';
      setError(errorMsg);
      toast.error(errorMsg, {
        style: { background: '#333', color: '#fff' },
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanOtp = otp.trim();
    if (!cleanOtp || cleanOtp.length !== 6) {
      setError('Please enter the 6-digit verification code.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await verifyPasswordResetOtp(email.trim(), cleanOtp, role);
      setResetToken(response.resetToken);
      toast.success('Code verified successfully!', {
        style: { background: '#333', color: '#fff' },
      });
      setStep(3);
    } catch (err: any) {
      const errorMsg =
        err?.response?.data?.message || 'Invalid or expired verification code.';
      setError(errorMsg);
      toast.error(errorMsg, {
        style: { background: '#333', color: '#fff' },
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Step 3: Reset Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await resetPassword(resetToken, newPassword, role);
      toast.success(response.message || 'Password updated successfully!', {
        style: { background: '#333', color: '#fff' },
      });
      setStep(4);
    } catch (err: any) {
      const errorMsg =
        err?.response?.data?.message || 'Failed to reset password. Please try again.';
      setError(errorMsg);
      toast.error(errorMsg, {
        style: { background: '#333', color: '#fff' },
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loginRoute = role === 'vendor' ? '/login' : '/visitor-login';

  return (
    <div className="bg-white w-full max-w-[460px] rounded-md p-6 sm:p-8 font-body shadow-lg relative transition-all">
      {/* Loader Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center z-30 rounded-md">
          <LoaderJelly />
        </div>
      )}

      {/* STEP 1: REQUEST OTP */}
      {step === 1 && (
        <>
          <h1 className="text-3xl sm:text-4xl font-bold text-center font-title text-gray-900">
            Forgot Password
          </h1>
          <p className="text-sm text-gray-500 text-center mt-2">
            Select your account type and enter your email address to receive a 6-digit OTP code.
          </p>

          {/* Account Type Selector Tabs */}
          <div className="flex border border-gray-300 rounded-md overflow-hidden mt-6">
            <button
              type="button"
              onClick={() => {
                setRole('visitor');
                setError(null);
              }}
              className={`flex-1 py-2.5 text-xs sm:text-sm font-semibold text-center transition-colors ${
                role === 'visitor'
                  ? 'bg-orange text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Couple / Visitor
            </button>
            <button
              type="button"
              onClick={() => {
                setRole('vendor');
                setError(null);
              }}
              className={`flex-1 py-2.5 text-xs sm:text-sm font-semibold text-center transition-colors ${
                role === 'vendor'
                  ? 'bg-orange text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Wedding Vendor
            </button>
          </div>

          <form onSubmit={handleRequestOtp} className="mt-6">
            <div className="border-black border-solid border-2 border-opacity-70 rounded-md flex flex-row space-y-1.5">
              <Input
                className="h-12 pl-6 pb-3 text-base"
                type="email"
                id="email"
                placeholder="Enter your registered email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            {error && (
              <p className="text-red-500 text-sm text-center mt-2.5">{error}</p>
            )}

            <div className="mt-6 flex flex-col w-full">
              <Button
                type="submit"
                className="rounded-none text-white font-bold hover:bg-orange bg-orange text-base sm:text-lg h-12"
              >
                Send Verification Code
              </Button>
            </div>

            <div className="text-center mt-4">
              <Link
                href={loginRoute}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-orange hover:underline transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Log In
              </Link>
            </div>
          </form>
        </>
      )}

      {/* STEP 2: VERIFY OTP */}
      {step === 2 && (
        <>
          <div className="w-12 h-12 bg-orange/10 text-orange rounded-full flex items-center justify-center mx-auto mb-3">
            <Mail className="w-6 h-6 text-orange" />
          </div>

          <h1 className="text-3xl font-bold text-center font-title text-gray-900">
            Verify Code
          </h1>
          <p className="text-sm text-gray-600 text-center mt-2">
            We sent a 6-digit OTP code to <br />
            <span className="font-semibold text-gray-800">{email}</span>
          </p>

          <form onSubmit={handleVerifyOtp} className="mt-6">
            <OtpInput
              length={6}
              value={otp}
              onChange={(val) => setOtp(val)}
              disabled={isLoading}
            />

            {error && (
              <p className="text-red-500 text-sm text-center mt-2.5">{error}</p>
            )}

            <div className="mt-6 flex flex-col w-full">
              <Button
                type="submit"
                disabled={isLoading}
                className="rounded-none text-white font-bold hover:bg-orange bg-orange text-base sm:text-lg h-12"
              >
                Verify Code
              </Button>
            </div>

            <div className="flex items-center justify-between text-xs sm:text-sm mt-5">
              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  setOtp('');
                  setError(null);
                }}
                className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-800 underline"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Change email
              </button>

              {resendTimer > 0 ? (
                <span className="text-gray-400">
                  Resend in {resendTimer}s
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={isLoading}
                  className="text-orange font-semibold hover:underline"
                >
                  Resend Code
                </button>
              )}
            </div>
          </form>
        </>
      )}

      {/* STEP 3: RESET PASSWORD */}
      {step === 3 && (
        <>
          <div className="w-12 h-12 bg-orange/10 text-orange rounded-full flex items-center justify-center mx-auto mb-3">
            <KeyRound className="w-6 h-6 text-orange" />
          </div>

          <h1 className="text-3xl font-bold text-center font-title text-gray-900">
            New Password
          </h1>
          <p className="text-sm text-gray-500 text-center mt-2">
            Create a strong new password for your account.
          </p>

          <form onSubmit={handleResetPassword} className="mt-6">
            <div className="space-y-4">
              <div className="border-black border-solid border-2 border-opacity-70 rounded-md flex items-center relative">
                <Input
                  className="h-12 pl-6 pr-12 pb-3 text-base border-none"
                  type={showPassword ? 'text' : 'password'}
                  id="newPassword"
                  placeholder="New Password (min 6 chars)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>

              <div className="border-black border-solid border-2 border-opacity-70 rounded-md flex items-center relative">
                <Input
                  className="h-12 pl-6 pr-12 pb-3 text-base border-none"
                  type={showConfirmPassword ? 'text' : 'password'}
                  id="confirmPassword"
                  placeholder="Confirm New Password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 text-gray-500 hover:text-gray-700"
                >
                  {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-red-500 text-sm text-center mt-2.5">{error}</p>
            )}

            <div className="mt-6 flex flex-col w-full">
              <Button
                type="submit"
                className="rounded-none text-white font-bold hover:bg-orange bg-orange text-base sm:text-lg h-12"
              >
                Reset Password
              </Button>
            </div>
          </form>
        </>
      )}

      {/* STEP 4: SUCCESS STATE */}
      {step === 4 && (
        <div className="text-center py-4">
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <h1 className="text-3xl font-bold font-title text-gray-900">
            Password Reset!
          </h1>
          <p className="text-sm text-gray-600 mt-2">
            Your password has been successfully updated. You can now log in with your new credentials.
          </p>

          <div className="mt-8">
            <Button
              onClick={() => router.push(loginRoute)}
              className="w-full rounded-none text-white font-bold hover:bg-orange bg-orange text-base sm:text-lg h-12"
            >
              Go to {role === 'vendor' ? 'Vendor' : 'User'} Log In
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

const ForgotPasswordPage = () => {
  return (
    <div className="relative w-full min-h-screen overflow-hidden">
      {/* Header */}
      <div className="relative z-10">
        <Header />
      </div>

      {/* Hero Background */}
      <div className="absolute inset-0">
        <Image
          src="/images/hero.webp"
          alt="Password Reset Background"
          className="object-cover"
          fill
          priority
        />
        <div className="absolute inset-0 bg-black opacity-50"></div>
      </div>

      {/* Card Form with Suspense boundary for useSearchParams */}
      <div className="relative z-20 flex min-h-[calc(100vh-92px)] justify-center items-center px-4 py-10">
        <Suspense
          fallback={
            <div className="bg-white w-full max-w-[460px] rounded-md p-8 shadow-lg flex items-center justify-center min-h-[300px]">
              <LoaderJelly />
            </div>
          }
        >
          <ForgotPasswordForm />
        </Suspense>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
