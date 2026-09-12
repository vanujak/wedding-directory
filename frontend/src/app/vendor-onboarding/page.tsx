'use client';

import React, { useState, useEffect } from 'react';
import Header from '@/components/shared/Headers/Header';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useVendorAuth } from '@/contexts/VendorAuthContext';
import { useQuery, useMutation } from '@apollo/client';
import { GET_VENDOR_BY_ID } from '@/graphql/queries';
import { UPDATE_VENDOR } from '@/graphql/mutations';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import CityInput from '@/components/vendor-signup/CityInput';
import LocationInput from '@/components/vendor-signup/LocationInput';
import LoaderQuantum from '@/components/shared/Loaders/LoaderQuantum';
import { toast } from 'react-hot-toast';
import { Building2, User, Phone, MapPin, CheckCircle2, ArrowRight } from 'lucide-react';

export default function VendorOnboardingPage() {
  const router = useRouter();
  const { vendor, isAuthenticated, logout } = useVendorAuth();

  const [fname, setFname] = useState('');
  const [lname, setLname] = useState('');
  const [busname, setBusname] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [location, setLocation] = useState('');
  const [initialized, setInitialized] = useState(false);

  // Fetch current vendor info (especially if signed up via Google)
  const { data, loading: fetchingVendor } = useQuery(GET_VENDOR_BY_ID, {
    variables: { id: vendor?.id },
    skip: !vendor?.id,
    fetchPolicy: 'network-only',
  });

  const [updateVendor, { loading: isSubmitting }] = useMutation(UPDATE_VENDOR);

  const [isSavingDraft, setIsSavingDraft] = useState(false);

  useEffect(() => {
    // If not authenticated, redirect to login
    if (!isAuthenticated && !vendor) {
      const timer = setTimeout(() => {
        if (!isAuthenticated) router.push('/vendor-login');
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, vendor, router]);

  useEffect(() => {
    if (data?.findVendorById && !initialized) {
      const v = data.findVendorById;
      if (v.fname && v.fname !== 'Vendor') setFname(v.fname);
      if (v.lname) setLname(v.lname);
      if (v.busname && v.busname !== 'My Business' && !v.busname.endsWith("'s Services")) {
        setBusname(v.busname);
      }
      if (v.phone) setPhone(v.phone);
      if (v.city) setCity(v.city);
      if (v.location) setLocation(v.location);
      setInitialized(true);
    }
  }, [data, initialized]);

  const handleSaveAndFinishLater = async () => {
    if (!vendor?.id) {
      toast.error('Session expired. Please log in again.');
      router.push('/vendor-login');
      return;
    }

    try {
      setIsSavingDraft(true);
      // Save whatever fields have been entered so far
      const inputToSave: any = {};
      if (fname.trim()) inputToSave.fname = fname.trim();
      if (lname.trim()) inputToSave.lname = lname.trim();
      if (busname.trim()) inputToSave.busname = busname.trim();
      if (phone.trim()) inputToSave.phone = phone.trim();
      if (city.trim()) inputToSave.city = city.trim();
      if (location.trim()) inputToSave.location = location.trim();

      if (Object.keys(inputToSave).length > 0) {
        await updateVendor({
          variables: {
            id: vendor.id,
            input: inputToSave,
          },
        });
      }

      toast.success('Progress saved! You can resume setting up anytime.', {
        duration: 4000,
        style: { background: '#333', color: '#fff' },
      });

      // Clear session so they can log back in whenever ready to resume
      logout();
      router.push('/vendor-login');
    } catch (err: any) {
      console.error('Failed to save draft:', err);
      toast.error(err?.message || 'Failed to save progress.');
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!vendor?.id) {
      toast.error('Session expired. Please log in again.');
      router.push('/vendor-login');
      return;
    }

    if (!busname.trim()) {
      toast.error('Please enter your business or brand name.');
      return;
    }

    if (!fname.trim() || !lname.trim()) {
      toast.error('Please enter your first and last name.');
      return;
    }

    if (!phone.trim()) {
      toast.error('Please enter your business contact phone number.');
      return;
    }

    if (!city.trim()) {
      toast.error('Please select your primary city.');
      return;
    }

    if (!location.trim()) {
      toast.error('Please search and select your business location/area.');
      return;
    }

    try {
      await updateVendor({
        variables: {
          id: vendor.id,
          input: {
            fname: fname.trim(),
            lname: lname.trim(),
            busname: busname.trim(),
            phone: phone.trim(),
            city: city.trim(),
            location: location.trim(),
          },
        },
      });

      toast.success('Business profile setup complete! Welcome to your dashboard.', {
        style: { background: '#333', color: '#fff' },
      });

      router.push('/vendor-dashboard');
    } catch (err: any) {
      console.error('Failed to complete onboarding:', err);
      toast.error(err?.message || 'Failed to save business details. Please try again.');
    }
  };

  if (fetchingVendor) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-lightYellow">
        <LoaderQuantum />
      </div>
    );
  }

  return (
    <div className="relative w-full min-h-screen bg-lightYellow font-body overflow-x-hidden">
      <div className="relative z-20">
        <Header />
      </div>

      <div className="container mx-auto px-4 py-8 max-w-3xl">
        {/* Progress indicator */}
        <div className="mb-6 bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange/10 flex items-center justify-center text-orange font-bold text-sm">
              2/2
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-orange">Final Step</p>
              <h2 className="text-base font-bold text-gray-900">Set Up Your Business Profile</h2>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs text-gray-400 font-medium">
            <span className="flex items-center gap-1 text-emerald-600 font-semibold">
              <CheckCircle2 className="w-4 h-4" /> Account Verified
            </span>
            <span>&rarr;</span>
            <span className="text-orange font-semibold">Business Info</span>
          </div>
        </div>

        {/* Main form card */}
        <div className="bg-white rounded-2xl p-6 sm:p-10 shadow-sm border border-gray-100">
          <div className="text-center max-w-lg mx-auto mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold font-title text-gray-900">
              Tell couples about your business
            </h1>
            <p className="text-sm text-gray-500 mt-2">
              These details help couples find, recognize, and connect with your services on Say I Do.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Business Name */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                Business / Brand Name <span className="text-orange">*</span>
              </label>
              <div className="relative">
                <Input
                  type="text"
                  placeholder="e.g. Royal Blooms Floral Design"
                  value={busname}
                  onChange={(e) => setBusname(e.target.value)}
                  className="h-12 pl-3 pr-3 text-sm rounded-xl border-2 border-gray-200 focus:border-orange focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none font-medium transition-colors"
                  required
                />
              </div>
              <p className="text-[11px] text-gray-400 mt-1">
                This is the primary name that couples will see on your packages and listings.
              </p>
            </div>

            {/* Owner Names */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                  First Name <span className="text-orange">*</span>
                </label>
                <Input
                  type="text"
                  placeholder="First name"
                  value={fname}
                  onChange={(e) => setFname(e.target.value)}
                  className="h-12 pl-3 pr-3 text-sm rounded-xl border-2 border-gray-200 focus:border-orange focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none transition-colors"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                  Last Name <span className="text-orange">*</span>
                </label>
                <Input
                  type="text"
                  placeholder="Last name"
                  value={lname}
                  onChange={(e) => setLname(e.target.value)}
                  className="h-12 pl-3 pr-3 text-sm rounded-xl border-2 border-gray-200 focus:border-orange focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none transition-colors"
                  required
                />
              </div>
            </div>

            {/* Phone Number */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                Business Phone Number <span className="text-orange">*</span>
              </label>
              <Input
                type="tel"
                placeholder="e.g. 077 123 4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-12 pl-3 pr-3 text-sm rounded-xl border-2 border-gray-200 focus:border-orange focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none transition-colors"
                required
              />
              <p className="text-[11px] text-gray-400 mt-1">
                Used for account notifications and booking alerts.
              </p>
            </div>

            {/* City */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                Primary City <span className="text-orange">*</span>
              </label>
              <div className="rounded-xl overflow-hidden">
                <CityInput
                  placeholder={city || "Select your city"}
                  onCityChange={(selectedCity) => setCity(selectedCity)}
                  className="border-2 border-gray-200 rounded-xl flex flex-row space-y-1.5 bg-white hover:border-orange transition-colors h-12"
                />
              </div>
              <p className="text-[11px] text-gray-400 mt-1">
                Helps couples filter services by their wedding destination.
              </p>
            </div>

            {/* Location / Area Search */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                Business Location / Address <span className="text-orange">*</span>
              </label>
              <LocationInput
                placeholder={location || "Search street address or landmark for Google Maps"}
                onLocationChange={(selectedLocation) => setLocation(selectedLocation)}
                className="border-2 border-gray-200 rounded-xl flex flex-col relative bg-white hover:border-orange transition-colors h-12"
              />
              <p className="text-[11px] text-gray-400 mt-1">
                Used to pin your exact location on Google Maps on your service profile.
              </p>
            </div>

            {/* Buttons */}
            <div className="pt-4 border-t border-gray-100 flex flex-col gap-3">
              <Button
                type="submit"
                disabled={isSubmitting || isSavingDraft}
                className="w-full h-12 rounded-xl text-white font-semibold hover:bg-orange/90 bg-orange text-base shadow-sm shadow-orange/20 transition-all active:scale-[0.99] flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <span>Saving details...</span>
                ) : (
                  <>
                    <span>Complete Setup & Enter Dashboard</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>

              <button
                type="button"
                onClick={handleSaveAndFinishLater}
                disabled={isSubmitting || isSavingDraft}
                className="w-full py-2.5 text-sm font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-50 rounded-xl transition-all disabled:opacity-50 text-center"
              >
                {isSavingDraft ? 'Saving progress...' : 'Save and finish later'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
