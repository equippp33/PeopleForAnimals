"use client";

import type { DbUser } from "node_modules/@acme/api/src/types";
import { useEffect, useState } from "react";
import { User, X } from "lucide-react";

import { api } from "~/trpc/react";

interface Member extends DbUser {
  active: boolean;
}

interface AvailableMembers {
  driver: DbUser[];
  catcher: DbUser[];
}

interface EditOperationalTeamModalProps {
  isOpen: boolean;
  onClose: () => void;
  team: {
    id: string;
    name: string;
    members: Member[];
  } | null;
  availableMembers: AvailableMembers | undefined;
  onUpdateTeam: (team: any) => void;
}

interface FormData {
  name: string;
  selectedMembers: DbUser[];
}

export default function EditOperationalTeamModal({
  isOpen,
  onClose,
  team,
  availableMembers,
  onUpdateTeam,
}: EditOperationalTeamModalProps) {
  const [formData, setFormData] = useState<FormData>({
    name: team?.name ?? "",
    selectedMembers: team?.members ?? [],
  });

  // Update form when team changes
  useEffect(() => {
    if (team) {
      setFormData({ name: team.name, selectedMembers: team.members });
    }
  }, [team]);

  // combine available + currently selected to allow unselecting
  const combinedMembers = (category: "driver" | "catcher") => {
    const avail = availableMembers?.[category] ?? [];
    const selected = formData.selectedMembers.filter(
      (m) => m.role === category,
    );
    // merge unique by id
    const map = new Map<string, DbUser>();
    [...avail, ...selected].forEach((m) => map.set(m.id, m));
    return Array.from(map.values());
  };

  const updateTeam = api.user.updateTeam.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        onUpdateTeam(data.team);
        onClose();
      } else {
        alert(data.error || "Failed to update team");
      }
    },
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const toggleMemberSelection = (member: DbUser) => {
    setFormData((prev) => {
      const isSelected = prev.selectedMembers.some((m) => m.id === member.id);
      if (isSelected) {
        return {
          ...prev,
          selectedMembers: prev.selectedMembers.filter(
            (m) => m.id !== member.id,
          ),
        };
      }
      return { ...prev, selectedMembers: [...prev.selectedMembers, member] };
    });
  };

  const isMemberSelected = (memberId: string) =>
    formData.selectedMembers.some((m) => m.id === memberId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!team) return;
    if (formData.name.trim() === "" || formData.selectedMembers.length === 0) {
      alert("Please provide a team name and select at least one member");
      return;
    }

    updateTeam.mutate({
      teamId: team.id,
      name: formData.name,
      members: formData.selectedMembers.map((member) => ({
        id: member.id,
        name: member.name ?? "",
        role: member.role ?? "",
        category: member.category ?? "",
      })),
    });
  };

  if (!isOpen || !team) return null;

  const drivers = combinedMembers("driver");
  const catchers = combinedMembers("catcher");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="relative w-full max-w-md rounded-lg bg-white p-6">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold">Edit Team</h2>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
          >
            <X size={24} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
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
          <div className="mb-8 grid grid-cols-2 gap-4">
            <div>
              <label className="mb-2 block text-base font-medium text-black">
                Drivers
              </label>
              <div className="space-y-2">
                {drivers.length > 0 ? (
                  drivers.map((member) => (
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
                    No available drivers
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className="mb-2 block text-base font-medium text-black">
                Catchers
              </label>
              <div className="space-y-2">
                {catchers.length > 0 ? (
                  catchers.map((member) => (
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
                    No available catchers
                  </div>
                )}
              </div>
            </div>
          </div>
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
              disabled={updateTeam.isPending}
              className="w-full rounded-md bg-blue-500 px-4 py-3 font-medium text-white transition-colors hover:bg-blue-600 disabled:opacity-50"
            >
              {updateTeam.isPending ? "Updating..." : "Update Team"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
