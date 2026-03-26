"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";

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

const ActiveOperationTask = () => {
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);
  const { data: operationTasks, isLoading } =
    api.task.getAllOperationTasks.useQuery();

  const utils = api.useUtils();
  const deleteTask = api.task.deleteOperationTask.useMutation({
    onSuccess: () => {
      void utils.task.getAllOperationTasks.invalidate();
      setTaskToDelete(null);
    },
  });

  const handleDelete = async (taskId: string) => {
    await deleteTask.mutateAsync({ taskId });
  };

  console.log(operationTasks);

  if (isLoading) return <div>Loading...</div>;
  if (!operationTasks || operationTasks.length === 0)
    return (
      <div className="text-center text-gray-500">
        No active operation tasks.
      </div>
    );

  return (
    <>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {operationTasks.map((task: any) => (
          <div
            key={task.id}
            className="rounded-xl border border-gray-200 bg-white p-6 shadow transition-shadow duration-200 hover:shadow-lg"
          >
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                  {task.taskType}
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

            <div className="mb-2">
              <div className="text-lg font-bold text-gray-900">
                {task.location?.name || "Unknown Location"}
              </div>
              <div className="text-sm text-gray-500">{task.location?.area}</div>
              {task.location?.notes && (
                <div className="mt-1 text-xs text-gray-400">
                  Notes: {task.location.notes}
                </div>
              )}
            </div>

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

            <div className="mb-2">
              <div className="font-semibold text-gray-800">Vehicle</div>
              <div className="text-sm text-gray-700">
                {task.vehicle?.name || "-"}{" "}
                <span className="text-xs text-gray-400">
                  {task.vehicle?.vehicleNumber}
                </span>
              </div>
              {task.vehicle?.vehicleColor && (
                <div className="text-xs text-gray-400">
                  Color: {task.vehicle.vehicleColor}
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
              This action will permanently delete this operation task and all
              associated data. All captured or released dogs linked to this task
              will also be removed from the system.
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

export default ActiveOperationTask;
