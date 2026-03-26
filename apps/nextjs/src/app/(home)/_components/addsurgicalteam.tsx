"use client";

import type { DbUser } from "node_modules/@acme/api/src/types";
import { useEffect, useState } from "react";
import { User, X } from "lucide-react";

import { api } from "~/trpc/react";

interface AvailableMembers {
  surgeon: DbUser[];
  "medical assistant": DbUser[];
}

interface AddSurgicalTeamModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTeam: (team: any) => void;
  availableMembers: AvailableMembers | undefined;
}

interface FormData {
  name: string;
  selectedMembers: DbUser[];
}

export default function AddSurgicalTeamModal({
  isOpen,
  onClose,
  onAddTeam,
  availableMembers,
}: AddSurgicalTeamModalProps) {
  const [formData, setFormData] = useState<FormData>({
    name: "",
    selectedMembers: [],
  });

  const createTeam = api.user.createTeam.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        onAddTeam(data.team);
        onClose();
      } else {
        alert(data.error || "Failed to create team");
      }
    },
  });

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: "",
        selectedMembers: [],
      });
    }
  }, [isOpen]);

  // Handle form input changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Toggle member selection
  const toggleMemberSelection = (member: DbUser) => {
    setFormData((prev) => {
      const isAlreadySelected = prev.selectedMembers.some(
        (m) => m.id === member.id,
      );

      if (isAlreadySelected) {
        return {
          ...prev,
          selectedMembers: prev.selectedMembers.filter(
            (m) => m.id !== member.id,
          ),
        };
      }

      return {
        ...prev,
        selectedMembers: [...prev.selectedMembers, member],
      };
    });
  };

  // Check if a member is selected
  const isMemberSelected = (memberId: string) => {
    return formData.selectedMembers.some((m) => m.id === memberId);
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.name.trim() === "" || formData.selectedMembers.length === 0) {
      alert("Please provide a team name and select at least one member");
      return;
    }

    createTeam.mutate({
      name: formData.name,
      category: "surgical team",
      members: formData.selectedMembers.map((member) => ({
        id: member.id,
        name: member.name ?? "",
        role: member.role ?? "",
        category: member.category ?? "",
      })),
    });
  };

  if (!isOpen || !availableMembers) return null;

  // Filter out members with null names or inactive status
  const filteredSurgeons = availableMembers.surgeon.filter(
    (member) => member.name && (member.active ?? true),
  );
  const filteredAssistants = availableMembers["medical assistant"].filter(
    (member) => member.name && (member.active ?? true),
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="relative w-full max-w-md rounded-lg bg-white p-6">
        {/* Header with close button */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold">Add New Team</h2>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Team Name Field */}
          <div className="mb-6">
            <label className="mb-2 block text-base font-medium text-black">
              Name
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="w-full rounded-md border border-gray-300 p-3 focus:outline-none"
              placeholder="Enter name"
            />
          </div>

          {/* Team Members Section */}
          <div className="mb-8 grid grid-cols-2 gap-4">
            {/* Surgeons Section */}
            <div>
              <label className="mb-2 block text-base font-medium text-black">
                Surgeons
              </label>
              <div className="space-y-2">
                {filteredSurgeons.length > 0 ? (
                  filteredSurgeons.map((member) => (
                    <div
                      key={member.id}
                      onClick={() => toggleMemberSelection(member)}
                      className={`flex cursor-pointer items-center rounded-md border p-3 text-black ${
                        isMemberSelected(member.id)
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200"
                      }`}
                    >
                      <User size={20} className="mr-2 text-gray-500" />
                      <span>{member.name}</span>
                    </div>
                  ))
                ) : (
                  <div className="rounded-md border border-gray-200 p-3 text-gray-500">
                    No available surgeons
                  </div>
                )}
              </div>
            </div>

            {/* Medical Assistants Section */}
            <div>
              <label className="mb-2 block text-base font-medium text-black">
                Medical Assistants
              </label>
              <div className="space-y-2">
                {filteredAssistants.length > 0 ? (
                  filteredAssistants.map((member) => (
                    <div
                      key={member.id}
                      onClick={() => toggleMemberSelection(member)}
                      className={`flex cursor-pointer items-center rounded-md border p-3 text-black ${
                        isMemberSelected(member.id)
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200"
                      }`}
                    >
                      <User size={20} className="mr-2 text-gray-500" />
                      <span>{member.name}</span>
                    </div>
                  ))
                ) : (
                  <div className="rounded-md border border-gray-200 p-3 text-gray-500">
                    No available medical assistants
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-md border border-gray-300 bg-white px-4 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createTeam.isPending}
              className="w-full rounded-md bg-blue-500 px-4 py-3 font-medium text-white transition-colors hover:bg-blue-600 disabled:opacity-50"
            >
              {createTeam.isPending ? "Creating..." : "Add Team"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
