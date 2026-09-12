"use client";

import React, { useState, useEffect } from "react";
import LoaderHelix from "@/components/shared/Loaders/LoaderHelix";
import { FIND_VENDOR_BY_SERVICE } from "@/graphql/queries";
import { useQuery } from "@apollo/client";
import axios from "axios";
import dynamic from "next/dynamic";
import { FiMapPin, FiExternalLink } from "react-icons/fi";

// Dynamic import for Leaflet to ensure it only renders on client side
const LeafletMap = dynamic(
  () =>
    import("react-leaflet").then((mod) => {
      const { MapContainer, TileLayer, Marker, Popup } = mod;
      return function DynamicMap({
        lat,
        lng,
        address,
        businessName,
      }: {
        lat: number;
        lng: number;
        address: string;
        businessName?: string;
      }) {
        const [icon, setIcon] = useState<any>(null);

        useEffect(() => {
          // Configure Leaflet custom marker icon
          import("leaflet").then((L) => {
            const customIcon = L.icon({
              iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
              iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
              shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
              iconSize: [25, 41],
              iconAnchor: [12, 41],
              popupAnchor: [1, -34],
              shadowSize: [41, 41],
            });
            setIcon(customIcon);
          });
        }, []);

        if (!icon) return <div className="h-[400px] w-full bg-gray-100 animate-pulse rounded-2xl" />;

        return (
          <MapContainer
            center={[lat, lng]}
            zoom={15}
            scrollWheelZoom={false}
            style={{ width: "100%", height: "400px", borderRadius: "1rem" }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Marker position={[lat, lng]} icon={icon}>
              <Popup>
                <div className="font-body text-xs space-y-1">
                  {businessName && <p className="font-bold text-gray-900">{businessName}</p>}
                  <p className="text-gray-600">{address}</p>
                </div>
              </Popup>
            </Marker>
          </MapContainer>
        );
      };
    }),
  {
    ssr: false,
    loading: () => <LoaderHelix />,
  }
);

interface GoogleMapComponentProps {
  serviceId: string;
}

interface Coordinates {
  lat: number;
  lng: number;
}

const defaultCenter: Coordinates = {
  lat: 6.9271,
  lng: 79.8612, // Colombo, Sri Lanka
};

const GoogleMapComponent: React.FC<GoogleMapComponentProps> = ({ serviceId }) => {
  const [coordinates, setCoordinates] = useState<Coordinates>(defaultCenter);
  const [isFetchingCoordinates, setIsFetchingCoordinates] = useState(false);

  const { data: vdata, loading: vendorLoading, error: vendorError } = useQuery(FIND_VENDOR_BY_SERVICE, {
    variables: { offering_id: serviceId },
    skip: !serviceId,
  });

  const vendorData = vdata?.findVendorsByOffering || [];
  const vendor = vendorData.length > 0 ? vendorData[0] : null;
  const vendorLocation = vendor?.location || vendor?.city || null;
  const businessName = vendor?.busname;

  useEffect(() => {
    if (!vendorLocation) return;

    setIsFetchingCoordinates(true);

    const fetchCoordinates = async () => {
      try {
        // 1. First try Nominatim (OpenStreetMap)
        const osmResponse = await axios.get(
          `https://nominatim.openstreetmap.org/search`,
          {
            params: {
              q: vendorLocation.includes("Sri Lanka") ? vendorLocation : `${vendorLocation}, Sri Lanka`,
              format: "json",
              limit: 1,
            },
            headers: {
              "Accept-Language": "en",
            },
          }
        );

        if (osmResponse.data && osmResponse.data.length > 0) {
          const { lat, lon } = osmResponse.data[0];
          setCoordinates({ lat: parseFloat(lat), lng: parseFloat(lon) });
          return;
        }

        // 2. Fallback to Google Geocoding if OSM didn't find specific point and API key exists
        if (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
          const gResponse = await axios.get(
            `https://maps.googleapis.com/maps/api/geocode/json`,
            {
              params: {
                address: vendorLocation,
                key: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
              },
            }
          );

          if (gResponse.data?.results?.length > 0) {
            const { lat, lng } = gResponse.data.results[0].geometry.location;
            setCoordinates({ lat, lng });
          }
        }
      } catch (err) {
        console.warn("Geocoding notice: Using standard location coordinates", err);
      } finally {
        setIsFetchingCoordinates(false);
      }
    };

    fetchCoordinates();
  }, [vendorLocation]);

  if (vendorLoading || isFetchingCoordinates) {
    return (
      <div className="h-[400px] flex items-center justify-center bg-gray-50 rounded-2xl border border-gray-100">
        <LoaderHelix />
      </div>
    );
  }

  if (vendorError) {
    return (
      <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm">
        Failed to load vendor location.
      </div>
    );
  }

  // Google Maps directions navigation URL
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    vendorLocation ? `${vendorLocation}` : `${coordinates.lat},${coordinates.lng}`
  )}`;

  return (
    <div className="flex flex-col gap-3">
      {/* Map display */}
      <div className="w-full h-[400px] rounded-2xl overflow-hidden border border-gray-200 shadow-sm relative">
        <LeafletMap
          lat={coordinates.lat}
          lng={coordinates.lng}
          address={vendorLocation || "Sri Lanka"}
          businessName={businessName}
        />
      </div>

      {/* Address details bar & Directions button */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-white rounded-xl border border-gray-200 text-sm">
        <div className="flex items-center gap-2.5 text-gray-700">
          <div className="w-8 h-8 rounded-lg bg-orange/10 flex items-center justify-center text-orange flex-shrink-0">
            <FiMapPin className="w-4 h-4" />
          </div>
          <div>
            <p className="font-semibold text-gray-900 leading-tight">
              {businessName ? `${businessName} Location` : "Service Location"}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {vendorLocation || "Location available on contact"}
            </p>
          </div>
        </div>

        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-gray-900 hover:bg-black text-white transition-all shadow-sm active:scale-95"
        >
          <span>Open in Google Maps</span>
          <FiExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
};

export default GoogleMapComponent;
