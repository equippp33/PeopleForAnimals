
"use client";

import type { TRPCClientErrorLike } from "@trpc/client";
import type { inferRouterOutputs } from "@trpc/server";
import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import {
  Autocomplete,
  GoogleMap,
  MarkerF,
  useJsApiLoader,
} from "@react-google-maps/api";
import {
  ChevronLeft,
  ChevronRight,
  Edit2,
  Plus,
  Search,
  X,
} from "lucide-react";

import type { AppRouter } from "@acme/api";

import type { Coordinates, PlaceSelectionResult } from "~/server/google-maps";
import { GOOGLE_MAPS_CONFIG } from "~/server/google-maps";
import { api } from "~/trpc/react";

type RouterOutput = inferRouterOutputs<AppRouter>;

// Assuming getAllLocations returns an object like: { capture: LocationFromServerType[], release: LocationFromServerType[] }
type AllLocationsOutput = RouterOutput["location"]["getAllLocations"];
type LocationItem = AllLocationsOutput["capture"][number];

interface LocationClientView {
  id: string;
  name: string;
  area: string;
  type: "capture" | "release";
  coordinates: Coordinates;
  notes: string | null;
  circles: Circle[];
  volunteers: Volunteer[];
  createdAt: Date;
  updatedAt: Date;
  lastCaptureDate?: string | null;
  dogsCaptured?: number;
  lastReleaseDate?: string | null;
  dogsReleased?: number;
}

interface Circle {
  name: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  volunteers?: { name: string; phoneNumber: string }[]; // Added to match backend schema
}

interface Volunteer {
  name: string;
  phoneNumber: string;
  circleName: string;
  circleCoordinates: {
    lat: number;
    lng: number;
  };
}

