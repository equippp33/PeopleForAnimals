"use client";

import { useMemo, useState } from "react";
import { CheckCircle, Dog, Trash2, X } from "lucide-react";

import { api } from "~/trpc/react";

// Define types for your props
interface TeamMember {
  id: string;
  name: string;
  role: string;
  category: string;
}

interface Team {
  id: string;
  name: string;
  category: string;
  members: TeamMember[];
}

interface CapturedDog {
  id: string;
  gender: string;
  location: string | null;
  status: string | null;
  dogImageUrl: string;
  operationTaskId: string | null;
  coordinates: unknown;
  fullAddress: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

interface FormData {
  batch: string;
  teamId: string;
  dogId: string;
}

interface SurgicalTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedTask?: {
    id: string;
    batch: string;
    teamId: string;
    dogId: string;
  };
}

export default function SurgicalTaskModal({
  isOpen,
  onClose,
  selectedTask,
}: SurgicalTaskModalProps) {
  // Fetch teams using TRPC
  const { data: teams = [] } = api.team.getAllTeams.useQuery();
  const { data: capturedDogs = [] } = api.task.getDogs.useQuery();

  const utils = api.useUtils();
  const createTask = api.task.createSurgicalTask.useMutation({
    onSuccess: () => {
      void utils.task.getAllSurgicalTasks.invalidate();
      onClose();
    },
    onError: (error) => {
      console.error("Error creating surgical task:", error);
    },
  });

  const deleteTask = api.task.deleteSurgicalTask.useMutation({
    onSuccess: () => {
      void utils.task.getAllSurgicalTasks.invalidate();
      onClose();
    },
  });

  // Memoize filtered teams to prevent unnecessary re-renders
  const surgicalTeams = useMemo(
    () => teams.filter((team: Team) => team.category === "surgical team"),
    [teams],
  );

  // Get default values
  const defaultValues = useMemo(
    () => ({
      batch: selectedTask?.batch ?? "",
      teamId: selectedTask?.teamId ?? surgicalTeams[0]?.id ?? "",
      dogId: selectedTask?.dogId ?? "",
    }),
    [surgicalTeams, selectedTask],
  );

  // Initialize form data with default values
  const [formData, setFormData] = useState<FormData>(defaultValues);

  // Handle form input changes
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createTask.mutateAsync(formData);
  };

  // Handle delete
  const handleDelete = async () => {
    if (!selectedTask?.id) return;

    if (confirm("Are you sure you want to delete this surgical task?")) {
      await deleteTask.mutateAsync({ taskId: selectedTask.id });
    }
  };

  // Get team members based on selected team
  const teamMembers = useMemo(() => {
    const selectedTeam = surgicalTeams.find(
      (team) => team.id === formData.teamId,
    );
    return selectedTeam?.members ?? [];
  }, [surgicalTeams, formData.teamId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-md rounded-lg bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">
            {selectedTask ? "Edit Surgical Task" : "Create Surgical Task"}
          </h2>
          <div className="flex items-center gap-2">
            {selectedTask && (
              <button
                type="button"
                onClick={handleDelete}
                className="rounded-full p-2 text-red-500 hover:bg-red-50"
                disabled={deleteTask.isPending}
              >
                <Trash2 size={20} />
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-full p-2 text-gray-500 hover:bg-gray-100"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Batch Field */}
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Batch
            </label>
            <input
              type="text"
              name="batch"
              value={formData.batch}
              onChange={handleChange}
              required
              className="w-full rounded-md border border-gray-300 bg-white p-2 text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter batch number or name"
            />
          </div>

          {/* Team Field */}
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Team
            </label>
            <select
              name="teamId"
              value={formData.teamId}
              onChange={handleChange}
              required
              className="w-full rounded-md border border-gray-300 bg-white p-2 text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a team</option>
              {surgicalTeams.map((team: Team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </div>

          {/* Captured Dogs Field */}
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Select Dog for Surgery
            </label>
            <select
              name="dogId"
              value={formData.dogId}
              onChange={handleChange}
              required
              className="w-full rounded-md border border-gray-300 bg-white p-2 text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a dog</option>
              {capturedDogs.map((dog) => (
                <option key={dog.id} value={dog.id}>
                  {dog.gender} - {dog.location ?? "Unknown location"}
                </option>
              ))}
            </select>
          </div>

          {/* Selected Dog Preview */}
          {formData.dogId && (
            <div className="mb-4">
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Selected Dog Details
              </label>
              <div className="rounded-md border border-gray-200 p-3">
                {capturedDogs
                  .filter((dog) => dog.id === formData.dogId)
                  .map((dog) => (
                    <div key={dog.id} className="flex items-start gap-3">
                      <div className="h-20 w-20 overflow-hidden rounded-md">
                        <img
                          src={dog.dogImageUrl}
                          alt="Dog"
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">
                          <strong>Gender:</strong> {dog.gender}
                        </p>
                        <p className="text-sm text-gray-600">
                          <strong>Location:</strong> {dog.location ?? "Unknown"}
                        </p>
                        <p className="text-sm text-gray-600">
                          <strong>Status:</strong>{" "}
                          <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs text-yellow-800">
                            {dog.status ?? "Unknown"}
                          </span>
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Team Members Display */}
          <div className="mb-6">
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Team Members
            </label>

            {teamMembers.length > 0 ? (
              <div className="max-h-48 overflow-y-auto rounded-md border border-gray-200 p-3 text-black">
                <ul className="space-y-2">
                  {teamMembers.map((member: TeamMember) => (
                    <li key={member.id} className="flex items-center">
                      <CheckCircle size={16} className="mr-2 text-green-500" />
                      <span>{member.name}</span>
                      <span className="ml-2 text-sm text-gray-500">
                        ({member.role})
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="rounded-md border border-gray-200 p-3 text-sm text-gray-500">
                No members in selected team or no team selected
              </div>
            )}
          </div>

          {/* Submit Button */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="mr-2 rounded-md border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-100"
              disabled={createTask.isPending || deleteTask.isPending}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-md bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 disabled:opacity-50"
              disabled={createTask.isPending || deleteTask.isPending}
            >
              {createTask.isPending ? "Creating..." : "Create Task"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
