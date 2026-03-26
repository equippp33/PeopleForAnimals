"use client";

import { useState } from "react";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { api } from "~/utils/api";

interface Vehicle {
  id: string;
  name: string;
  vehicleNumber: string;
  vehicleColor: string;
  locationName?: string;
  locationCoordinates?: string;
}

interface LocationReport {
  id: string;
  name: string;
  type: string;
  area: string;
  coordinates: {
    lat: number;
    lng: number;
  };
}

export default function OperationalReports() {
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);

  // Fetch locations using tRPC
  const { data: locationData, isLoading: locationsLoading } =
    api.location.getAllLocations.useQuery();
  const { data: vehiclesData, isLoading: vehiclesLoading } =
    api.vehicle.getAllVehicles.useQuery();

  const locations = locationData
    ? [...(locationData.capture ?? []), ...(locationData.release ?? [])]
    : [];
  const vehicles: Vehicle[] = vehiclesData ?? [];

  if (locationsLoading || vehiclesLoading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-black">Hello Admin !</h1>
      </div>

      {/* Title Section */}
      <div className="mb-6">
        <h2 className="text-xl font-bold">Operational reports</h2>
        <p className="text-sm text-gray-600">Capture and Release reports</p>
      </div>

      {/* Filters Section */}
      <div className="mb-8 rounded-xl bg-blue-500 p-6">
        <h3 className="mb-2 text-lg font-semibold text-white">Filters</h3>
        <p className="mb-4 text-sm text-blue-100">
          Filter by date, vehicle and location
        </p>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="mb-2 block text-sm text-white">Date</label>
            <Input
              type="date"
              value={selectedDate}
              className="w-full bg-white"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-white">Vehicles</label>
            <select className="w-full rounded-md border-0 bg-white px-3 py-2 text-gray-900">
              <option value="">All vehicles</option>
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.vehicleNumber}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm text-white">Location</label>
            <select className="w-full rounded-md border-0 bg-white px-3 py-2 text-gray-900">
              <option>All locations</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Location Cards Grid */}
      <div className="grid grid-cols-4 gap-4">
        {locations.map((location) => (
          <div
            key={location.id}
            className="h-[200px] w-[300px] rounded-xl border border-blue-100 bg-[#F8FAFF] p-6"
          >
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-blue-500">
                <svg
                  className="h-6 w-6 text-white"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              </div>
              <h3
                className="truncate text-xl font-semibold text-gray-900"
                title={location.name}
              >
                {location.name}
              </h3>
            </div>

            <div className="mb-6">
              <p className="text-sm text-gray-600">No. of operations - 15</p>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600">Total Impact</p>
                <p className="text-2xl font-semibold text-gray-900">38</p>
              </div>
              <Button
                variant="outline"
                className="rounded-full bg-black px-6 py-2 text-sm font-medium text-white hover:bg-gray-800"
              >
                Explore
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      <div className="mt-6 flex items-center justify-center gap-2">
        <button className="rounded-lg p-2 hover:bg-gray-100">
          <svg
            className="h-5 w-5 text-gray-600"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        {[1, 2, 3, 4, 5].map((page) => (
          <button
            key={page}
            className={`h-8 w-8 rounded-lg ${
              currentPage === page
                ? "bg-gray-200 text-gray-700"
                : "text-gray-600 hover:bg-gray-100"
            }`}
            onClick={() => setCurrentPage(page)}
          >
            {page}
          </button>
        ))}
        <button className="rounded-lg p-2 hover:bg-gray-100">
          <svg
            className="h-5 w-5 text-gray-600"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
