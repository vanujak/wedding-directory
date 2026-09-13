"use client";

import Image from "next/image";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { RiGalleryView2 } from "react-icons/ri";

interface PortfolioImagesProps {
  banner?: string | null;
  photoShowcase?: string[] | null;
  hasMoreMedia?: boolean | null;
  totalMediaCount?: number | null;
  portfolioLink?: string | null;
}

const PortfolioImages: React.FC<PortfolioImagesProps> = ({
  banner,
  photoShowcase = [],
  hasMoreMedia = false,
  totalMediaCount = 0,
  portfolioLink,
}) => {
  // Filter out any empty/null showcase items
  const validShowcase = (photoShowcase || []).filter((img): img is string => Boolean(img));
  const defaultCover = banner || validShowcase[0] || "/images/offeringPlaceholder.webp";

  // State to track actively viewed image in the main full-width cover slot
  const [activeImage, setActiveImage] = useState<string>(defaultCover);

  useEffect(() => {
    setActiveImage(defaultCover);
  }, [defaultCover]);

  // Combine cover banner + showcase images for thumbnails
  const allImages = [
    ...(banner ? [{ src: banner, label: "Cover Image", isBanner: true }] : []),
    ...validShowcase.map((src, idx) => ({
      src,
      label: `Showcase Photo ${idx + 1}`,
      isBanner: false,
    })),
  ];

  const totalCount = Math.max(totalMediaCount || 0, allImages.length);
  const maxThumbnails = 6;
  const visibleThumbnails = allImages.slice(0, maxThumbnails);
  const remainingCount = Math.max(0, totalCount - visibleThumbnails.length);

  return (
    <div className="w-full max-w-7xl mx-auto">
      {/* Cover Image - Full Width */}
      <div className="relative w-full h-[360px] sm:h-[420px] md:h-[480px] rounded-2xl overflow-hidden shadow-sm border border-gray-100 bg-gray-100 group">
        <Image
          src={activeImage}
          alt="Service Cover Image"
          className="w-full h-full object-cover transition-all duration-300"
          fill
          priority
        />



        {/* View all gallery button */}
        {portfolioLink && (
          <Link
            href={portfolioLink}
            className="absolute bottom-4 right-4 z-10 inline-flex items-center gap-2 bg-black/65 hover:bg-black/85 backdrop-blur-md text-white py-2 px-4 rounded-xl text-xs sm:text-sm font-semibold shadow-md transition-all active:scale-[0.98]"
          >
            <RiGalleryView2 className="text-base text-orange" />
            <span>See all photos ({totalCount})</span>
          </Link>
        )}
      </div>

      {/* Other Images (Showcase) as Small Squares Below */}
      {allImages.length > 1 && (
        <div className="flex items-center gap-3 sm:gap-4 mt-3 sm:mt-4 overflow-x-auto pb-1 scrollbar-thin">
          {visibleThumbnails.map((item, index) => {
            const isSelected = activeImage === item.src;
            const isLastSlot =
              index === visibleThumbnails.length - 1 &&
              (hasMoreMedia || remainingCount > 0);

            if (isLastSlot && portfolioLink) {
              return (
                <Link
                  key={index}
                  href={portfolioLink}
                  className="relative flex-shrink-0 w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 aspect-square rounded-xl overflow-hidden border-2 border-gray-200 group cursor-pointer"
                  title="View full gallery"
                >
                  <Image
                    src={item.src}
                    alt={item.label}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform"
                  />
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex flex-col items-center justify-center text-white p-1 text-center">
                    <RiGalleryView2 className="text-lg text-orange mb-0.5" />
                    <span className="text-xs font-bold leading-tight">
                      +{remainingCount > 0 ? remainingCount : "More"}
                    </span>
                    <span className="text-[10px] text-gray-300">View All</span>
                  </div>
                </Link>
              );
            }

            return (
              <button
                key={index}
                type="button"
                onClick={() => setActiveImage(item.src)}
                className={`relative flex-shrink-0 w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 aspect-square rounded-xl overflow-hidden transition-all duration-150 cursor-pointer border-2 ${
                  isSelected
                    ? "border-orange shadow-sm opacity-100"
                    : "border-gray-200 hover:border-orange/50 opacity-70 hover:opacity-100"
                }`}
                title={`Click to view ${item.label}`}
              >
                <Image
                  src={item.src}
                  alt={item.label}
                  fill
                  className="object-cover"
                />

              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PortfolioImages;