export default function LocationsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);

  // Form fields for new location
  const [locationType, setLocationType] = useState<"capture" | "release">("capture");
  const [locationName, setLocationName] = useState("");
  const [locationArea, setLocationArea] = useState("");
  const [locationNotes, setLocationNotes] = useState("");
  const [coordinates, setCoordinates] = useState<Coordinates>({
    lat: GOOGLE_MAPS_CONFIG.defaultCenter.lat,
    lng: GOOGLE_MAPS_CONFIG.defaultCenter.lng,
  });

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  // Circles and volunteers state
  const [circles, setCircles] = useState<Circle[]>([]);
  const [currentCircle, setCurrentCircle] = useState("");
  const [currentCoordinates, setCurrentCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [currentVolunteer, setCurrentVolunteer] = useState<Volunteer>({
    name: "",
    phoneNumber: "",
    circleName: "",
    circleCoordinates: { lat: 0, lng: 0 },
  });
  const [phoneError, setPhoneError] = useState<string>("");

  const { isLoaded: isMapLoaded } = useJsApiLoader({
    id: "script-loader",
    googleMapsApiKey: GOOGLE_MAPS_CONFIG.apiKey,
    libraries: GOOGLE_MAPS_CONFIG.libraries,
  });

  const {
    data: locationsData,
    refetch: refetchLocations,
    isLoading: isLoadingLocations,
  } = api.location.getAllLocations.useQuery();

  const { mutate: createLocation } = api.location.createLocation.useMutation({
    onSuccess: () => {
      void refetchLocations();
      setIsModalOpen(false);
      resetForm();
    },
    onError: (error: TRPCClientErrorLike<AppRouter>) => {
      console.error("Failed to create location:", error.message);
      alert(`Error: ${error.message}`);
    },
  });

  const { mutate: updateLocation } = api.location.updateLocation.useMutation({
    onSuccess: () => {
      void refetchLocations();
      setIsModalOpen(false);
      resetForm();
    },
    onError: (error: TRPCClientErrorLike<AppRouter>) => {
      console.error("Failed to update location:", error.message);
      alert(`Error: ${error.message}`);
    },
  });

  const { mutate: deleteLocation } = api.location.deleteLocation.useMutation({
    onSuccess: () => {
      void refetchLocations();
      alert("Location deleted successfully.");
    },
    onError: (error: TRPCClientErrorLike<AppRouter>) => {
      console.error("Failed to delete location:", error.message);
      alert(`Error: ${error.message}`);
    },
  });

  const onLoad = useCallback((mapInstance: google.maps.Map) => {
    setMap(mapInstance);
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  const onPlaceSelected = () => {
    if (autocomplete) {
      const place = autocomplete.getPlace();
      if (place.geometry?.location) {
        const result: PlaceSelectionResult = {
          name: place.name ?? "",
          formattedAddress: place.formatted_address ?? "",
          coordinates: {
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
          },
        };

        setLocationName(result.name);
        setLocationArea(result.formattedAddress);
        setCoordinates(result.coordinates);

        map?.panTo(result.coordinates);
        map?.setZoom(15);
      }
    }
  };

  const onAutocompleteLoad = (ac: google.maps.places.Autocomplete) => {
    setAutocomplete(ac);
  };

  const toggleLocationSelection = (locationId: string) => {
    setSelectedLocations((prev) =>
      prev.includes(locationId)
        ? prev.filter((id) => id !== locationId)
        : [...prev, locationId],
    );
  };

  const handleOpenModal = (locationToEdit: LocationItem | null = null) => {
    resetForm();
    if (locationToEdit) {
      setLocationName(locationToEdit.name);
      setLocationArea(locationToEdit.area);
      setLocationNotes(locationToEdit.notes ?? "");
      setCoordinates(locationToEdit.coordinates);
      setCircles(locationToEdit.circles || []);
      setVolunteers(
        (locationToEdit.volunteers || []).map((volunteer) => {
          const circle = (locationToEdit.circles || []).find(
            (c) => c.name === volunteer.circleName,
          );
          return {
            ...volunteer,
            circleName: volunteer.circleName || circles[0]?.name || "",
            circleCoordinates: circle?.coordinates || locationToEdit.coordinates,
          };
        }),
      );
      if (locationToEdit.type === "capture" || locationToEdit.type === "release") {
        setLocationType(locationToEdit.type);
      } else {
        setLocationType("capture");
        console.warn("Received unexpected location type:", locationToEdit.type);
      }
      setEditingLocationId(locationToEdit.id);
    } else {
      setLocationType("capture");
    }
    setIsModalOpen(true);
  };

  const handleSubmit = () => {
    if (currentStep === 1) {
      if (!locationName) {
        alert("Zone name is required.");
        return;
      }
      setCurrentStep(2);
      return;
    }

    // Group volunteers by their assigned circle
    const circlesWithVolunteers = circles.map((circle) => ({
      ...circle,
      volunteers: volunteers
        .filter((volunteer) => volunteer.circleName === circle.name)
        .map((volunteer) => ({
          name: volunteer.name,
          phoneNumber: volunteer.phoneNumber,
        })),
    }));

    // Final submission
    const mainCoordinates =
      circlesWithVolunteers.length > 0 && circlesWithVolunteers[0]
        ? circlesWithVolunteers[0].coordinates
        : {
          lat: GOOGLE_MAPS_CONFIG.defaultCenter.lat,
          lng: GOOGLE_MAPS_CONFIG.defaultCenter.lng,
        };

    const locationData = {
      name: locationName,
      type: locationType,
      area: locationArea || locationName,
      notes: locationNotes,
      coordinates: mainCoordinates,
      circles: circlesWithVolunteers,
    };

    if (editingLocationId) {
      updateLocation({
        id: editingLocationId,
        data: locationData,
      });
    } else {
      createLocation(locationData);
    }
  };

  const resetForm = () => {
    setLocationName("");
    setLocationArea("");
    setLocationNotes("");
    setLocationType("capture");
    setCircles([]);
    setCurrentCircle("");
    setCurrentCoordinates(null);
    setVolunteers([]);
    setCurrentVolunteer({
      name: "",
      phoneNumber: "",
      circleName: "",
      circleCoordinates: { lat: 0, lng: 0 },
    });
    setCurrentStep(1);
    setEditingLocationId(null);
    setCoordinates({
      lat: GOOGLE_MAPS_CONFIG.defaultCenter.lat,
      lng: GOOGLE_MAPS_CONFIG.defaultCenter.lng,
    });
    if (map) {
      map.setCenter(GOOGLE_MAPS_CONFIG.defaultCenter);
      map.setZoom(GOOGLE_MAPS_CONFIG.defaultZoom);
    }
  };

  const handleEditLocation = (location: LocationItem) => {
    setLocationName(location.name);
    setLocationArea(location.area);
    setLocationNotes(location.notes ?? "");
    setCoordinates(location.coordinates);
    setCircles(location.circles || []);
    setVolunteers(
      (location.volunteers || []).map((volunteer) => {
        const circle = (location.circles || []).find(
          (c) => c.name === volunteer.circleName,
        );
        return {
          ...volunteer,
          circleName: volunteer.circleName || circles[0]?.name || "",
          circleCoordinates: circle?.coordinates || location.coordinates,
        };
      }),
    );
    if (location.type === "capture" || location.type === "release") {
      setLocationType(location.type);
    } else {
      setLocationType("capture");
      console.warn("Received unexpected location type:", location.type);
    }
    setEditingLocationId(location.id);
    setIsModalOpen(true);
  };

  const validatePhoneNumber = (phone: string) => {
    const numericOnly = phone.replace(/\D/g, "");
    if (numericOnly.length !== 10) {
      setPhoneError("Phone number must be exactly 10 digits");
      return false;
    }
    setPhoneError("");
    return true;
  };

  const handleCircleSelect = (circleName: string) => {
    const selectedCircle = circles.find((circle) => circle.name === circleName);
    if (selectedCircle) {
      setCurrentVolunteer({
        ...currentVolunteer,
        circleName,
        circleCoordinates: selectedCircle.coordinates,
      });
    }
  };

  const addVolunteer = () => {
    if (!currentVolunteer.name) {
      alert("Name is required for volunteers.");
      return;
    }
    if (!validatePhoneNumber(currentVolunteer.phoneNumber)) {
      return;
    }
    if (!currentVolunteer.circleName) {
      alert("Please select a circle for the volunteer.");
      return;
    }

    const selectedCircle = circles.find(
      (circle) => circle.name === currentVolunteer.circleName,
    );
    if (!selectedCircle) {
      alert("Selected circle not found. Please select a valid circle.");
      return;
    }

    setVolunteers([
      ...volunteers,
      {
        ...currentVolunteer,
        circleCoordinates: selectedCircle.coordinates,
      },
    ]);

    setCurrentVolunteer({
      name: "",
      phoneNumber: "",
      circleName: "",
      circleCoordinates: { lat: 0, lng: 0 },
    });
    setPhoneError("");
  };

  const removeVolunteer = (index: number) => {
    setVolunteers(volunteers.filter((_, i) => i !== index));
  };

  if (!isMapLoaded || isLoadingLocations) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-lg font-semibold">
          Loading map and locations...
        </div>
      </div>
    );
  }

  const currentLocations: LocationItem[] = locationsData?.capture ?? [];

  // Pagination logic
  const totalPages = Math.ceil(currentLocations.length / itemsPerPage);
  const paginatedLocations = currentLocations.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  };

  const handlePrevPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6 flex flex-col items-start justify-between gap-4 rounded-lg bg-white p-4 sm:p-6 shadow sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-800">Locations</h1>
          <p className="text-sm text-gray-500">
            Manage capture and release locations
          </p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 sm:px-4 sm:py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          <Plus size={18} />
          Location
        </button>
      </div>

      {/* Search Locations Card */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 sm:p-5 shadow-sm">
        <div className="mb-3">
          <h3 className="text-base font-medium text-gray-700">
            Search locations
          </h3>
          <p className="text-xs text-gray-500">
            Find locations by name or area
          </p>
        </div>
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search by name, area..."
            className="block w-full rounded-md border-gray-300 bg-white py-2 pl-10 pr-3 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Locations - Cards on Mobile, Table on Desktop */}
      <div className="w-full rounded-lg bg-white shadow">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4">
          <h2 className="text-lg font-medium text-gray-800">
            Current Locations ({currentLocations.length})
          </h2>
          {selectedLocations.length > 0 && (
            <button
              className="mt-4 sm:mt-0 flex items-center gap-2 rounded-lg bg-red-50 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100"
              onClick={() => {
                alert("Delete functionality will be implemented");
              }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 6h18" />
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
              </svg>
              Delete Selected ({selectedLocations.length})
            </button>
          )}
        </div>

        {/* Mobile Card View */}
        <div className="block md:hidden">
          {paginatedLocations.length > 0 ? (
            <div className="divide-y divide-gray-200">
              {paginatedLocations.map((location) => (
                <div key={location.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        checked={selectedLocations.includes(location.id)}
                        onChange={() => toggleLocationSelection(location.id)}
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-semibold text-gray-900">{location.name}</h3>
                          <button
                            onClick={() => handleEditLocation(location)}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            <Edit2 size={16} />
                          </button>
                        </div>

                        {/* Circles */}
                        <div className="mt-2 flex flex-wrap gap-1">
                          {location.circles?.map((circle, index) => (
                            <span
                              key={index}
                              className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800"
                            >
                              {circle.name}
                            </span>
                          )) ?? <span className="text-xs text-gray-500">No circles</span>}
                        </div>

                        {/* Stats Grid */}
                        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-xs text-gray-500">Last Capture</p>
                            <p className="font-medium text-gray-900">
                              {location.lastCaptureDate
                                ? new Date(location.lastCaptureDate).toLocaleDateString("en-GB", {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                  })
                                : "N/A"}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Dogs Captured</p>
                            <p className="font-medium text-gray-900">{location.dogsCaptured ?? 0}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Last Release</p>
                            <p className="font-medium text-gray-900">
                              {location.lastReleaseDate
                                ? new Date(location.lastReleaseDate).toLocaleDateString("en-GB", {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                  })
                                : "N/A"}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Dogs Released</p>
                            <p className="font-medium text-gray-900">{location.dogsReleased ?? 0}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-sm text-gray-500">
              No capture locations found.
            </div>
          )}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full table-fixed divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="w-12 p-4 text-left">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    checked={selectedLocations.length === currentLocations.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedLocations(
                          currentLocations.map((loc) => loc.id),
                        );
                      } else {
                        setSelectedLocations([]);
                      }
                    }}
                  />
                </th>
                <th
                  scope="col"
                  className="w-1/4 px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  Zone Name
                </th>
                <th
                  scope="col"
                  className="w-1/4 px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  Circles
                </th>
                <th
                  scope="col"
                  className="w-1/6 px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  Last Capture Date
                </th>
                <th
                  scope="col"
                  className="w-1/6 px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  Dogs Captured
                </th>
                <th
                  scope="col"
                  className="w-1/6 px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  Last Release Date
                </th>
                <th
                  scope="col"
                  className="w-1/6 px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  Dogs Released
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {paginatedLocations.length > 0 ? (
                paginatedLocations.map((location) => (
                  <tr key={location.id} className="hover:bg-gray-50">
                    <td className="p-4">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        checked={selectedLocations.includes(location.id)}
                        onChange={() => toggleLocationSelection(location.id)}
                      />
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                      <div className="flex items-center">
                        <span className="truncate" title={location.name}>
                          {location.name}
                        </span>
                        <button
                          onClick={() => handleEditLocation(location)}
                          className="ml-2 shrink-0 text-blue-600 hover:text-blue-800"
                        >
                          <Edit2 size={16} />
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      <div className="flex flex-wrap gap-1">
                        {location.circles?.map((circle, index) => (
                          <span
                            key={index}
                            className="inline-flex rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800"
                            title={circle.name}
                          >
                            {circle.name}
                          </span>
                        )) ?? "No circles"}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {location.lastCaptureDate
                        ? new Date(location.lastCaptureDate).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })
                        : "N/A"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {location.dogsCaptured ?? 0}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {location.lastReleaseDate
                        ? new Date(location.lastReleaseDate).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })
                        : "N/A"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {location.dogsReleased ?? 0}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={7}
                    className="py-12 text-center text-sm text-gray-500"
                  >
                    No capture locations found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-center border-t border-gray-200 bg-white px-4 py-3 sm:px-6">
            <nav
              className="isolate inline-flex -space-x-px rounded-md shadow-sm"
              aria-label="Pagination"
            >
              <button
                onClick={handlePrevPage}
                disabled={currentPage === 1}
                className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
              >
                <span className="sr-only">Previous</span>
                <ChevronLeft className="h-5 w-5" aria-hidden="true" />
              </button>
              {[...Array(totalPages)].map((_, i) => (
                <button
                  key={i + 1}
                  onClick={() => setCurrentPage(i + 1)}
                  aria-current={currentPage === i + 1 ? "page" : undefined}
                  className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${currentPage === i + 1 ? "z-10 bg-blue-600 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600" : "text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0"}`}
                >
                  {i + 1}
                </button>
              ))}
              <button
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
                className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
              >
                <span className="sr-only">Next</span>
                <ChevronRight className="h-5 w-5" aria-hidden="true" />
              </button>
            </nav>
          </div>
        )}
      </div>

      {/* Modal for Add/Edit Location */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4 transition-opacity duration-300 ease-in-out">
          <div className="w-full max-w-lg rounded-xl bg-white p-4 sm:p-6 shadow-2xl">
            <h2 className="mb-6 text-center text-lg sm:text-xl font-semibold text-gray-800">
              {currentStep === 1
                ? locationName
                  ? "Edit location"
                  : "Add new location"
                : "Add Volunteers"}
            </h2>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmit();
              }}
              className="space-y-4 sm:space-y-5"
            >
              {currentStep === 1 ? (
                <>
                  <div>
                    <label
                      htmlFor="locationName"
                      className="mb-1 block text-sm font-medium text-gray-700"
                    >
                      Zone Name
                    </label>
                    <input
                      type="text"
                      id="locationName"
                      value={locationName}
                      onChange={(e) => setLocationName(e.target.value)}
                      placeholder="Enter zone name"
                      className="block w-full rounded-lg border-gray-300 p-2.5 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="locationZone"
                      className="mb-1 block text-sm font-medium text-gray-700"
                    >
                      Circles
                    </label>
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2">
                        {circles.map((circle, index) => (
                          <div
                            key={index}
                            className="flex items-center rounded-full bg-blue-100 px-2 py-1 text-sm"
                          >
                            <span className="mr-1 text-blue-800">
                              {circle.name}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setCircles(circles.filter((_, i) => i !== index));
                              }}
                              className="ml-1 rounded-full p-1 hover:bg-blue-200"
                            >
                              <X size={14} className="text-blue-600" />
                            </button>
                          </div>
                        ))}
                      </div>
                      {isMapLoaded && (
                        <Autocomplete
                          onLoad={onAutocompleteLoad}
                          onPlaceChanged={() => {
                            if (autocomplete) {
                              const place = autocomplete.getPlace();
                              if (place.geometry?.location && place.name) {
                                const newCircle = {
                                  name: place.name,
                                  coordinates: {
                                    lat: place.geometry.location.lat(),
                                    lng: place.geometry.location.lng(),
                                  },
                                };
                                setCircles([...circles, newCircle]);
                                setCurrentCircle("");
                                setCurrentCoordinates(null);
                                if (map) {
                                  map.panTo(newCircle.coordinates);
                                  map.setZoom(15);
                                }
                              }
                            }
                          }}
                        >
                          <input
                            type="text"
                            value={currentCircle}
                            onChange={(e) => setCurrentCircle(e.target.value)}
                            placeholder="Search and select a place to add circle"
                            className="block w-full rounded-lg border-gray-300 p-2.5 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                          />
                        </Autocomplete>
                      )}
                    </div>
                  </div>

                  <div className="h-40 w-full rounded-lg border border-gray-300">
                    {isMapLoaded && (
                      <GoogleMap
                        mapContainerClassName="w-full h-full rounded-lg"
                        center={coordinates}
                        zoom={map?.getZoom() ?? GOOGLE_MAPS_CONFIG.defaultZoom}
                        onLoad={onLoad}
                        onUnmount={onUnmount}
                      >
                        {circles.map((circle, index) => (
                          <MarkerF
                            key={index}
                            position={circle.coordinates}
                            label={`${index + 1}`}
                          />
                        ))}
                        {currentCoordinates && (
                          <MarkerF position={currentCoordinates} label="New" />
                        )}
                      </GoogleMap>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="locationNotes"
                      className="mb-1 block text-sm font-medium text-gray-700"
                    >
                      Comments
                    </label>
                    <input
                      type="text"
                      id="locationNotes"
                      value={locationNotes}
                      onChange={(e) => setLocationNotes(e.target.value)}
                      placeholder="Enter additional notes"
                      className="block w-full rounded-lg border-gray-300 p-2.5 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                </>
              ) : (
                <div className="space-y-4 sm:space-y-6">
                  <div className="rounded-lg border border-gray-200 bg-white p-4 sm:p-6">
                    <h3 className="mb-4 text-lg font-medium text-gray-900">
                      Add Volunteer
                    </h3>

                    <div className="space-y-4">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-sm font-medium text-gray-700">
                            Volunteer Name
                          </label>
                          <input
                            type="text"
                            value={currentVolunteer.name}
                            onChange={(e) =>
                              setCurrentVolunteer({
                                ...currentVolunteer,
                                name: e.target.value,
                              })
                            }
                            placeholder="Enter volunteer name"
                            className="block w-full rounded-lg border-gray-300 p-2.5 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-sm font-medium text-gray-700">
                            Phone Number
                          </label>
                          <input
                            type="tel"
                            value={currentVolunteer.phoneNumber}
                            onChange={(e) => {
                              const value = e.target.value.replace(/\D/g, "").slice(0, 10);
                              setCurrentVolunteer({
                                ...currentVolunteer,
                                phoneNumber: value,
                              });
                              if (value.length === 10) {
                                validatePhoneNumber(value);
                              } else {
                                setPhoneError(
                                  value.length > 0
                                    ? "Phone number must be exactly 10 digits"
                                    : "",
                                );
                              }
                            }}
                            placeholder="Enter 10-digit phone number"
                            className={`block w-full rounded-lg border-gray-300 p-2.5 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500 ${phoneError ? "border-red-500" : ""
                              }`}
                          />
                          {phoneError && (
                            <p className="mt-1 text-xs text-red-500">
                              {phoneError}
                            </p>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                          Assign to Circle
                        </label>
                        {circles.length > 0 ? (
                          <select
                            value={currentVolunteer.circleName}
                            onChange={(e) => handleCircleSelect(e.target.value)}
                            className="block w-full rounded-lg border-gray-300 p-2.5 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                          >
                            <option value="">Select a circle</option>
                            {circles.map((circle, index) => (
                              <option key={index} value={circle.name}>
                                {circle.name} ({circle.coordinates.lat.toFixed(4)},{" "}
                                {circle.coordinates.lng.toFixed(4)})
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
                            Please add at least one circle before adding volunteers.
                          </div>
                        )}
                      </div>

                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={addVolunteer}
                          disabled={circles.length === 0}
                          className={`rounded-lg px-3 py-2 text-white ${circles.length > 0
                              ? "bg-blue-500 hover:bg-blue-600"
                              : "cursor-not-allowed bg-gray-400"
                            }`}
                        >
                          Add Volunteer
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="h-40 overflow-y-auto rounded-lg border border-gray-200 bg-white p-4 sm:p-6">
                    <h3 className="mb-4 text-lg font-medium text-gray-900">
                      Added Volunteers ({volunteers.length})
                    </h3>
                    <div className="max-h-[400px] space-y-3 overflow-y-auto">
                      {volunteers.map((volunteer, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 p-2 sm:p-4"
                        >
                          <div className="space-y-1">
                            <p className="font-medium text-gray-900">
                              {volunteer.name}
                            </p>
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                              <span>{volunteer.phoneNumber}</span>
                              <span>•</span>
                              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                                {volunteer.circleName}
                              </span>
                            </div>
                            <div className="text-xs text-gray-500">
                              Coordinates: {volunteer.circleCoordinates.lat.toFixed(4)},{" "}
                              {volunteer.circleCoordinates.lng.toFixed(4)}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeVolunteer(index)}
                            className="rounded-full p-1 text-red-500 hover:bg-red-50"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ))}
                      {volunteers.length === 0 && (
                        <p className="text-center text-sm text-gray-500">
                          No volunteers added yet
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    if (currentStep === 2) {
                      setCurrentStep(1);
                    } else {
                      setIsModalOpen(false);
                      resetForm();
                    }
                  }}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 sm:w-auto"
                >
                  {currentStep === 2 ? "Back" : "Cancel"}
                </button>
                <button
                  type="submit"
                  className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:w-auto"
                >
                  {currentStep === 1 ? "Next" : "Save Location"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

