"use client";

import React, { useEffect, useState, Suspense } from "react";
import Header from "@/components/shared/Headers/Header";
import VendorBanner from "@/components/vendor-dashboard/VendorBanner";
import OfferingCard from "@/components/vendor-search/OfferingCard";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { GET_VENDOR_BY_ID, FIND_SERVICES_BY_VENDOR } from "@/graphql/queries";
import { useVendorAuth } from "@/contexts/VendorAuthContext";
import { useQuery } from "@apollo/client";
import { MdAdd } from "react-icons/md";
import Footer from "@/components/shared/Footer";
import LoaderJelly from "@/components/shared/Loaders/LoaderJelly";
import { Service } from "@/types/serviceTypes";
import { FiEdit, FiCalendar, FiShield } from "react-icons/fi";
import BookingCalendar from "@/components/vendor-dashboard/BookingCalendar";
import VendorApprovalRequests from "@/components/vendor-dashboard/VendorApprovalRequests";

const VendorDashBoardContent: React.FC = () => {
  const router = useRouter();
  const { vendor } = useVendorAuth();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const [services, setServices] = useState<Service[]>([]);
  const [dashboardTab, setDashboardTab] = useState<"calendar" | "approvals">(
    tabParam === "approvals" ? "approvals" : "calendar"
  );

  useEffect(() => {
    if (tabParam === "approvals") {
      setDashboardTab("approvals");
    } else if (tabParam === "calendar") {
      setDashboardTab("calendar");
    }
  }, [tabParam]);

  const {
    data: vendorData,
    loading: vendorLoading,
    error: vendorError,
  } = useQuery(GET_VENDOR_BY_ID, {
    variables: { id: vendor?.id },
    skip: !vendor?.id,
  });

  // If vendor profile is incomplete (missing city, phone, or location), redirect to onboarding
  useEffect(() => {
    if (vendorData?.findVendorById) {
      const v = vendorData.findVendorById;
      const isIncomplete = !v.city || !v.phone || !v.location;
      if (isIncomplete) {
        router.push("/vendor-onboarding");
      }
    }
  }, [vendorData, router]);

  const {
    data: servicesData,
    loading: servicesLoading,
    error: servicesError,
  } = useQuery(FIND_SERVICES_BY_VENDOR, {
    variables: { id: vendor?.id },
    skip: !vendor?.id,
    fetchPolicy: "network-only",
    nextFetchPolicy: "cache-first",
  });

  // Update services state when servicesData changes
  useEffect(() => {
    if (servicesData?.findOfferingsByVendor) {
      setServices(servicesData.findOfferingsByVendor);
    }
  }, [servicesData]);

  if (vendorLoading || servicesLoading)
    return (
      <div className="min-h-screen bg-lightYellow flex flex-col">
        <Header />
        <div className="flex-grow flex items-center justify-center p-8">
          <div className="flex flex-col items-center gap-3">
            <LoaderJelly />
            <p className="text-sm font-medium text-gray-500">Loading your vendor dashboard...</p>
          </div>
        </div>
        <Footer />
      </div>
    );

  if (vendorError || servicesError)
    return (
      <div className="min-h-screen bg-lightYellow flex flex-col">
        <Header />
        <div className="flex-grow flex items-center justify-center p-8">
          <div className="bg-white rounded-2xl p-8 border border-red-100 text-center max-w-md shadow-sm">
            <p className="text-red-500 font-medium mb-2">Error loading vendor dashboard</p>
            <p className="text-gray-500 text-xs">{vendorError?.message || servicesError?.message}</p>
          </div>
        </div>
        <Footer />
      </div>
    );

  const vendorInfo = vendorData?.findVendorById;

  return (
    <div className="min-h-screen bg-lightYellow flex flex-col">
      <Header />

      <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Top Header Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="font-title text-3xl font-bold text-gray-900">Vendor Dashboard</h1>
            <p className="text-gray-500 font-body text-sm mt-1">
              Monitor customer bookings, manage your storefront profile, and track your active services.
            </p>
          </div>
          <Link
            href="/vendor-dashboard/new-service"
            className="inline-flex items-center justify-center gap-2 bg-orange hover:bg-orange/90 text-white font-medium px-4 py-2.5 rounded-xl transition-all shadow-sm text-sm self-start sm:self-auto"
          >
            <MdAdd size={20} />
            <span>Add New Service</span>
          </Link>
        </div>

        {/* Asymmetric Profile + Booking Calendar Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 mb-8 items-start">
          <div className="lg:col-span-4">
            <VendorBanner vendor={vendorInfo} />
          </div>
          <div className="lg:col-span-8 flex flex-col gap-4">
            <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl shadow-sm border border-gray-100 w-fit self-start">
              <button
                onClick={() => {
                  setDashboardTab("calendar");
                  window.history.replaceState(null, "", "/vendor-dashboard?tab=calendar");
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  dashboardTab === "calendar"
                    ? "bg-orange text-white shadow-sm"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                <FiCalendar size={14} />
                <span>Booking Calendar</span>
              </button>
              <button
                onClick={() => {
                  setDashboardTab("approvals");
                  window.history.replaceState(null, "", "/vendor-dashboard?tab=approvals");
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  dashboardTab === "approvals"
                    ? "bg-orange text-white shadow-sm"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                <FiShield size={14} />
                <span>Approval Requests</span>
              </button>
            </div>

            {dashboardTab === "calendar" ? (
              <BookingCalendar />
            ) : (
              <VendorApprovalRequests />
            )}
          </div>
        </div>

        {/* About Section Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-7 mb-8">
          <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-100">
            <h2 className="font-title text-xl sm:text-2xl font-bold text-gray-900">
              About {vendorInfo?.busname || "Your Business"}
            </h2>
            <Link
              href="/vendor-dashboard/settings"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange hover:text-orange/80 bg-orange/10 hover:bg-orange/20 px-3 py-1.5 rounded-xl transition-colors"
            >
              <FiEdit size={14} />
              <span>Edit Bio</span>
            </Link>
          </div>
          <p className="font-body text-gray-600 text-sm sm:text-base leading-relaxed whitespace-pre-line">
            {vendorInfo?.about ||
              "No business description provided yet. Update your storefront settings to let couples know more about your story, expertise, and service options."}
          </p>
        </div>

        {/* Services Section */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <h2 className="font-title text-xl sm:text-2xl font-bold text-gray-900">
                Services by {vendorInfo?.busname || "You"}
              </h2>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-orange/10 text-orange">
                {services.length} {services.length === 1 ? "Service" : "Services"}
              </span>
            </div>
          </div>

          {services.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {services.map((service: Service) => (
                <OfferingCard
                  key={service?.id}
                  vendor={service.vendor?.busname || "Unknown"}
                  name={service?.name}
                  city={service.vendor?.city || "Unknown"}
                  rating={Number(service?.reviews?.[0]?.rating) || 0}
                  banner={service.banner || "/images/offeringPlaceholder.webp"}
                  buttonText="View Details"
                  link={`/services/${service.id}`}
                />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 sm:p-12 text-center flex flex-col items-center justify-center">
              <div className="w-16 h-16 rounded-2xl bg-orange/10 text-orange flex items-center justify-center mb-4">
                <MdAdd size={32} />
              </div>
              <h3 className="font-title text-xl font-bold text-gray-900 mb-1">
                No Services Listed Yet
              </h3>
              <p className="text-gray-500 text-sm max-w-md mb-6">
                Create your first service listing to showcase your wedding packages and start receiving bookings from couples.
              </p>
              <Link
                href="/vendor-dashboard/new-service"
                className="inline-flex items-center gap-2 bg-orange hover:bg-orange/90 text-white font-medium px-5 py-2.5 rounded-xl transition-all shadow-sm text-sm"
              >
                <MdAdd size={20} />
                <span>Create First Service</span>
              </Link>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

const VendorDashboardPage: React.FC = () => {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-lightYellow flex flex-col items-center justify-center">
          <LoaderJelly />
        </div>
      }
    >
      <VendorDashBoardContent />
    </Suspense>
  );
};

export default VendorDashboardPage;
