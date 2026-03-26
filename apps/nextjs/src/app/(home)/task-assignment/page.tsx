"use client";

import { Fragment, useState } from "react";
import { Info, Plus } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import ActiveOperationTask from "../_components/active-operation-task";
import ActiveSurgicalTask from "../_components/active-surgical-task";
import SurgicalTaskModal from "../_components/newsurgical";

const TaskAssignment = () => {
  const [isSurgicalTaskModalOpen, setIsSurgicalTaskModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"operation" | "surgical">(
    "operation",
  );

  return (
    <div className="min-h-screen bg-white p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-blue-600">Task Assignment</h1>
          <p className="text-sm text-gray-700">
            View and manage operation and surgical tasks for your teams.
          </p>
        </div>
      </div>
      <Tabs
        value={activeTab}
        onValueChange={(value) =>
          setActiveTab(value as "operation" | "surgical")
        }
        className="w-full"
      >
        <div className="mb-6 flex items-center justify-between gap-x-2">
          <TabsList className="grid grid-cols-2 gap-x-4">
            <TabsTrigger
              value="operation"
              className="rounded-lg !text-gray-500 transition-colors hover:bg-gray-100 data-[state=active]:bg-blue-600 data-[state=active]:text-white"
            >
              Operation Tasks
            </TabsTrigger>
            <TabsTrigger
              value="surgical"
              className="rounded-lg !text-gray-500 transition-colors hover:bg-gray-100 data-[state=active]:bg-blue-600 data-[state=active]:text-white"
            >
              Surgical Tasks
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="operation">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-blue-500">
                  Operation Tasks
                </h2>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info size={16} className="text-gray-400" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-gray-900">
                        View and manage field operation tasks for operational
                        teams. Tasks are automatically created for capture
                        locations.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="text-sm text-gray-600">
                View active operation tasks below.
              </p>
            </div>
          </div>
          <ActiveOperationTask />
        </TabsContent>
        <TabsContent value="surgical">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-blue-500">
                  Surgical Tasks
                </h2>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info size={16} className="text-gray-400" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-gray-900">
                        Create and manage surgical tasks for surgical teams.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="text-sm text-gray-600">
                Assign new surgical tasks or view active ones below.
              </p>
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="flex items-center gap-2 rounded-lg border border-blue-500 px-4 py-2 text-blue-500 hover:bg-blue-50"
                    onClick={() => setIsSurgicalTaskModalOpen(true)}
                  >
                    <Plus size={20} />
                    <span className="text-sm">Add Surgical Task</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-gray-900">
                    Assign a new surgical task to a team
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <SurgicalTaskModal
            isOpen={isSurgicalTaskModalOpen}
            onClose={() => setIsSurgicalTaskModalOpen(false)}
          />
          <ActiveSurgicalTask />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TaskAssignment;
