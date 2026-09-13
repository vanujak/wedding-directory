'use client';

import Header from "@/components/shared/Headers/Header";
import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from 'react-hot-toast';
import { useVendorAuth } from '@/contexts/VendorAuthContext';
import GoogleAuthButton from '@/components/auth/GoogleAuthButton';
import LoaderJelly from "@/components/shared/Loaders/LoaderJelly";
import {
  requestSignupOtp,
  verifySignupOtp,
  completeVendorSignup,
} from '@/api/auth/signup-otp.api';
import { Mail, ArrowLeft } from 'lucide-react';
import OtpInput from "@/components/auth/OtpInput";

const Signup: React.FC = () => {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [otp, setOtp] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [termsAccepted, setTermsAccepted] = useState<boolean>(true);

  // Step 1: Enter email & passwords, Step 2: Enter 6-digit OTP
  const [step, setStep] = useState<1 | 2>(1);

  // Resend cooldown timer
  const [resendTimer, setResendTimer] = useState<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const router = useRouter();
  const { login } = useVendorAuth();

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

  // Step 1: Request Signup OTP
  const handleInitiateSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password || !confirmPassword) {
      setError('Email, password, and confirmation are required.');
      return;
    }

    if (!termsAccepted) {
      setError('You must accept the terms of use and privacy policy.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await requestSignupOtp(trimmedEmail, 'vendor');
      toast.success(response.message || 'Verification code sent to your email!', {
        style: { background: '#333', color: '#fff' },
      });
      setResendTimer(60);
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
      const response = await requestSignupOtp(email.trim(), 'vendor');
      toast.success(response.message || 'A new verification code has been sent.', {
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

  // Step 2: Verify OTP and complete vendor registration
  const handleVerifyAndRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanOtp = otp.trim();
    if (!cleanOtp || cleanOtp.length !== 6) {
      setError('Please enter the 6-digit verification code.');
      return;
    }

    setIsLoading(true);
    try {
      // 1. Verify OTP
      const verifyRes = await verifySignupOtp(email.trim(), cleanOtp, 'vendor');

      // 2. Complete Vendor Registration with initial credentials
      const signupRes = await completeVendorSignup(
        {
          email: email.trim(),
          password,
          fname: 'Vendor',
          lname: '',
          busname: 'My Business',
        },
        verifyRes.signupVerificationToken,
      );

      if (signupRes && signupRes.access_token) {
        toast.success('Account created! Now set up your business details.', {
          style: { background: '#333', color: '#fff' },
        });

        login(signupRes.access_token);
        router.push('/vendor-onboarding');
      } else {
        setError('Registration succeeded, but login failed. Please sign in.');
      }
    } catch (err: any) {
      const errorMsg =
        err?.response?.data?.message || 'Verification failed. Please check the code and try again.';
      setError(errorMsg);
      toast.error(errorMsg, {
        style: { background: '#333', color: '#fff' },
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className='relative w-full min-h-screen overflow-hidden'>
      {/* Header */}
      <div className="relative z-10">
        <Header />
      </div>

      {/* Background Image */}
      <div className="absolute inset-0">
        <Image
          src="/images/login-signup.webp"
          alt="Vendor Sign Up Background"
          className="object-cover"
          fill
          priority
        />
        <div className="absolute inset-0 bg-black opacity-50"></div>
      </div>

      <div className='relative z-20 flex min-h-[calc(100vh-92px)] justify-center items-center px-4 py-10'>
        <div className='bg-white w-full max-w-[450px] rounded-md p-6 sm:p-8 font-body shadow-lg relative'>
          {/* Loader Overlay */}
          {isLoading && (
            <div className="absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center z-30 rounded-md">
              <LoaderJelly />
            </div>
          )}

          {/* STEP 1: ENTER DETAILS */}
          {step === 1 && (
            <>
              <h1 className='text-3xl font-bold text-center font-title'>
                Welcome to Say I Do
              </h1>
              <p className="text-sm text-gray-500 text-center mt-2">
                Create your vendor account to showcase your services.
              </p>

              <form onSubmit={handleInitiateSignup} className="mt-6">
                <div className="grid grid-cols-1 w-full items-center gap-y-4">
                  <div className="border-black border-solid border-2 border-opacity-70 rounded-md flex flex-row space-y-1.5">
                    <Input
                      className="h-12 pl-6 pb-3 text-base"
                      type="email"
                      id="email"
                      placeholder="Email Address"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="border-black border-solid border-2 border-opacity-70 rounded-md flex flex-row space-y-1.5">
                    <Input
                      className="h-12 pl-6 pb-3 text-base"
                      type="password"
                      id="password"
                      placeholder="Password (min 6 characters)"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  <div className="border-black border-solid border-2 border-opacity-70 rounded-md flex flex-row space-y-1.5">
                    <Input
                      className="h-12 pl-6 pb-3 text-base"
                      type="password"
                      id="confirmPassword"
                      placeholder="Confirm Password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {error && (
                  <p className="text-red-500 text-sm mt-2.5 text-center">{error}</p>
                )}

                <div className="mt-6 flex space-x-2 items-center justify-center text-left">
                  <Checkbox
                    id="terms"
                    checked={termsAccepted}
                    onCheckedChange={(checked) => setTermsAccepted(!!checked)}
                  />
                  <label htmlFor="terms" className="text-xs text-gray-600 leading-snug cursor-pointer select-none">
                    By submitting, you agree to the{' '}
                    <Link href="/terms-of-use" target="_blank" className="underline text-orange">
                      terms of use
                    </Link>{' '}
                    and{' '}
                    <Link href="/privacy-policy" target="_blank" className="underline text-orange">
                      privacy policy
                    </Link>.
                  </label>
                </div>

                <div className="mt-6 flex flex-col w-full">
                  <Button
                    className="rounded-none text-white font-bold hover:bg-orange bg-orange text-lg h-12"
                    type="submit"
                    disabled={isLoading || !termsAccepted}
                  >
                    Continue with Email
                  </Button>
                </div>

                <div className="flex items-center my-4">
                  <div className="flex-grow border-t border-gray-300"></div>
                  <span className="flex-shrink mx-3 text-gray-400 text-xs uppercase font-medium">or</span>
                  <div className="flex-grow border-t border-gray-300"></div>
                </div>

                <GoogleAuthButton role="vendor" text="signup_with" />

                <div className='text-center mt-4'>
                  <label className="text-sm leading-none text-gray-600">
                    Already have an account?{' '}
                    <Link href="/vendor-login" className="text-orange hover:underline font-semibold">
                      Sign In
                    </Link>
                  </label>
                </div>

                <hr className="border-t-2 border-gray-300 my-4" />

                <div className="text-center mt-2">
                  <label
                    className="text-sm font-bold leading-none text-gray-700"
                  >
                    Are you a couple planning a wedding?{" "}
                    <Link href="/visitor-signup" className="text-orange hover:underline">
                      Start from here
                    </Link>
                  </label>
                </div>
              </form>
            </>
          )}

          {/* STEP 2: VERIFY OTP CODE */}
          {step === 2 && (
            <>
              <div className="w-12 h-12 bg-orange/10 text-orange rounded-full flex items-center justify-center mx-auto mb-3">
                <Mail className="w-6 h-6 text-orange" />
              </div>

              <h1 className="text-3xl font-bold text-center font-title text-gray-900">
                Verify Your Email
              </h1>
              <p className="text-sm text-gray-600 text-center mt-2">
                Enter the 6-digit verification code sent to <br />
                <span className="font-semibold text-gray-800">{email}</span>
              </p>

              <form onSubmit={handleVerifyAndRegister} className="mt-6">
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
                    className="rounded-none text-white font-bold hover:bg-orange bg-orange text-lg h-12"
                    type="submit"
                    disabled={isLoading}
                  >
                    Verify & Continue
                  </Button>
                </div>

                <div className="mt-4 flex items-center justify-between text-sm">
                  <button
                    type="button"
                    onClick={() => {
                      setStep(1);
                      setError(null);
                    }}
                    className="text-gray-500 hover:text-gray-800 flex items-center gap-1"
                  >
                    <ArrowLeft className="w-4 h-4" /> Change Email
                  </button>

                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={resendTimer > 0 || isLoading}
                    className={`font-medium ${
                      resendTimer > 0
                        ? 'text-gray-400 cursor-not-allowed'
                        : 'text-orange hover:underline'
                    }`}
                  >
                    {resendTimer > 0
                      ? `Resend in ${resendTimer}s`
                      : 'Resend Code'}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Signup;
