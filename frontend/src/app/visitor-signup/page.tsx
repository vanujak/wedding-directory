'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useRouter } from 'next/navigation';
import { useAuth } from "@/contexts/VisitorAuthContext";
import { toast } from 'react-hot-toast';
import Image from 'next/image';
import Header from '@/components/shared/Headers/Header';
import GoogleAuthButton from '@/components/auth/GoogleAuthButton';
import LoaderJelly from "@/components/shared/Loaders/LoaderJelly";
import {
  requestSignupOtp,
  verifySignupOtp,
  completeVisitorSignup,
} from '@/api/auth/signup-otp.api';
import { Mail, ArrowLeft, KeyRound } from 'lucide-react';
import OtpInput from "@/components/auth/OtpInput";

const SignupPage: React.FC = () => {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [otp, setOtp] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Step 1: Enter email & password, Step 2: Enter 6-digit OTP
  const [step, setStep] = useState<1 | 2>(1);

  // Resend cooldown timer
  const [resendTimer, setResendTimer] = useState<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const router = useRouter();
  const { login } = useAuth();

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
      const response = await requestSignupOtp(trimmedEmail, 'visitor');
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
      const response = await requestSignupOtp(email.trim(), 'visitor');
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

  // Step 2: Verify OTP and complete visitor account creation
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
      const verifyRes = await verifySignupOtp(email.trim(), cleanOtp, 'visitor');
      
      // 2. Complete registration
      const signupRes = await completeVisitorSignup(
        email.trim(),
        password,
        verifyRes.signupVerificationToken,
      );

      if (signupRes && signupRes.access_token) {
        toast.success('Successfully Registered & Verified!', {
          style: { background: '#333', color: '#fff' },
        });

        login(signupRes.access_token);
        router.push('/pageone');
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
          src="/images/hero.webp"
          alt="Login Background"
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
                Create your couple account to plan your dream wedding.
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

                <div className="mt-6 flex space-x-2 items-center justify-center">
                  <Checkbox id="terms" defaultChecked />
                  <label className="text-sm text-center leading-none text-gray-600">
                    Send me wedding tips, ideas and special offers
                  </label>
                </div>

                <div className="mt-6 flex flex-col w-full">
                  <Button
                    className="rounded-none text-white font-bold hover:bg-orange bg-orange text-lg h-12"
                    type="submit"
                    disabled={isLoading}
                  >
                    Continue with Email
                  </Button>
                </div>

                <div className="flex items-center my-4">
                  <div className="flex-grow border-t border-gray-300"></div>
                  <span className="flex-shrink mx-3 text-gray-400 text-xs uppercase font-medium">or</span>
                  <div className="flex-grow border-t border-gray-300"></div>
                </div>

                <GoogleAuthButton role="visitor" text="signup_with" />

                <div className='text-center mt-4'>
                  <label htmlFor="terms" className="text-sm leading-none text-gray-600">
                    Already have an account?{' '}
                    <Link href="/visitor-login" className="text-orange hover:underline font-semibold">
                      Sign In
                    </Link>
                  </label>
                </div>

                <hr className="border-t-2 border-gray-300 my-4" />

                <div className="text-center mt-2">
                  <label
                    htmlFor="terms"
                    className="text-sm font-bold leading-none text-gray-700"
                  >
                    Are you a wedding service provider?{" "}
                    <Link href="/vendor-signup" className="text-orange hover:underline">
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
                We sent a 6-digit verification code to <br />
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
                    type="submit"
                    className="rounded-none text-white font-bold hover:bg-orange bg-orange text-base sm:text-lg h-12"
                    disabled={isLoading}
                  >
                    Verify & Create Account
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
                    Edit email
                  </button>

                  {resendTimer > 0 ? (
                    <span className="text-gray-400">
                      Resend in {resendTimer}s
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      className="text-orange font-semibold hover:underline"
                    >
                      Resend Code
                    </button>
                  )}
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SignupPage;
