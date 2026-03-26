"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";

import { api } from "~/trpc/react";

// Define an interface for the component props
interface AddMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddMember: (member: Member) => void;
}

// Define an interface for the member object
interface Member {
  id: number;
  name: string;
  phone: string;
  active: boolean;
  section: string;
  category: string;
}

// Define an interface for form data
interface FormData {
  name: string;
  phone: string;
  teamType: "operational team" | "surgical team" | "shelter team";
  roleType: "driver" | "catcher" | "surgeon" | "medical assistant" | "ward boy";
}

export default function AddMemberModal({
  isOpen,
  onClose,
  onAddMember,
}: AddMemberModalProps) {
  const [formData, setFormData] = useState<FormData>({
    name: "",
    phone: "",
    teamType: "operational team",
    roleType: "driver",
  });

  const { mutate } = api.user.addMember.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        // Handle success - show different messages for reactivation vs new user
        if (data.reactivated) {
          toast.success(`Member "${data.user.name}" has been reactivated successfully!`);
        } else {
          toast.success(`Member "${data.user.name}" has been added successfully!`);
        }
        onClose(); // Close the modal
      } else {
        // Handle error
        toast.error(data.error);
      }
    },
  });

  // Handle form input changes
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;

    // Update form data
    setFormData((prev) => ({ ...prev, [name]: value }));

    // If team type changes, set default role type based on team
    if (name === "teamType") {
      const newTeamType = value as
        | "operational team"
        | "surgical team"
        | "shelter team";
      let newRoleType: FormData["roleType"] = "driver"; // Default
      if (newTeamType === "operational team") {
        newRoleType = "driver";
      } else if (newTeamType === "surgical team") {
        newRoleType = "surgeon";
      } else if (newTeamType === "shelter team") {
        newRoleType = "ward boy";
      }
      setFormData((prev) => ({
        ...prev,
        teamType: newTeamType,
        roleType: newRoleType,
      }));
    }
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // When submitting the form:
    mutate({
      name: formData.name,
      phone: formData.phone,
      teamType: formData.teamType,
      roleType: formData.roleType,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-md rounded-lg bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">Add New Member</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Name Field */}
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Name
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="w-full rounded-md border border-gray-300 bg-white p-2 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter name"
            />
          </div>

          {/* Phone Field */}
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Phone
            </label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              required
              className="w-full rounded-md border border-gray-300 bg-white p-2 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter phone number"
            />
          </div>

          {/* Team Type Field */}
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Team Type
            </label>
            <select
              name="teamType"
              value={formData.teamType}
              onChange={handleChange}
              className="w-full rounded-md border border-gray-300 bg-white p-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="operational team">Operational Team</option>
              <option value="surgical team">Surgical Team</option>
              <option value="shelter team">Shelter Team</option>
            </select>
          </div>

          {/* Role Type Field - Dynamic based on Team Type */}
          <div className="mb-6">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Role Type
            </label>
            <select
              name="roleType"
              value={formData.roleType}
              onChange={handleChange}
              className="w-full rounded-md border border-gray-300 bg-white p-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="driver">Driver</option>
              <option value="catcher">Catcher</option>
              <option value="surgeon">Surgeon</option>
              <option value="medical assistant">Medical Assistant</option>
              <option value="ward boy">Ward Boy</option>
            </select>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="mr-2 rounded-md border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-md bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
            >
              Add Member
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
