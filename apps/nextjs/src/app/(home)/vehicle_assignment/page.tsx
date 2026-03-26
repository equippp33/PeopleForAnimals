"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronDownIcon, Trash2, Truck, User2, X } from "lucide-react";

import { api } from "~/trpc/react";

interface Vehicle {
  id: string;
  name: string | null;
  vehicleNumber: string | null;
  vehicleColor: string | null;
  locationName: string | null;
  locationCoordinates: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

interface Team {
  id: string;
  name: string;
  category: string;
  vehicleId: string | null;
  members: {
    id: string;
    name: string;
    role: string;
    category: string;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

interface Location {
  id: string;
  name: string;
  type: string;
  area: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  circles: {
    name: string;
    coordinates: {
      lat: number;
      lng: number;
    };
  }[];
}

interface Batch {
  id: string;
  batchNumber: string;
  operationTaskId: string;
  status: "active" | "completed" | "cancelled" | null;
  startTime: Date | null;
  endTime: Date | null;
  totalDogs: number | null;
  release_date: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

interface ReleaseTask {
  id: string;
  vehicleId: string;
  batchId: string;
  teamId: string | null;
  status: "pending" | "active" | "completed";
  team?: Team;
}

const VehiclePage = () => {
  const [showModal, setShowModal] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [showReleaseTeamModal, setShowReleaseTeamModal] = useState(false);
  const [teamSelectionContext, setTeamSelectionContext] = useState<{
    vehicleId: string;
    batchId: string;
  } | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [vehicleName, setVehicleName] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [colorCode, setColorCode] = useState("");
  const [teamName, setTeamName] = useState("");
  const [showColorDropdown, setShowColorDropdown] = useState(false);
  const [showTeamNameDropdown, setShowTeamNameDropdown] = useState(false);
  const [showBatchDropdown, setShowBatchDropdown] = useState<Record<string, boolean>>({});
  const [currentVehicleId, setCurrentVehicleId] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(
    null,
  );
  const [selectedBatchByVehicle, setSelectedBatchByVehicle] = useState<
    Record<string, string | undefined>
  >({});

  const dropdownRef = useRef<HTMLDivElement>(null);
  const teamNameDropdownRef = useRef<HTMLDivElement>(null);
  const batchRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const { data: vehicles, refetch: refetchVehicles } =
    api.vehicle.getAllVehicles.useQuery();
  const { data: batches } = api.task.getAllBatches.useQuery();
  const { data: unassignedTeams, refetch: refetchUnassignedTeams } =
    api.team.getUnassignedTeams.useQuery();
  const { data: allTeams, refetch: refetchTeams } =
    api.team.getAllTeams.useQuery();
  const { data: releaseTasks, refetch: refetchReleaseTasks } =
    api.task.getAllReleaseTasks.useQuery<ReleaseTask[]>();

  const getReleaseTask = (vehicleId: string, batchId: string | undefined) => {
    if (!releaseTasks || !batchId) return undefined;
    return releaseTasks.find(
      (t) => t.vehicleId === vehicleId && t.batchId === batchId,
    );
  };

  React.useEffect(() => {
    if (!releaseTasks) return;
    setSelectedBatchByVehicle((prev) => {
      const updated: Record<string, string | undefined> = { ...prev };
      releaseTasks.forEach((t) => {
        if (t.vehicleId && t.batchId) {
          if (t.teamId && t.status !== "completed") {
            updated[t.vehicleId] = t.batchId;
          } else if (t.status === "completed" && updated[t.vehicleId] === t.batchId) {
            delete updated[t.vehicleId];
          }
        }
      });
      return updated;
    });
  }, [releaseTasks]);

  // Batches currently assigned and not completed (disable selection)
  const assignedBatchIds = React.useMemo(() => {
    if (!releaseTasks) return new Set<string>();
    return new Set(
      releaseTasks
        .filter((t) => t.teamId && t.status !== "completed")
        .map((t) => t.batchId),
    );
  }, [releaseTasks]);

  // Batches whose release task is already completed (hide from dropdown)
  const completedBatchIds = React.useMemo(() => {
    if (!releaseTasks) return new Set<string>();
    return new Set(
      (releaseTasks as any[])
        .filter((t) => t.status === "completed")
        .map((t) => t.batchId),
    );
  }, [releaseTasks]);

  // Get teams for vehicles
  const getTeamForVehicle = (vehicleId: string) => {
    return allTeams?.find((team) => team.vehicleId === vehicleId);
  };

  const batchesWithReleaseDates =
    batches?.filter(
      (batch) => batch.release_date !== null && batch.status === "completed",
    ) ?? [];

  const batchLocations = batchesWithReleaseDates.map((batch) => ({
    id: batch.id,
    name: batch.batchNumber,
    type: "batch",
    area: "Release Area",
    coordinates: { lat: 0, lng: 0 },
    circles: [],
  }));

  const { mutate: createVehicle } = api.vehicle.createVehicle.useMutation({
    onSuccess: () => {
      console.log("Vehicle created successfully");
      void refetchVehicles();
      setShowModal(false);
      resetForm();
    },
    onError: (error) => {
      console.error("Error creating vehicle:", error);
    },
  });

  const { mutate: updateVehicleLocation } =
    api.vehicle.updateVehicleLocation.useMutation({
      onSuccess: () => {
        void refetchVehicles();
      },
    });

  const { mutate: deleteVehicle } = api.vehicle.deleteVehicle.useMutation({
    onSuccess: () => {
      void refetchVehicles();
      void refetchTeams();
      void refetchUnassignedTeams();
    },
  });

  const { mutate: assignTeam } = api.team.assignTeamToVehicle.useMutation({
    onSuccess: () => {
      void refetchVehicles();
      setShowReleaseTeamModal(false);
      resetTeamForm();
      void refetchTeams();
    },
  });

  const { mutate: removeTeam } = api.team.removeTeamFromVehicle.useMutation({
    onSuccess: () => {
      void refetchVehicles();
      void refetchTeams();
      void refetchUnassignedTeams();
    },
  });

  const { mutate: assignRelease } =
    api.task.assignReleaseTaskFromBatch.useMutation({
      onSuccess: () => {
        console.log("Release task assigned");
        void refetchReleaseTasks();
      },
    });

  const { mutate: unassignRelease } =
    api.task.unassignReleaseTask.useMutation({
      onSuccess: () => {
        console.log("Release task unassigned");
        void refetchReleaseTasks();
        // Clear the selected batch for this vehicle
        setSelectedBatchByVehicle((prev) => {
          const updated = { ...prev };
          // Remove any batch selection that was just unassigned
          return updated;
        });
      },
    });

  const isFormValid = vehicleName && vehicleNumber && colorCode;
  const isTeamFormValid = teamName;

  const colorOptions = [
    { name: "Blue", value: "blue", textColor: "#1B85F3", bgColor: "#EBF5FF" },
    { name: "Pink", value: "pink", textColor: "#FFC0CB", bgColor: "#FFF0F5" },
    {
      name: "Orange",
      value: "orange",
      textColor: "#FFA500",
      bgColor: "#FFF8DC",
    },
    { name: "Red", value: "red", textColor: "#FF0000", bgColor: "#FFF0F0" },
    { name: "Green", value: "green", textColor: "#008000", bgColor: "#F0FFF0" },
  ];

  const handleCloseModal = () => {
    setShowModal(false);
    resetForm();
  };

  const handleCloseTeamModal = () => {
    setShowTeamModal(false);
    resetTeamForm();
  };

  const resetForm = () => {
    setVehicleName("");
    setVehicleNumber("");
    setColorCode("");
    setShowColorDropdown(false);
  };

  const resetTeamForm = () => {
    setTeamName("");
    setShowTeamNameDropdown(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("handleSubmit called with:", { vehicleName, vehicleNumber, colorCode, isFormValid });
    if (isFormValid) {
      console.log("Creating vehicle...");
      createVehicle({
        name: vehicleName,
        vehicleNumber: vehicleNumber,
        vehicleColor: colorCode,
      });
    } else {
      console.log("Form not valid");
    }
  };

  const handleUpdateLocation = (
    vehicleId: string,
    locationOrBatch: Location | Batch,
  ) => {
    const isLocation = "type" in locationOrBatch;
    const locationData = isLocation
      ? (locationOrBatch)
      : {
        name: (locationOrBatch).batchNumber,
        locationCoordinates: JSON.stringify({ lat: 0, lng: 0 }),
      };

    updateVehicleLocation({
      vehicleId,
      locationName: locationData.name,
      locationCoordinates:
        "locationCoordinates" in locationData &&
          typeof locationData.locationCoordinates === "string"
          ? locationData.locationCoordinates
          : JSON.stringify((locationData as Location).coordinates),
    });
  };

  const handleDeleteVehicle = (vehicleId: string) => {
    deleteVehicle({ vehicleId });
  };

  const handleTeamSubmit = () => {
    if (isTeamFormValid && currentVehicleId) {
      assignTeam({
        teamId: teamName,
        vehicleId: currentVehicleId,
      });
    }
  };

  const handleRemoveTeam = (teamId: string) => {
    removeTeam({ teamId });
  };

  const handleOpenTeamModal = (vehicleId: string) => {
    setCurrentVehicleId(vehicleId);
    setShowTeamModal(true);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (
        dropdownRef.current &&
        event.target instanceof Node &&
        !dropdownRef.current.contains(event.target)
      ) {
        setShowColorDropdown(false);
      }

      if (
        teamNameDropdownRef.current &&
        event.target instanceof Node &&
        !teamNameDropdownRef.current.contains(event.target)
      ) {
        setShowTeamNameDropdown(false);
      }

      Object.keys(showBatchDropdown).forEach((key) => {
        if (showBatchDropdown[key]) {
          const ref = batchRefs.current[key];
          if (
            ref &&
            event.target instanceof Node &&
            !ref.contains(event.target)
          ) {
            setShowBatchDropdown((prev) => ({ ...prev, [key]: false }));
          }
        }
      });
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [showBatchDropdown]);

  if (!vehicles || !batches || !unassignedTeams || !allTeams) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  const availableLocations: Location[] = batchesWithReleaseDates.map(
    (batch) => ({
      id: batch.id,
      name: batch.batchNumber,
      type: "batch",
      area: "Release Area",
      coordinates: { lat: 0, lng: 0 },
      circles: [],
    }),
  );

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-medium text-[#1B85F3] sm:text-2xl">Hello Admin</h2>
          <div className="w-full sm:w-auto">
            <div className="relative h-[41px] w-full sm:w-[400px] lg:w-[530px]">
              <input
                type="text"
                placeholder="Search Employee, Doctor, Dog ID"
                className="h-full w-full border-0 border-b border-[#81D0DF] bg-white px-4 py-2 text-black focus:outline-none"
              />
              <Image
                src="/assets/images/search.png"
                alt="Search"
                width={20}
                height={20}
                className="absolute right-3 top-1/2 -translate-y-1/2 transform"
              />
            </div>
          </div>
        </div>
      </div>
      <div className="mb-4 mt-6 flex flex-col gap-4 sm:mt-10 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-black sm:text-2xl">
            Vehicle assignment
          </h1>
          <p className="text-sm text-black sm:text-base">Assign vehicles to team and routes</p>
        </div>
        <button
          className="flex h-[48px] w-full items-center justify-center rounded-[14px] border border-[#1B85F3] bg-white text-[#1B85F3] sm:h-[54px] sm:w-[241px]"
          onClick={() => setShowModal(true)}
        >
          <span className="mr-1 text-[#1B85F3]">+</span>
          <span className="text-[#1B85F3]">Add new vehicle</span>
        </button>
      </div>
      <div className="mt-4 space-y-4">
        {vehicles.map((vehicle) => {
          const vehicleColor = colorOptions.find(
            (c) => c.value === vehicle.vehicleColor,
          );
          const team = getTeamForVehicle(vehicle.id);
          const isReadyForTask =
            team !== undefined && vehicle.locationName !== null;

          return (
            <div
              key={vehicle.id}
              className={`relative mx-auto h-auto min-h-[218px] rounded-lg border ${showBatchDropdown[vehicle.id] ? "z-20" : ""}`}
            >
              <div
                className="absolute inset-0 m-[9px] rounded-[8px]"
                style={{ backgroundColor: vehicleColor?.bgColor || "#EBF5FF" }}
              ></div>
              <div className="relative z-10 flex h-full flex-col sm:flex-row">
                <div className="flex w-full flex-col p-4 sm:w-1/2">
                  <div className="mb-0 flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="relative mr-2 rounded-md border border-black p-2">
                        <Truck />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-black">
                          {vehicle.name}
                        </h3>
                        <p className="text-xs text-gray-600">
                          Lic plate: {vehicle.vehicleNumber}
                        </p>
                      </div>
                    </div>
                    <button
                      className="p-1"
                      onClick={() => handleDeleteVehicle(vehicle.id)}
                    >
                      <Trash2
                        size={20}
                        className="text-gray-700 hover:text-red-500"
                      />
                    </button>
                  </div>
                  <div className="mt-4">
                    <label className="mb-1 block text-sm text-black">
                      Select Batch
                    </label>
                    <div className="relative" ref={(el) => (batchRefs.current[vehicle.id] = el)}>
                      <div
                        className={`h-[34px] w-full flex items-center justify-between appearance-none rounded-md border px-3 text-black ${(() => { const rt = getReleaseTask(vehicle.id, selectedBatchByVehicle[vehicle.id]); return rt?.teamId && rt.status !== 'completed'; })() ? 'border-gray-300 bg-gray-100 text-gray-400 cursor-not-allowed' : 'border-gray-300 bg-white cursor-pointer'}`}
                        onClick={() => {
                          const rt = getReleaseTask(
                            vehicle.id,
                            selectedBatchByVehicle[vehicle.id],
                          );
                          const disabled = !!rt && !!rt.teamId && rt.status !== "completed";
                          if (!disabled) {
                            setShowBatchDropdown((prev) => ({
                              ...prev,
                              [vehicle.id]: !prev[vehicle.id],
                            }));
                          }
                        }}
                      >
                        <span className="truncate">
                          {selectedBatchByVehicle[vehicle.id]
                            ? (() => {
                              const batch = batchesWithReleaseDates.find(
                                (b) => b.id === selectedBatchByVehicle[vehicle.id],
                              );
                              return batch
                                ? `${batch.batchNumber} - ${batch.release_date ? new Date(batch.release_date).toLocaleDateString() : "No release date"}`
                                : "Select batch";
                            })()
                            : "Select batch"}
                        </span>
                        <ChevronDownIcon
                          className={`h-4 w-4 text-gray-700 transition-transform ${showBatchDropdown[vehicle.id] ? "rotate-180 transform" : ""}`}
                        />
                      </div>
                      {showBatchDropdown[vehicle.id] && (
                        <div className="absolute left-0 right-0 z-30 mt-1 max-h-60 w-full overflow-auto rounded-md border border-gray-300 bg-white text-sm shadow-lg sm:text-base">
                          {batchesWithReleaseDates
                            .filter(
                              (batch) =>
                                !completedBatchIds.has(batch.id) &&
                                (!assignedBatchIds.has(batch.id) ||
                                  selectedBatchByVehicle[vehicle.id] === batch.id),
                            )
                            .map((batch) => (
                              <div
                                key={batch.id}
                                className="cursor-pointer truncate px-4 py-2 hover:bg-gray-100"
                                onClick={() => {
                                  setSelectedBatchByVehicle((prev) => ({
                                    ...prev,
                                    [vehicle.id]: batch.id,
                                  }));
                                  handleUpdateLocation(vehicle.id, batch);
                                  setShowBatchDropdown((prev) => ({ ...prev, [vehicle.id]: false }));
                                }}
                              >
                                {batch.batchNumber} -{" "}
                                {batch.release_date
                                  ? new Date(batch.release_date).toLocaleDateString()
                                  : "No release date"}
                              </div>
                            ))}
                          {batchesWithReleaseDates.filter(
                            (batch) =>
                              !completedBatchIds.has(batch.id) &&
                              (!assignedBatchIds.has(batch.id) ||
                                selectedBatchByVehicle[vehicle.id] === batch.id),
                          ).length === 0 && (
                              <div className="px-4 py-2 text-xs text-gray-500 sm:text-sm">
                                No batches available
                              </div>
                            )}
                        </div>
                      )}
                    </div>
                    {/* Assign Task Button */}
                    {(() => {
                      const batchId = selectedBatchByVehicle[vehicle.id];


                      const releaseTask = getReleaseTask(vehicle.id, batchId);
                      // Debug log
                      console.log(
                        "releaseTasks",
                        releaseTasks,
                        "selected",
                        vehicle.id,
                        batchId,
                        "found",
                        releaseTask,
                      );

                      const controlsDisabled =
                        !!releaseTask && !!releaseTask.teamId && releaseTask.status !== "completed";
                      const isDisabled = !batchId || controlsDisabled;
                      return (
                        <div className="mt-3">
                          <button
                            className={`h-[44px] md:h-[34px] rounded-[20px] px-4 text-base md:text-sm w-full md:w-auto ${!isDisabled
                              ? "border border-[#1B85F3] bg-[#1B85F3] text-white hover:bg-blue-600"
                              : "cursor-not-allowed border border-gray-300 bg-gray-100 text-gray-400"
                              }`}
                            onClick={() => {
                              if (!isDisabled) {
                                setTeamSelectionContext({
                                  vehicleId: vehicle.id,
                                  batchId,
                                });
                                setShowReleaseTeamModal(true);
                              }
                            }}
                            disabled={isDisabled}
                          >
                            Assign Task
                          </button>
                          {/* Assigned team and status display */}
                          {releaseTask && (
                            <div className="mt-2 flex flex-col gap-2">
                              <div className="text-xs text-gray-700">
                                <span>
                                  Assigned Team:{" "}
                                  {releaseTask.team?.name || "None"}
                                </span>
                                <span className="ml-2">
                                  Status:{" "}
                                  <span
                                    className={`font-semibold ${releaseTask.status === "pending"
                                      ? "text-yellow-600"
                                      : releaseTask.status === "active"
                                        ? "text-blue-600"
                                        : "text-green-600"
                                      }`}
                                  >
                                    {releaseTask.status}
                                  </span>
                                </span>
                              </div>
                              {/* Unassign button - only show if task is assigned and not completed */}
                              {releaseTask.teamId && releaseTask.status !== "completed" && (
                                <button
                                  className="h-[34px] rounded-[20px] px-4 text-sm border border-red-500 bg-white text-red-500 hover:bg-red-50 w-full md:w-auto"
                                  onClick={() => {
                                    if (batchId) {
                                      unassignRelease({
                                        batchId,
                                        vehicleId: vehicle.id,
                                      });
                                      // Clear local state for this vehicle
                                      setSelectedBatchByVehicle((prev) => {
                                        const updated = { ...prev };
                                        delete updated[vehicle.id];
                                        return updated;
                                      });
                                    }
                                  }}
                                >
                                  Unassign Task
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    <div className="mt-4 flex gap-2">
                      {/* 
                      <button
                        onClick={() =>
                          handleUpdateLocation(vehicle.id, {
                            name: "",
                            coordinates: { lat: 0, lng: 0 },
                          })
                        }
                        className="h-[34px] rounded-[20px] border border-gray-300 px-4 text-sm text-black hover:bg-gray-50"
                      >
                        Reset Location
                      </button> 
                      */}
                    </div>
                  </div>
                </div>

                {/* Right section */}
                <div className="flex w-full sm:w-1/2 flex-col border-t sm:border-t-0 sm:border-l p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-medium text-black sm:text-base">
                        Current Team assignment
                      </h3>
                      {team ? (
                        <p className="text-xs text-gray-500 sm:text-sm">
                          {team.name} assigned
                        </p>
                      ) : (
                        <p className="text-sm text-gray-500">
                          No Team assigned
                        </p>
                      )}
                    </div>
                  </div>
                  {team ? (
                    <div className="overflow-y-auto mt-4">
                      <div className="mb-2 flex items-center justify-end">
                        <button
                          className="text-gray-500 hover:text-red-500"
                          onClick={() => handleRemoveTeam(team.id)}
                        >
                          <X size={20} />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {team.members.map((member) => (
                          <div
                            key={member.id}
                            className="flex items-center rounded-md border border-gray-200 bg-white p-2"
                          >
                            <div className="mr-2 flex h-6 w-6 items-center justify-center rounded-full">
                              <User2 size={18} />
                            </div>
                            <div className="flex-grow">
                              <p className="text-sm font-medium text-black">
                                {member.name}
                              </p>
                            </div>
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100">
                              <span className="text-xs font-semibold text-black">
                                {member.role.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="mr-9 mt-9 flex justify-center">
                      <button
                        className="flex h-[34px] w-[130px] items-center justify-center rounded-[20px] border border-[#1B85F3] px-4 text-sm text-[#1B85F3]"
                        onClick={() => handleOpenTeamModal(vehicle.id)}
                      >
                        <span className="mr-1">+</span>
                        <span>Assign team</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {showReleaseTeamModal && teamSelectionContext && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 overflow-y-auto">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800">
                Select Team
              </h2>
              <button
                onClick={() => {
                  setShowReleaseTeamModal(false);
                  setSelectedTeamId("");
                }}
              >
                <X size={20} />
              </button>
            </div>
            <ul className="max-h-60 overflow-y-auto">
              {allTeams?.map((team) => (
                <li
                  key={team.id}
                  className={`cursor-pointer rounded p-2 hover:bg-gray-100 ${selectedTeamId === team.id ? "bg-gray-100" : ""}`}
                  onClick={() => setSelectedTeamId(team.id)}
                >
                  <p className="font-medium text-gray-800">{team.name}</p>
                  <p className="text-xs text-gray-500">
                    Category: {team.category}
                  </p>
                </li>
              ))}
              {allTeams?.length === 0 && (
                <li className="p-2 text-center text-sm text-gray-500">
                  No teams available
                </li>
              )}
            </ul>
            <div className="mt-6 flex justify-end gap-2">
              <button
                className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                onClick={() => {
                  setShowReleaseTeamModal(false);
                  setSelectedTeamId("");
                }}
              >
                Cancel
              </button>
              <button
                disabled={!selectedTeamId}
                className={`rounded-md px-4 py-2 text-sm text-white ${selectedTeamId ? "bg-blue-600 hover:bg-blue-700" : "bg-gray-300"}`}
                onClick={() => {
                  if (selectedTeamId && teamSelectionContext) {
                    assignRelease({
                      batchId: teamSelectionContext.batchId,
                      vehicleId: teamSelectionContext.vehicleId,
                      teamId: selectedTeamId,
                    });
                    setShowReleaseTeamModal(false);
                    setSelectedTeamId("");
                  }
                }}
              >
                Assign
              </button>
            </div>
          </div>
        </div>
      )}
      {showModal && (
        <>
          <div className="fixed inset-0 bg-black bg-opacity-30 z-50" />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="w-full max-w-md rounded-2xl bg-white shadow-xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
              <div className="p-6 sm:p-8">
                <div className="mb-6 flex items-center justify-between">
                  <h2 className="text-xl font-medium text-gray-900">Add new vehicle</h2>
                  <button
                    onClick={handleCloseModal}
                    className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-500"
                  >
                    <X size={24} />
                  </button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Name</label>
                    <input
                      type="text"
                      placeholder="Enter name"
                      className="block w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                      value={vehicleName}
                      onChange={(e) => {
                        setVehicleName(e.target.value);
                        console.log("Vehicle Name updated:", e.target.value);
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Vehicle number</label>
                    <input
                      type="text"
                      placeholder="Enter vehicle number"
                      className="block w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                      value={vehicleNumber}
                      onChange={(e) => {
                        setVehicleNumber(e.target.value);
                        console.log("Vehicle Number updated:", e.target.value);
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Select color</label>
                    <div className="relative w-full" ref={dropdownRef}>
                      <div
                        className="flex w-full cursor-pointer items-center justify-between rounded-lg border border-gray-300 bg-white px-4 py-2 text-left shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:text-sm"
                        onClick={() => setShowColorDropdown(!showColorDropdown)}
                      >
                        <span className={`truncate ${colorCode ? "text-gray-900" : "text-gray-500"}`}>
                          {colorCode
                            ? colorOptions.find((c) => c.value === colorCode)?.name ||
                            "Select a color"
                            : "Select a color"}
                        </span>
                        <ChevronDownIcon
                          className={`h-4 w-4 text-gray-500 transition-transform ${showColorDropdown ? "rotate-180 transform" : ""}`}
                        />
                      </div>
                      {showColorDropdown && (
                        <div className="absolute left-0 right-0 z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border border-gray-300 bg-white text-sm shadow-lg sm:text-base">
                          {colorOptions.map((color) => (
                            <div
                              key={color.value}
                              className="cursor-pointer truncate px-4 py-2 hover:bg-gray-100"
                              onClick={() => {
                                setColorCode(color.value);
                                setShowColorDropdown(false);
                                console.log("Color selected:", color.value);
                              }}
                            >
                              {color.name}
                            </div>
                          ))}
                          {colorOptions.length === 0 && (
                            <div className="px-4 py-2 text-xs text-gray-500 sm:text-sm">
                              No colors available
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-8 flex justify-end space-x-3">
                    <button
                      type="button"
                      className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                      onClick={handleCloseModal}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className={`inline-flex justify-center rounded-md border border-transparent px-4 py-2 text-sm font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${isFormValid ? "bg-blue-600 hover:bg-blue-700" : "cursor-not-allowed bg-gray-400"}`}
                      disabled={!isFormValid}
                    >
                      Add Vehicle
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </>
      )}
      {showTeamModal && (
        <>
          <div className="fixed inset-0 bg-black bg-opacity-30 z-50" />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="w-full max-w-md rounded-2xl bg-white shadow-xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
              <div className="p-6 sm:p-8">
                <div className="mb-6 flex items-center justify-between">
                  <h3 className="text-lg font-medium text-gray-900">Assign a team</h3>
                  <button
                    onClick={handleCloseTeamModal}
                    className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-500"
                  >
                    <X size={24} />
                  </button>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Select team</label>
                    <div className="relative w-full" ref={teamNameDropdownRef}>
                      <div
                        className="flex w-full cursor-pointer items-center justify-between rounded-lg border border-gray-300 bg-white px-4 py-2 text-left shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:text-sm"
                        onClick={() => setShowTeamNameDropdown(!showTeamNameDropdown)}
                      >
                        <span className={`truncate ${teamName ? "text-gray-900" : "text-gray-500"}`}>
                          {teamName
                            ? unassignedTeams.find((t) => t.id === teamName)?.name ||
                            "Select a team"
                            : "Select a team"}
                        </span>
                        <ChevronDownIcon
                          className={`h-4 w-4 text-gray-500 transition-transform ${showTeamNameDropdown ? "rotate-180 transform" : ""}`}
                        />
                      </div>
                      {showTeamNameDropdown && (
                        <div className="absolute left-0 right-0 z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border border-gray-300 bg-white text-sm shadow-lg sm:text-base">
                          {unassignedTeams.map((team) => (
                            <div
                              key={team.id}
                              className="cursor-pointer truncate px-4 py-2 hover:bg-gray-100"
                              onClick={() => {
                                setTeamName(team.id);
                                setShowTeamNameDropdown(false);
                              }}
                            >
                              {team.name}
                            </div>
                          ))}
                          {unassignedTeams.length === 0 && (
                            <div className="px-4 py-2 text-xs text-gray-500 sm:text-sm">
                              No teams available
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-8 flex justify-end space-x-3">
                    <button
                      type="button"
                      className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                      onClick={handleCloseTeamModal}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className={`inline-flex justify-center rounded-md border border-transparent px-4 py-2 text-sm font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${isTeamFormValid ? "bg-blue-600 hover:bg-blue-700" : "cursor-not-allowed bg-gray-400"}`}
                      disabled={!isTeamFormValid}
                      onClick={handleTeamSubmit}
                    >
                      Assign team
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default VehiclePage;