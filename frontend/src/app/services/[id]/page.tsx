"use client";

import Header from "@/components/shared/Headers/Header";
import React, { useEffect, useState } from "react";
import Image from "next/image";
import { CiHeart } from "react-icons/ci";
import { useParams } from "next/navigation";
import {
  FIND_MY_VENDOR_BY_ID,
  FIND_SERVICE_BY_ID,
  FIND_PACKAGES_BY_OFFERING,
  GET_VISITOR_PAYMENTS,
  GET_VENDOR_BOOKED_DATES,
  GET_VISITOR_APPROVAL_REQUESTS,
} from "@/graphql/queries";
import { useMutation, useQuery } from "@apollo/client";
import SocialIcons from "@/components/vendor-dashboard/dahboard-services/socialIcons";
import { FiEdit, FiMessageCircle, FiMapPin, FiArrowLeft } from "react-icons/fi";
import Reviews from "@/components/vendor-dashboard/dahboard-services/reviews/Reviews";
import { useVendorAuth } from "@/contexts/VendorAuthContext";
import Link from "next/link";
import LoaderQuantum from "@/components/shared/Loaders/LoaderQuantum";
import Comments from "@/components/vendor-dashboard/dahboard-services/reviews/Comments";
import WriteReview from "@/components/vendor-dashboard/dahboard-services/reviews/WriteReview";
import { useAuth } from "@/contexts/VisitorAuthContext";
import { ADD_TO_MY_VENDORS, REMOVE_FROM_MY_VENDORS, TRACK_PACKAGE_VIEW } from "@/graphql/mutations";
import toast from "react-hot-toast";
import { FaHeart } from "react-icons/fa";
import QuoteRequestWidget from "@/components/chat/QuoteRequestWidget";
import GoogleMapComponent from "@/components/vendor-dashboard/dahboard-services/Map";
import PortfolioImages from "@/components/vendor-dashboard/dahboard-services/PortfolioImages";
import request from "@/utils/request";
import PackageReservationModal from "@/components/shared/PackageReservationModal";
import PackageApprovalRequestModal from "@/components/shared/PackageApprovalRequestModal";
import { ensureSessionId } from "@/utils/session";
import ChatModal from "@/components/chat/ChatModal";
import { ShieldCheck, Lock, Loader2, Clock } from "lucide-react";
import { format } from "date-fns";

// Add this interface before the Service component
interface Package {
  id: string;
  name: string;
  description: string;
  pricing: number;
  features: string[];
  visible: boolean;
  requiresReservation: boolean;
  requiresApproval?: boolean;
  bookedDates?: string[];
  image?: string | null;
}

interface PayHerePaymentResponse {
  actionUrl: string;
  payment: Record<string, string | boolean>;
}

