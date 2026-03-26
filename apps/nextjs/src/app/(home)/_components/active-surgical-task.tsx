"use client";

import { useState } from "react";
import { MapPin, Trash2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { api } from "~/trpc/react";

const ActiveSurgicalTask = () => {
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);
  const { data: surgicalTasks, isLoading } =
    api.task.getAllSurgicalTasks.useQuery();

  const utils = api.useUtils();
  const deleteTask = api.task.deleteSurgicalTask.useMutation({
    onSuccess: () => {
      void utils.task.getAllSurgicalTasks.invalidate();
      setTaskToDelete(null);
    },
  });

  const handleDelete = async (taskId: string) => {
    await deleteTask.mutateAsync({ taskId });
  };

  if (isLoading) return <div>Loading...</div>;
  if (!surgicalTasks || surgicalTasks.length === 0)
    return <div>No active surgical tasks.</div>;

  return (
    <>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {surgicalTasks.map((task: any) => (
          <div
            key={task.id}
            className="rounded-xl border border-gray-200 bg-white p-6 shadow transition-shadow duration-200 hover:shadow-lg"
          >
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-purple-600">
                  Batch: {task.batch}
                </span>
                <span
                  className={`rounded-full px-2 py-1 text-xs font-bold ${
                    task.status === "pending"
                      ? "bg-yellow-100 text-yellow-800"
                      : task.status === "ongoing"
                        ? "bg-blue-100 text-blue-800"
                        : task.status === "completed"
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {task.status}
                </span>
              </div>
              <button
                onClick={() => setTaskToDelete(task.id)}
                className="rounded-full p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
                disabled={deleteTask.isPending}
              >
                <Trash2 size={16} />
              </button>
            </div>

            {/* Dog Information */}
            {task.dog && (
              <div className="mb-4">
                <div className="mb-2 flex items-start gap-3">
                  <div className="h-24 w-24 overflow-hidden rounded-lg">
                    <img
                      src={task.dog.dogImageUrl}
                      alt="Dog"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">
                      {task.dog.gender}
                    </div>
                    {(task.dog.location || task.dog.fullAddress) && (
                      <div className="mt-1 flex items-start gap-1 text-sm text-gray-500">
                        <MapPin size={14} className="mt-0.5 shrink-0" />
                        <span>{task.dog.location || task.dog.fullAddress}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Team Information */}
            <div className="mb-2">
              <div className="font-semibold text-gray-800">Team</div>
              <div className="text-sm text-gray-700">
                {task.team?.name || "-"}{" "}
                <span className="text-xs text-gray-400">
                  ({task.team?.category})
                </span>
              </div>
              {task.team?.members && Array.isArray(task.team.members) && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {task.team.members.map((member: any) => (
                    <span
                      key={member.id}
                      className="inline-block rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700"
                    >
                      {member.name}{" "}
                      <span className="text-gray-400">({member.role})</span>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 flex justify-between text-xs text-gray-400">
              <span>Created: {new Date(task.createdAt).toLocaleString()}</span>
              <span>Updated: {new Date(task.updatedAt).toLocaleString()}</span>
            </div>
          </div>
        ))}
      </div>

      <AlertDialog
        open={!!taskToDelete}
        onOpenChange={() => setTaskToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action will permanently delete this surgical task and remove
              it from the system. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => taskToDelete && handleDelete(taskToDelete)}
            >
              Delete Task
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ActiveSurgicalTask;
