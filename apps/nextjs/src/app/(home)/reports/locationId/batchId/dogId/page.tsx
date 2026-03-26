"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Copy, Maximize } from "lucide-react";

import { api } from "~/utils/api";

interface DogProfile {
  id: string;
  operationTaskId: string;
  batchId: string;
  dogImageUrl: string;
  gender: string;
  location: string | null;
  coordinates: {
    lat: number;
    lng: number;
  } | null;
  fullAddress: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export default function DogProfilePage() {
  const params = useParams();
  const dogId = params.dogId as string;

  // Fetch dog data using tRPC
  const { data: dogData, isLoading } = api.dogs.getDogById.useQuery({ dogId });

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        Loading...
      </div>
    );
  }

  if (!dogData) {
    return (
      <div className="flex h-screen items-center justify-center">
        Dog not found
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-8 p-8">
      {/* Left Column - Dog Profile */}
      <div>
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900">Dog Profile</h2>
        </div>

        <div className="mb-6 flex items-start gap-4">
          <div className="relative h-24 w-24 overflow-hidden rounded-full">
            <img
              src={dogData.dogImageUrl}
              alt={`Dog ${dogData.id}`}
              className="h-full w-full object-cover"
            />
          </div>

          <div className="flex-1">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-lg font-semibold">
                {dogData.id.slice(0, 8).toUpperCase()}
              </span>
              <button className="rounded-full p-1 hover:bg-gray-100">
                <Copy className="h-4 w-4 text-blue-500" />
              </button>
            </div>
            <div className="text-sm text-gray-600">
              Dog · {dogData.location || "Location not specified"}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">{dogData.gender}</span>
              <span className="text-sm font-medium text-red-500">
                {dogData.status}
              </span>
            </div>
          </div>
        </div>

        <div className="mb-8">
          <h3 className="mb-4 text-base font-medium">Important dates</h3>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
                <svg
                  className="h-5 w-5 text-blue-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 14l-7 7m0 0l-7-7m7 7V3"
                  />
                </svg>
              </div>
              <div>
                <div className="font-medium">Capture</div>
                <div className="text-sm text-gray-600">
                  {new Date(dogData.createdAt).toLocaleDateString("en-US", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </div>
                <div className="text-sm text-gray-600">
                  {new Date(dogData.createdAt).toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "numeric",
                    hour12: true,
                  })}
                </div>
              </div>
            </div>

            {dogData.status === "released" && (
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
                  <svg
                    className="h-5 w-5 text-blue-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 10l7-7m0 0l7 7m-7-7v18"
                    />
                  </svg>
                </div>
                <div>
                  <div className="font-medium">Release</div>
                  <div className="text-sm text-gray-600">
                    {new Date(dogData.updatedAt).toLocaleDateString("en-US", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Operation Task Details will be added here after fetching task data */}
      </div>

      {/* Right Column - Map */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-medium">Capture & Release Location</h3>
          <button className="rounded-lg p-2 hover:bg-gray-100">
            <Maximize className="h-5 w-5 text-gray-700" />
          </button>
        </div>

        <div className="relative h-[400px] w-full overflow-hidden rounded-lg bg-gray-100">
          {dogData.coordinates && (
            <div className="absolute bottom-4 left-4 right-4">
              <div className="rounded-lg bg-white p-4 shadow-lg">
                <div className="mb-2 flex items-center gap-2">
                  <img
                    src={dogData.dogImageUrl}
                    alt="Dog location"
                    className="h-8 w-8 rounded-full"
                  />
                  <div>
                    <div className="text-sm">
                      {new Date(dogData.createdAt).toLocaleDateString("en-US", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}{" "}
                      |{" "}
                      {new Date(dogData.createdAt).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "numeric",
                        hour12: true,
                      })}
                    </div>
                    <div className="text-sm font-medium">
                      {dogData.fullAddress || dogData.location}
                    </div>
                  </div>
                </div>
                {dogData.coordinates && (
                  <div className="flex items-center justify-between text-sm">
                    <div>Lat: {dogData.coordinates.lat.toFixed(4)}</div>
                    <div>Lng: {dogData.coordinates.lng.toFixed(4)}</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