const Service: React.FC = () => {
  const { vendor } = useVendorAuth();
  const { visitor } = useAuth();
  const params = useParams();
  const { id } = params;
  // const router = useRouter();

  const { loading, data } = useQuery(FIND_SERVICE_BY_ID, {
    variables: { id },
  });

  const queryError = useQuery(FIND_SERVICE_BY_ID, { variables: { id } }).error;

  const { data: packagesData, refetch: refetchPackages } = useQuery(FIND_PACKAGES_BY_OFFERING, {
    variables: { offeringId: id },
    fetchPolicy: "network-only",
  });

  // Get visitor's payments to check booked packages
  const { data: paymentsData, refetch: refetchVisitorPayments } = useQuery(GET_VISITOR_PAYMENTS, {
    variables: { visitorId: visitor?.id },
    skip: !visitor?.id,
    fetchPolicy: "network-only",
  });

  // Get vendor's booked dates for the calendar - MUST be at top level with all hooks
  const { data: bookedDatesData, refetch: refetchBookedDates } = useQuery(GET_VENDOR_BOOKED_DATES, {
    variables: { vendorId: data?.findOfferingById?.vendor?.id },
    skip: !data?.findOfferingById?.vendor?.id,
    fetchPolicy: "network-only",
  });

  // Check if offering is in visitor's my vendors
  const { loading: myVendorLoading, data: myVendorData } = useQuery(
    FIND_MY_VENDOR_BY_ID,
    {
      variables: {
        visitorId: visitor?.id,
        offeringId: id,
      },
      skip: !visitor,
    }
  );

  const [isInMyVendors, setIsInMyVendors] = useState(false);
  const [addToMyVendors] = useMutation(ADD_TO_MY_VENDORS);
  const [removeFromMyVendors] = useMutation(REMOVE_FROM_MY_VENDORS);
  const [trackPackageView] = useMutation(TRACK_PACKAGE_VIEW);

  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [approvalPackage, setApprovalPackage] = useState<Package | null>(null);

  const { data: visitorApprovalsData, refetch: refetchVisitorApprovals } = useQuery(
    GET_VISITOR_APPROVAL_REQUESTS,
    {
      variables: { visitorId: visitor?.id },
      skip: !visitor?.id,
      fetchPolicy: "cache-and-network",
    }
  );

  const [clientIp, setClientIp] = useState<string | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [paymentRedirectInfo, setPaymentRedirectInfo] = useState<{
    packageName?: string;
    amount?: number;
  } | null>(null);

  // Fetch client IP address on mount
  useEffect(() => {
    fetch('/api/client-ip')
      .then(res => res.json())
      .then(data => setClientIp(data.ip))
      .catch(() => setClientIp(null));
  }, []);

  // Track package views when packages are loaded
  useEffect(() => {
    if (packagesData?.findPackagesByOffering && !vendor && clientIp) {
      // Only track views for non-vendor visitors and when IP is available
      const sessionId = ensureSessionId();
      
      console.log('Tracking package views:', {
        packagesCount: packagesData.findPackagesByOffering.length,
        visitorId: visitor?.id,
        sessionId,
        ipAddress: clientIp,
      });
      
      // Track each package view (fire and forget)
      packagesData.findPackagesByOffering.forEach((pkg: Package) => {
        console.log('Tracking view for package:', pkg.id);
        trackPackageView({
          variables: {
            packageId: pkg.id,
            visitorId: visitor?.id || null,
            sessionId,
            ipAddress: clientIp,
          },
        })
          .then((result) => {
            console.log('Successfully tracked view for package:', pkg.id, result);
          })
          .catch((err) => {
            console.error("Failed to track package view:", pkg.id, err);
          });
      });
    }
  }, [packagesData, visitor, vendor, trackPackageView, clientIp]);

  // Listen for cancellation return from PayHere (when user clicks 'Cancel' or 'Back to site')
  useEffect(() => {
    if (typeof window === "undefined") return;
    const searchParams = new URLSearchParams(window.location.search);
    const isCanceled = searchParams.get("payment_canceled");
    const orderId = searchParams.get("order_id");

    if (isCanceled === "true") {
      toast("Payment was canceled. You can select another package or try again.", {
        icon: "ℹ️",
      });

      if (orderId) {
        request.post("/api/payhere/cancel", { order_id: orderId }).catch(console.error);
      }

      refetchVisitorPayments?.();
      refetchBookedDates?.();
      refetchPackages?.();

      const url = new URL(window.location.href);
      url.searchParams.delete("payment_canceled");
      url.searchParams.delete("order_id");
      window.history.replaceState({}, "", url.pathname + (url.search ? url.search : ""));
    }
  }, [refetchVisitorPayments, refetchBookedDates, refetchPackages]);

  // Check if a package is already booked by the visitor (only completed payments count)
  const isPackageBooked = (packageId: string) => {
    if (!paymentsData?.visitorPayments) return { booked: false, expired: false, bookingDate: null };
    
    const payment = paymentsData.visitorPayments.find(
      (p: any) => p.package?.id === packageId && p.status === 'completed'
    );
    
    if (!payment) return { booked: false, expired: false, bookingDate: null };
    
    // If there's a booking date, check if it has passed
    if (payment.bookingDate) {
      const bookingDate = new Date(payment.bookingDate);
      const now = new Date();
      const expired = bookingDate < now;
      return { booked: true, expired, bookingDate };
    }
    
    // If no booking date (standard package), it's booked and never expires
    return { booked: true, expired: false, bookingDate: null };
  };

  const formatRemaining = (seconds?: number) => {
    if (!seconds || seconds <= 0) return "Expired";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const handleBookingClick = (pkg: Package) => {
    if (!visitor) {
      toast.error("Please login as a user to book");
      return;
    }

    // Check if this package is already booked and not expired
    const bookingStatus = isPackageBooked(pkg.id);
    if (bookingStatus.booked && !bookingStatus.expired) {
      toast.error("You have already booked this package. You cannot book it again until your booking expires.");
      return;
    }

    setSelectedPackage(pkg);
  };

  // Update isInMyVendors when myVendorData changes
  useEffect(() => {
    if (myVendorData?.findMyVendorById) {
      setIsInMyVendors(true);
    }
  }, [myVendorData]);

  if (loading || myVendorLoading) return <LoaderQuantum />;
  if (queryError) return <p>Error: {queryError.message}</p>;

  const offering = data?.findOfferingById;
  const isVendorsOffering = offering?.vendor.id === vendor?.id;

  const handleHeartClick = async () => {
    if (!visitor) {
      toast.error("Please login as a user to save to your vendors");
      return;
    }

    if (!id) {
      toast.error("Service does not exist");
      return;
    }

    try {
      if (isInMyVendors) {
        const { data } = await removeFromMyVendors({
          variables: {
            visitorId: visitor.id,
            offeringId: id,
          },
        });

        if (data?.removeFromMyVendors) {
          setIsInMyVendors(false);
          toast.success("Removed from your vendors");
        } else {
          throw new Error("Failed to remove from vendors");
        }
      } else {
        const { data } = await addToMyVendors({
          variables: {
            visitorId: visitor.id,
            offeringId: id,
          },
        });

        if (data?.addToMyVendors) {
          setIsInMyVendors(true);
          toast.success(
            <div>
              Saved to your vendors! <br />
              <Link
                href={`/visitor-dashboard/my-vendors/${id}`}
                className="underline"
              >
                View your vendors
              </Link>
            </div>,
            {
              duration: 8000,
            }
          );
        } else {
          throw new Error("Failed to add to vendors");
        }
      }
    } catch {
      toast.error("Couldn't save to your favorites");
    }
  };

  const handlePayAdvance = async (amount: number, packageId: string, bookingDate?: Date) => {
    try {
      if (!visitor) {
        toast.error("Please login as a user to pay advance");
        return;
      }

      if (amount <= 0) {
        toast.error("Amount is too small for processing");
        return;
      }

      const pkgName = packagesData?.findPackagesByOffering?.find(
        (p: any) => p.id === packageId
      )?.name;

      setPaymentRedirectInfo({
        packageName: pkgName,
        amount,
      });

      const { data } = await request.post<PayHerePaymentResponse>(
        "/api/payhere/create-payment",
        {
          amount,
          packageId,
          visitorId: visitor.id,
          vendorId: offering.vendor.id,
          offeringId: offering.id,
          bookingDate: bookingDate ? bookingDate.toISOString() : undefined,
          customer: {
            email: visitor.email,
            city: offering.vendor.city,
          },
        }
      );

      const form = document.createElement("form");
      form.method = "POST";
      form.action = data.actionUrl;

      Object.entries(data.payment).forEach(([key, value]) => {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = key;
        input.value = String(value);
        form.appendChild(input);
      });

      document.body.appendChild(form);
      form.submit();
    } catch (error: any) {
      setPaymentRedirectInfo(null);
      const message =
        error?.response?.data?.message ||
        "Payment processing failed. Please try again.";
      toast.error(Array.isArray(message) ? message[0] : message);
      throw error;
    }
  };

  return (
    <div className="bg-lightYellow font-body">
      <Header />
      <div className="container mx-auto justify-center py-2">
        <div className="mb-4 pt-2">
          <Link
            href={isVendorsOffering ? "/vendor-dashboard" : "/"}
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-orange transition-colors group"
          >
            <FiArrowLeft className="text-base group-hover:-translate-x-0.5 transition-transform" />
            <span>{isVendorsOffering ? "Back to Dashboard" : "Back"}</span>
          </Link>
        </div>

        {/* Replace the Portfolio Image Section with the new component */}
        <PortfolioImages
          banner={offering?.banner}
          photoShowcase={offering?.photo_showcase || []}
          hasMoreMedia={
            (offering?.photo_showcase && offering.photo_showcase.length > 5) ||
            offering?.video_showcase?.length > 0
          }
          totalMediaCount={
            (offering?.banner ? 1 : 0) +
            (offering?.photo_showcase?.length || 0) +
            (offering?.video_showcase?.length || 0)
          }
          portfolioLink={`/services/${id}/gallery`}
        />

        {/* Vendor Storefront View Mode Banner */}
        {isVendorsOffering && (
          <div className="bg-white rounded-2xl shadow-sm border border-orange/20 p-4 sm:p-5 mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-orange/5 via-white to-white">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-orange/10 flex items-center justify-center text-orange flex-shrink-0">
                <FiEdit className="text-lg" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-title font-bold text-gray-900 text-base">
                    Vendor Storefront View
                  </span>
                  <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-orange/15 text-orange">
                    Your Listing
                  </span>
                </div>
                <p className="text-xs text-gray-500 font-body mt-0.5">
                  This is how couples see your service. You can update your service details, media, and pricing packages anytime.
                </p>
              </div>
            </div>
            <Link
              href={`/services/edit/${offering?.id}`}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-orange hover:bg-orange/90 active:scale-[0.99] rounded-xl shadow-sm shadow-orange/20 transition-all whitespace-nowrap w-full sm:w-auto"
            >
              <FiEdit className="text-base" />
              <span>Edit Service</span>
            </Link>
          </div>
        )}

        <div className="flex flex-row gap-x-5 mt-4">
          <div className="w-3/4">
            {/* General Section */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-4">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="flex-1">
                  <span className="text-xs font-semibold uppercase tracking-wider text-orange bg-orange/10 px-2.5 py-1 rounded-md inline-block mb-2">
                    {offering?.vendor.busname || "Vendor name not available"}
                  </span>
                  <div className="flex items-center gap-3 flex-wrap">
                    <h1 className="text-3xl font-title font-bold text-gray-900">
                      {offering?.name}
                    </h1>
                    {!isVendorsOffering && (
                      <button
                        onClick={handleHeartClick}
                        className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-red-500 transition-colors"
                        title={isInMyVendors ? "Remove from saved" : "Save to favorites"}
                      >
                        {isInMyVendors ? (
                          <FaHeart className="text-2xl text-red-500 hover:text-red-600 hover:cursor-pointer" />
                        ) : (
                          <CiHeart className="text-2xl hover:text-red-500 hover:cursor-pointer" />
                        )}
                      </button>
                    )}
                  </div>
                  <div className="text-gray-500 text-sm mt-2 flex items-center gap-1.5">
                    <FiMapPin className="text-gray-400 text-sm flex-shrink-0" />
                    <span>{offering?.vendor.city || "Location not specified"}</span>
                  </div>
                  
                  {/* Chat Button - Only show for visitors (not vendors viewing their own) */}
                  {!isVendorsOffering && visitor && (
                    <button
                      onClick={() => setIsChatOpen(true)}
                      className="mt-4 bg-orange text-white px-5 py-2.5 rounded-xl hover:bg-orange/90 shadow-sm shadow-orange/20 font-semibold text-sm transition-all flex items-center gap-2 w-fit active:scale-[0.99]"
                    >
                      <FiMessageCircle className="text-lg" />
                      Chat with Vendor
                    </button>
                  )}
                </div>
                <div className="flex-shrink-0 pt-1">
                  <SocialIcons offering={offering} />
                </div>
              </div>
            </div>

            {/* Details Section */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-4 flex flex-col">
              <h2 className="mb-2 text-xl font-bold font-title text-gray-900">About the Vendor</h2>
              <div className="text-gray-600 font-body leading-relaxed">
                <p>{offering.vendor.about || "About not available"}</p>
              </div>
              <hr className="border-t border-gray-100 my-6" />

              <h2 className="mb-2 text-xl font-bold font-title text-gray-900">Details</h2>
              <div className="text-gray-600 font-body leading-relaxed">
                <p>{offering.description || "Description not available"}</p>
              </div>
              <hr className="border-t border-gray-100 my-6" />

              {/* Packages Section */}
              {packagesData?.findPackagesByOffering.some(
                (pkg: Package) => pkg.visible
              ) && (
                  <>
                    <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
                      <h2 className="text-2xl font-bold font-title text-gray-900">Packages</h2>
                      {isVendorsOffering && (
                        <Link href={`/services/edit/${offering?.id}`}>
                          <button className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-orange hover:bg-orange/90 active:scale-[0.99] rounded-xl shadow-sm shadow-orange/20 transition-all">
                            <FiEdit className="text-sm" />
                            <span>Edit Packages</span>
                          </button>
                        </Link>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                      {packagesData?.findPackagesByOffering
                        .filter((pkg: Package) => pkg.visible)
                        .map((pkg: Package) => (
                          <div
                            key={pkg.id}
                            className="bg-white rounded-2xl border-2 border-gray-200 shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md hover:border-orange flex flex-col h-full"
                          >
                            {pkg.image && (
                              <div className="relative w-full h-44 overflow-hidden border-b border-gray-200">
                                <Image
                                  src={pkg.image}
                                  alt={pkg.name}
                                  fill
                                  className="object-cover"
                                />
                              </div>
                            )}
                            <div className="p-4 text-center bg-gray-50 border-b border-gray-200">
                              <h3 className="text-xl font-bold font-title text-gray-900">
                                {pkg.name}
                              </h3>
                              <div className="mt-2 flex justify-center">
                                {pkg.requiresApproval ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                    Requires Approval
                                  </span>
                                ) : pkg.requiresReservation ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                    Requires Reservation
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    Normal Package
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="p-6 flex flex-col flex-grow">
                              <div className="text-center mb-6">
                                <div className="text-3xl font-bold font-title text-orange">
                                  <span className="text-sm align-top text-gray-500 font-body font-normal">
                                    LKR
                                  </span>{" "}
                                  {pkg.pricing.toLocaleString()}
                                </div>
                                <p className="text-gray-500 font-body text-sm mt-2">
                                  {pkg.description}
                                </p>
                              </div>
                              <div className="space-y-2.5 mb-6 min-h-[100px]">
                                {pkg.features.map(
                                  (feature: string, idx: number) => (
                                    <div key={idx} className="flex items-start text-sm text-gray-600 font-body">
                                      <svg
                                        className="w-4 h-4 text-emerald-500 mr-2 mt-0.5 flex-shrink-0"
                                        fill="currentColor"
                                        viewBox="0 0 20 20"
                                      >
                                        <path
                                          fillRule="evenodd"
                                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                          clipRule="evenodd"
                                        />
                                      </svg>
                                      <span>
                                        {feature}
                                      </span>
                                    </div>
                                  )
                                )}
                              </div>
                              <div className="pt-4 border-t border-gray-100 mt-auto">
                                  {(() => {
                                    // 1. Vendor viewing their own packages (cannot book their own services)
                                    if (isVendorsOffering) {
                                      return (
                                        <div className="w-full flex flex-col items-center gap-1.5">
                                          <Link
                                            href={`/services/edit/${offering?.id}`}
                                            className="w-full py-2.5 px-4 rounded-xl font-semibold text-sm text-white bg-orange hover:bg-orange/90 active:scale-[0.99] shadow-sm shadow-orange/20 transition-all flex items-center justify-center gap-2"
                                          >
                                            <FiEdit className="text-base" />
                                            <span>Edit Package</span>
                                          </Link>
                                          <span className="text-[11px] text-gray-400 text-center font-body">
                                            Couple advance: LKR {(pkg.pricing * 0.2).toLocaleString()} (20%)
                                          </span>
                                        </div>
                                      );
                                    }

                                    // 2. Already booked package by visitor
                                    const bookingStatus = isPackageBooked(pkg.id);
                                    if (bookingStatus.booked && !bookingStatus.expired) {
                                      return (
                                        <div className="w-full py-3 px-4 rounded-xl font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 flex flex-col items-center text-center">
                                          <span className="flex items-center gap-2 text-sm font-semibold">
                                            <svg className="w-4 h-4 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                            </svg>
                                            You Booked This Package
                                          </span>
                                          {bookingStatus.bookingDate && (
                                            <span className="text-xs font-normal text-emerald-700 mt-1">
                                              Booking Date: {bookingStatus.bookingDate.toLocaleDateString()}
                                            </span>
                                          )}
                                        </div>
                                      );
                                    }

                                    // 3. Approval flow
                                    if (pkg.requiresApproval) {
                                      const approvalReq = (visitorApprovalsData?.getVisitorApprovalRequests || []).find(
                                        (r: any) => r.package?.id === pkg.id
                                      );

                                      if (approvalReq) {
                                        if (approvalReq.status === "pending") {
                                          return (
                                            <div className="w-full flex flex-col items-center gap-1.5">
                                              <div className="w-full py-2.5 px-4 rounded-xl font-semibold text-amber-800 bg-amber-50 border border-amber-200 flex flex-col items-center text-center">
                                                <span className="text-sm flex items-center gap-1.5 font-semibold">
                                                  <Clock className="w-4 h-4 text-amber-600 animate-pulse" />
                                                  Approval Pending
                                                </span>
                                                <span className="text-xs font-normal text-amber-700 mt-0.5">
                                                  Requested for {format(new Date(approvalReq.bookingDate), "MMM d, yyyy")}
                                                </span>
                                              </div>
                                              <span className="text-[11px] text-gray-400 text-center">Awaiting vendor review</span>
                                            </div>
                                          );
                                        }

                                        if (approvalReq.status === "approved" && !approvalReq.isExpired) {
                                          return (
                                            <div className="w-full flex flex-col items-center gap-1.5">
                                              <button
                                                onClick={() => {
                                                  const advanceAmount = pkg.pricing * 0.2;
                                                  handlePayAdvance(advanceAmount, pkg.id, new Date(approvalReq.bookingDate));
                                                }}
                                                className="w-full py-2.5 px-4 rounded-xl font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] transition-all flex flex-col items-center shadow-sm shadow-emerald-600/20"
                                              >
                                                <span className="flex items-center gap-1.5 text-sm">
                                                  <ShieldCheck className="w-4 h-4" />
                                                  Approved! Pay 20% Advance
                                                </span>
                                                <span className="font-normal text-xs text-emerald-100">
                                                  LKR {(pkg.pricing * 0.2).toLocaleString()} • For {format(new Date(approvalReq.bookingDate), "MMM d, yyyy")}
                                                </span>
                                              </button>
                                              <div className="text-[11px] font-semibold text-amber-600 flex items-center gap-1">
                                                <Clock className="w-3.5 h-3.5" />
                                                <span>Expires in: {formatRemaining(approvalReq.secondsRemaining)}</span>
                                              </div>
                                            </div>
                                          );
                                        }

                                        if (approvalReq.status === "rejected") {
                                          return (
                                            <div className="w-full flex flex-col items-center gap-1.5">
                                              <div className="w-full p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 text-center">
                                                <span className="font-semibold block">Request Declined</span>
                                                {approvalReq.vendorMessage && (
                                                  <span className="text-[11px] text-gray-600 block mt-0.5 italic">"{approvalReq.vendorMessage}"</span>
                                                )}
                                              </div>
                                              <button
                                                onClick={() => {
                                                  if (!visitor) {
                                                    toast.error("Please login as a user to request approval");
                                                    return;
                                                  }
                                                  setApprovalPackage(pkg);
                                                }}
                                                className="w-full py-2 px-4 rounded-xl font-semibold text-accent bg-accent/10 hover:bg-accent hover:text-white transition-all text-xs flex items-center justify-center gap-1.5 active:scale-[0.99]"
                                              >
                                                Request with Another Date
                                              </button>
                                            </div>
                                          );
                                        }

                                        if (approvalReq.status === "expired") {
                                          return (
                                            <div className="w-full flex flex-col items-center gap-1.5">
                                              <div className="w-full p-2 rounded-xl bg-gray-100 text-xs text-gray-600 text-center">
                                                Previous 24-hour approval expired
                                              </div>
                                              <button
                                                onClick={() => {
                                                  if (!visitor) {
                                                    toast.error("Please login as a user to request approval");
                                                    return;
                                                  }
                                                  setApprovalPackage(pkg);
                                                }}
                                                className="w-full py-2 px-4 rounded-xl font-semibold text-accent bg-accent/10 hover:bg-accent hover:text-white transition-all text-xs flex items-center justify-center gap-1.5 active:scale-[0.99]"
                                              >
                                                Request Approval Again
                                              </button>
                                            </div>
                                          );
                                        }
                                      }

                                      return (
                                        <button
                                          onClick={() => {
                                            if (!visitor) {
                                              toast.error("Please login as a user to request vendor approval");
                                              return;
                                            }
                                            setApprovalPackage(pkg);
                                          }}
                                          className="w-full py-2.5 px-4 rounded-xl font-semibold text-white bg-accent hover:bg-accent/90 active:scale-[0.99] transition-all flex flex-col items-center shadow-sm shadow-accent/20"
                                        >
                                          <span className="flex items-center gap-1.5 text-sm">
                                            <ShieldCheck className="w-4 h-4" />
                                            Request Vendor Approval
                                          </span>
                                          <span className="font-normal text-xs opacity-90">
                                            Advance: LKR {(pkg.pricing * 0.2).toLocaleString()}
                                          </span>
                                        </button>
                                      );
                                    }

                                    // 4. Booking expired
                                    if (bookingStatus.expired) {
                                      return (
                                        <div className="space-y-2 w-full">
                                          <div className="text-xs text-amber-600 text-center font-medium">
                                            Previous booking expired. You can book again.
                                          </div>
                                          <button
                                            onClick={() => {
                                              if (!visitor) {
                                                toast.error("Please login as a user to pay advance");
                                                return;
                                              }
                                              handleBookingClick(pkg);
                                            }}
                                            className={`w-full py-2.5 px-4 rounded-xl font-semibold text-white active:scale-[0.99] transition-all flex flex-col items-center shadow-sm ${
                                              pkg.requiresReservation
                                                ? "bg-accent hover:bg-accent/90 shadow-accent/20"
                                                : "bg-orange hover:bg-orange/90 shadow-orange/20"
                                            }`}
                                          >
                                            <span className="text-sm">Book Again</span>
                                            <span className="font-normal text-xs opacity-90">
                                              20% Advance: LKR {(pkg.pricing * 0.2).toLocaleString()}
                                            </span>
                                          </button>
                                        </div>
                                      );
                                    }

                                    // 5. Standard booking
                                    return (
                                      <button
                                        onClick={() => {
                                          if (!visitor) {
                                            toast.error("Please login as a user to pay advance");
                                            return;
                                          }
                                          handleBookingClick(pkg);
                                        }}
                                        className={`w-full py-2.5 px-4 rounded-xl font-semibold text-white active:scale-[0.99] transition-all flex flex-col items-center shadow-sm ${
                                          pkg.requiresReservation
                                            ? "bg-accent hover:bg-accent/90 shadow-accent/20"
                                            : "bg-orange hover:bg-orange/90 shadow-orange/20"
                                        }`}
                                      >
                                        <span className="text-sm">
                                          {pkg.requiresReservation ? "See Details & Book" : "Select Date & Book"}
                                        </span>
                                        <span className="font-normal text-xs opacity-90">
                                          20% Advance: LKR {(pkg.pricing * 0.2).toLocaleString()}
                                        </span>
                                      </button>
                                    );
                                  })()}
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                    <hr className="border-t border-gray-100 my-6" />
                  </>
                )}

              <h2 className="mb-3 text-xl font-bold font-title text-gray-900">Reviews</h2>
              <div>
                <Reviews serviceId={offering?.id} />
              </div>

              {!isVendorsOffering ? (
                <div className="mt-4">
                  <WriteReview serviceId={offering?.id} vendorName={offering?.vendor?.busname} />
                </div>
              ) : null}

              <div className="mt-4">
                <Comments serviceId={offering?.id} />
              </div>

              <hr className="border-t border-gray-100 my-6" />
              <h2 className="mb-3 text-xl font-bold font-title text-gray-900">Location</h2>
              <div>
                <GoogleMapComponent serviceId={offering?.id} />
              </div>
            </div>
          </div>

          <div className="w-1/4 sticky top-20">
            <QuoteRequestWidget
              vendorId={offering?.vendor?.id}
              offeringId={
                typeof params.id === "string" ? params.id : params.id[0]
              }
            />
          </div>
        </div>
      </div>

      {selectedPackage && (
        <PackageReservationModal
          isOpen={!!selectedPackage}
          onClose={() => setSelectedPackage(null)}
          pkg={{
            ...selectedPackage,
            bookedDates: selectedPackage.requiresReservation
              ? (bookedDatesData?.getVendorBookedDates || [])
              : []
          }}
          onPay={async (date) => {
            const advanceAmount = selectedPackage.pricing * 0.2;
            await handlePayAdvance(advanceAmount, selectedPackage.id, date);
          }}
          visitorId={visitor?.id}
          offeringId={offering?.id}
        />
      )}

      {approvalPackage && (
        <PackageApprovalRequestModal
          isOpen={!!approvalPackage}
          onClose={() => setApprovalPackage(null)}
          pkg={approvalPackage}
          visitorId={visitor?.id}
          offeringId={offering?.id}
          onSuccess={() => {
            refetchVisitorApprovals?.();
          }}
        />
      )}

      {/* Chat Modal */}
      {visitor && offering && (
        <ChatModal
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          visitorId={visitor.id}
          offeringId={offering.id}
          vendorName={offering.vendor?.busname || "Vendor"}
          offeringName={offering.name || "Service"}
        />
      )}

      {/* Payment Gateway Redirect Overlay */}
      {paymentRedirectInfo && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="relative inline-block mb-5">
              <div className="w-20 h-20 rounded-3xl bg-orange/10 flex items-center justify-center text-orange mx-auto">
                <ShieldCheck className="w-10 h-10 text-orange animate-pulse" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-white shadow-md flex items-center justify-center border border-gray-100">
                <Loader2 className="w-4 h-4 text-orange animate-spin" />
              </div>
            </div>

            <h3 className="text-2xl font-bold font-title text-gray-900 mb-6">
              Redirecting to PayHere...
            </h3>

            <div className="inline-flex items-center gap-2 text-xs font-medium text-gray-600 bg-gray-50 px-4 py-2 rounded-full border border-gray-200 font-body">
              <Lock className="w-3.5 h-3.5 text-emerald-600" />
              <span>256-bit SSL Encrypted Secure Checkout</span>
            </div>

            <p className="text-xs text-gray-400 mt-5 font-body">
              Please do not close or refresh this page...
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Service;
