"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, Heart, MapPin, Search } from "lucide-react";

import { Button } from "~/components/ui/button";
import { api } from "~/utils/api";

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
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Fetch locations and batches using tRPC
  const { data: locationData, isLoading: isLoadingLocations } =
    api.location.getAllLocations.useQuery();
  const { data: batchesData, isLoading: isLoadingBatches } =
    api.task.getAllBatches.useQuery();
  const locations = locationData
    ? [...(locationData.capture ?? []), ...(locationData.release ?? [])]
    : [];

  // Filter locations based on search term
  // Pre-compute batch metrics by location id
  const batchMetrics = useMemo(() => {
    const map = new Map<string, { ops: number; dogs: number }>();
    batchesData?.forEach((batch) => {
      const locId = batch.operationTask?.circle?.location?.id;
      if (!locId) return;
      const entry = map.get(locId) ?? { ops: 0, dogs: 0 };
      entry.ops += 1;
      entry.dogs += batch.totalDogs ?? 0;
      map.set(locId, entry);
    });
    return map;
  }, [batchesData]);

  const filteredLocations = locations.filter(
    (location) =>
      location.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      location.area.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const handleExplore = (locationId: string) => {
    router.push(`/reports/locationId?id=${locationId}`);
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setShowSuggestions(false);
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  if (isLoadingLocations || isLoadingBatches) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="mx-auto max-w-[1800px] p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="flex items-center text-2xl font-semibold text-gray-800">
          <Activity className="mr-2 text-blue-500" /> Hello Admin!
        </h1>
      </div>

      {/* Title Section */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">Operational reports</h2>
        <p className="flex items-center text-sm text-gray-600">
          <Heart className="mr-2 text-red-500" /> Capture and Release reports
        </p>
      </div>

      {/* Filters Section */}
      <div className="mb-8 rounded-xl bg-blue-500 p-6 shadow-lg">
        <h3 className="mb-2 text-lg font-semibold text-white">Filters</h3>
        <p className="mb-4 text-sm text-blue-100">Search by location</p>

        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <label className="mb-2 block text-sm text-white">Location</label>
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setShowSuggestions(true);
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowSuggestions(true);
                }}
                placeholder="Search location..."
                className="w-full rounded-md border-0 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 sm:text-base"
              />
              <Search className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            </div>

            {/* Suggestions Dropdown */}
            {showSuggestions && searchTerm && (
              <div className="absolute z-10 mt-1 w-full rounded-md bg-white py-1 shadow-lg">
                {filteredLocations.length > 0 ? (
                  filteredLocations.map((location) => (
                    <button
                      key={location.id}
                      className="flex w-full items-center px-4 py-2 text-left text-sm text-gray-900 hover:bg-gray-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSearchTerm(location.name);
                        setShowSuggestions(false);
                      }}
                    >
                      <div>
                        <div className="font-medium">{location.name}</div>
                        <div className="text-xs text-gray-500">
                          {location.area}
                        </div>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-2 text-sm text-gray-500">
                    No locations found
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="mt-2 flex items-end sm:mt-0">
            <Button
              className="bg-black px-8 text-white hover:bg-gray-800"
              onClick={() => setShowSuggestions(false)}
            >
              Search
            </Button>
          </div>
        </div>
      </div>

      {/* Location Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(searchTerm ? filteredLocations : locations).map((location) => {
          const ops = batchMetrics.get(location.id)?.ops ?? 0;
          const dogs = batchMetrics.get(location.id)?.dogs ?? 0;

          return (
            <div
              key={location.id}
              className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg duration-300"
            >
              {/* Top Section - Gradient Background */}
              <div className="mr-4 h-[180px] bg-blue-50 p-6">
                {/* Location Icon */}
                <div className="mb-6">
                  <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-blue-500 shadow-sm">
                    <MapPin className="h-8 w-8 text-white" />
                  </div>
                </div>

                {/* Location Name */}
                <div className="mb-2">
                  <h3
                    className="mb-2 text-xl font-bold text-gray-900"
                    title={location.name}
                  >
                    {location.name}
                  </h3>
                </div>

                {/* Operations */}
                <div className="mb-3 flex items-center">
                  <p className="text-sm text-gray-700">
                    Operations so far - <span className="font-bold">{ops}</span>
                  </p>
                </div>
              </div>

              {/* Bottom Section - White Background */}
              <div className="flex h-[100px] items-center justify-between bg-white p-6">
                {/* Total Impact */}
                <div>
                  <p className="mb-1 text-base text-gray-900">Total Impact</p>
                  <p className="flex items-center text-xl font-bold text-gray-700">
                    {dogs} <span className="ml-2">🐶</span>
                  </p>
                </div>

                {/* Explore Button */}
                <Button
                  className="rounded-xl bg-black px-6 py-2.5 text-sm font-medium text-white hover:bg-gray-800"
                  onClick={() => handleExplore(location.id)}
                >
                  Explore
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
