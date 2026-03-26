
"use client";

import type { DbUser } from "node_modules/@acme/api/src/types";
import { useEffect, useState } from "react";
import { Info, Pencil, Plus, Search, User, X } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { api } from "~/trpc/react";
import AddMemberModal from "../_components/addmember";
import AddOperationalTeamModal from "../_components/addopteam";
import AddSurgicalTeamModal from "../_components/addsurgicalteam";
import EditOperationalTeamModal from "../_components/editeam";
import EditMemberModal from "../_components/editmember";
import SurgicalTaskModal from "../_components/newsurgical";

// Define types for members, teams, and tasks
interface TeamMember {
  id: string;
  name: string;
  role: string;
  category: string;
}

interface Team {
  id: string;
  name: string;
  members: TeamMember[];
  createdAt: Date;
}

interface OperationalTask {
  id: string;
  batch: string;
  teamId: string;
  teamMembers: TeamMember[];
  createdAt: string;
}

interface SurgicalTask extends OperationalTask { }

interface TeamsState {
  "operational team": Team[];
  "surgical team": Team[];
  "shelter team": Team[];
}

interface TasksState {
  "operational team": OperationalTask[];
  "surgical team": SurgicalTask[];
  "shelter team": SurgicalTask[];
}

interface ToggleSwitchProps {
  isActive: boolean;
  onToggle: () => void;
}

interface MemberCardProps {
  member: DbUser;
  section: "operational team" | "surgical team" | "shelter team";
  category: string;
}

interface TeamCardProps {
  team: Team;
  teamType: "operational team" | "surgical team" | "shelter team";
  onEdit?: () => void;
}

interface OperationalMembers {
  driver: DbUser[];
  catcher: DbUser[];
}

interface SurgicalMembers {
  surgeon: DbUser[];
  "medical assistant": DbUser[];
}

interface TeamMembersData {
  "operational team": OperationalMembers;
  "surgical team": SurgicalMembers;
}

// Add new helper functions before the component
const getAssignedMemberIds = (teams: TeamsState): Set<string> => {
  const assignedIds = new Set<string>();

  Object.values(teams).forEach((teamArray: Team[]) => {
    teamArray.forEach((team: Team) => {
      team.members.forEach((member: TeamMember) => {
        assignedIds.add(member.id);
      });
    });
  });

  return assignedIds;
};

const filterAvailableMembers = <T extends OperationalMembers | SurgicalMembers>(
  members: T | undefined,
  assignedIds: Set<string>,
): T | undefined => {
  if (!members) return undefined;

  const filteredMembers = { ...members };

  Object.entries(members).forEach(
    ([category, memberList]: [string, DbUser[]]) => {
      filteredMembers[category as keyof T] = memberList.filter(
        (member) => member.active && !assignedIds.has(member.id),
      ) as T[keyof T];
    },
  );

  return filteredMembers;
};

export default function TeamAssignment() {
  // API queries and mutations
  const { data: membersData, refetch: refetchMembers } =
    api.user.getAllMembers.useQuery(undefined, {
      refetchInterval: 30000,
    });

  const { data: teamsData, refetch: refetchTeams } =
    api.user.getAllTeams.useQuery(undefined, {
      refetchInterval: 30000,
    });

  const { mutate: toggleStatus } = api.user.toggleMemberStatus.useMutation({
    onSuccess: () => {
      void refetchMembers();
    },
  });

  const utils = api.useContext();

  const { mutate: deleteMember } = api.user.deleteMember.useMutation({
    onMutate: async (variables) => {
      await utils.user.getAllMembers.cancel();
      const previous = utils.user.getAllMembers.getData();
      utils.user.getAllMembers.setData(undefined, (old) => {
        if (!old) return old;
        const copy: any = JSON.parse(JSON.stringify(old));
        Object.keys(copy).forEach((sec) => {
          Object.keys(copy[sec]).forEach((cat) => {
            copy[sec][cat] = copy[sec][cat].filter(
              (m: any) => m.id !== variables.memberId,
            );
          });
        });
        return copy;
      });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous)
        utils.user.getAllMembers.setData(undefined, context.previous);
    },
    onSettled: () => {
      void utils.user.getAllMembers.invalidate();
    },
  });

  const { mutate: deleteTeam } = api.user.deleteTeam.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        void refetchTeams();
      } else {
        alert(data.error || "Failed to delete team");
      }
    },
  });

  const [teams, setTeams] = useState<TeamsState>({
    "operational team": [],
    "surgical team": [],
    "shelter team": [],
  });

  const [tasks, setTasks] = useState<TasksState>({
    "operational team": [],
    "surgical team": [],
    "shelter team": [],
  });

  // Modal states
  const [showAddOperationalTeam, setShowAddOperationalTeam] = useState(false);
  const [editingTeam, setEditingTeam] = useState<{
    id: string;
    name: string;
    members: TeamMember[];
  } | null>(null);
  const [showEditOperationalTeam, setShowEditOperationalTeam] = useState(false);
  const [editingMember, setEditingMember] = useState<{
    id: string;
    name: string;
    phone: string;
  } | null>(null);

  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [isSurgicalTaskModalOpen, setIsSurgicalTaskModalOpen] = useState(false);
  const [isOperationalTeamModalOpen, setIsOperationalTeamModalOpen] =
    useState(false);
  const [isSurgicalTeamModalOpen, setIsSurgicalTeamModalOpen] = useState(false);

  const [activeTab, setActiveTab] = useState<
    "operational" | "surgical" | "shelter"
  >("operational");

  // Update teams state when teamsData changes
  useEffect(() => {
    if (teamsData) {
      setTeams({
        "operational team": teamsData.operational.teams,
        "surgical team": teamsData.surgical.teams,
        "shelter team": teamsData.shelter.teams,
      });
    }
  }, [teamsData]);

  // Toggle member status (active/inactive)
  const toggleMemberStatus = async (
    _section: "operational team" | "surgical team" | "shelter team",
    _category: string,
    id: string,
  ) => {
    toggleStatus({ memberId: id });
  };

  // Add a new member callback
  const handleAddMember = async () => {
    await refetchMembers();
  };

  // Add a new operation task
  const handleAddOperationTask = (task: OperationalTask) => {
    setTasks((prev) => ({
      ...prev,
      "operational team": [...prev["operational team"], task],
    }));
  };

  // Add a new surgical task
  const handleAddSurgicalTask = (task: SurgicalTask) => {
    setTasks((prev) => ({
      ...prev,
      "surgical team": [...prev["surgical team"], task],
    }));
  };

  // Add a new operational team
  const handleAddOperationalTeam = (team: any) => {
    void refetchTeams();
  };

  const handleUpdateOperationalTeam = () => {
    void refetchTeams();
  };

  // Add a new surgical team
  const handleAddSurgicalTeam = (team: any) => {
    void refetchTeams();
  };

  // Delete a team
  const handleDeleteTeam = async (
    teamType: "operational team" | "surgical team" | "shelter team",
    teamId: string,
  ) => {
    if (confirm("Are you sure you want to delete this team?")) {
      deleteTeam({ teamId });
    }
  };

  // Get role abbreviation
  const getRoleAbbreviation = (
    category: "drivers" | "catchers" | "surgeons" | "assistants",
  ): string => {
    switch (category) {
      case "drivers":
        return "D";
      case "catchers":
        return "C";
      case "surgeons":
        return "S";
      case "assistants":
        return "MA";
      default:
        return "";
    }
  };

  // Calculate total members for a section
  const getTotalMembers = (
    section: "operational team" | "surgical team" | "shelter team",
  ): number => {
    if (!membersData) return 0;

    let total = 0;
    Object.values(membersData[section]).forEach((category) => {
      total += category.length;
    });
    return total;
  };

  // Calculate available (active) members
  const getAvailableMembers = (
    section: "operational team" | "surgical team" | "shelter team",
  ): number => {
    if (!membersData) return 0;

    let count = 0;
    Object.values(membersData[section]).forEach((category) => {
      category.forEach((member) => {
        if (member.active) count++;
      });
    });
    return count;
  };

  // Dynamic counts
  const operationalTotal = getTotalMembers("operational team");
  const operationalAvailable = getAvailableMembers("operational team");
  const surgicalTotal = getTotalMembers("surgical team");
  const surgicalAvailable = getAvailableMembers("surgical team");

  // Toggle switch component to ensure consistent behavior
  const ToggleSwitch = ({ isActive, onToggle }: ToggleSwitchProps) => {
    return (
      <button
        type="button"
        onClick={onToggle}
        className={`relative h-6 w-12 rounded-full transition-colors ${isActive ? "bg-blue-600" : "bg-gray-300"
          }`}
      >
        <span
          className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all ${isActive ? "right-1" : "left-1"
            }`}
        />
      </button>
    );
  };

  // Updated MemberCard component to handle null values
  const MemberCard = ({ member, section, category }: MemberCardProps) => {
    const handleToggle = () => {
      void toggleMemberStatus(section, category, member.id);
    };

    const isActive = member.active ?? true;

    return (
      <div
        className={`flex items-center justify-between rounded-lg border border-gray-200 p-2.5 ${isActive ? "bg-white" : "bg-gray-100"}`}
      >
        <div className="flex items-center gap-2">
          <User size={16} className="text-gray-500" />
          <span
            className={`text-sm ${isActive ? "text-gray-800" : "text-gray-500"}`}
          >
            {member.name ?? "Unnamed Member"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ToggleSwitch isActive={isActive} onToggle={handleToggle} />
          <button
            onClick={() =>
              setEditingMember({
                id: member.id,
                name: member.name ?? "",
                phone: (member as any).phoneNumber ?? "",
              })
            }
            className="text-gray-400 hover:text-blue-500"
          >
            <Pencil size={16} />
          </button>
          <button
            onClick={() => {
              if (confirm("Are you sure you want to delete this member?")) {
                deleteMember({ memberId: member.id });
              }
            }}
            className="text-gray-400 hover:text-red-500"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    );
  };

  // Team card component for displaying team members with roles
  const TeamCard = ({ team, teamType, onEdit }: TeamCardProps) => {
    const getRoleLabel = (role: string) => {
      switch (role) {
        case "driver":
          return "D";
        case "catcher":
          return "C";
        case "surgeon":
          return "S";
        case "medical assistant":
          return "MA";
        default:
          return "";
      }
    };

    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4 hover:border-blue-500">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-base sm:text-lg font-medium text-black">{team.name}</h4>
          <div className="flex items-center gap-2">
            {onEdit && (
              <button
                onClick={onEdit}
                className="text-gray-400 hover:text-blue-500"
              >
                <Pencil size={16} />
              </button>
            )}
            <button
              onClick={() => handleDeleteTeam(teamType, team.id)}
              className="text-gray-400 hover:text-red-500"
            >
              <X size={16} />
            </button>
          </div>
        </div>
        <div className="space-y-2">
          {team.members && team.members.length > 0 ? (
            team.members.map((member, index) => (
              <div
                key={`${team.id}-member-${index}`}
                className="flex items-center justify-between bg-gray-50 px-3 py-2 text-sm"
              >
                <span className="text-gray-700">{member.name}</span>
                <span className="font-medium text-gray-500">
                  {getRoleLabel(member.role)}
                </span>
              </div>
            ))
          ) : (
            <div className="text-sm text-gray-500">No members</div>
          )}
        </div>
      </div>
    );
  };

  // Get assigned member IDs
  const assignedMemberIds = getAssignedMemberIds(teams);

  // Filter available members for modals
  const filteredOperationalMembers = filterAvailableMembers<OperationalMembers>(
    membersData?.["operational team"],
    assignedMemberIds,
  );

  const filteredSurgicalMembers = filterAvailableMembers<SurgicalMembers>(
    membersData?.["surgical team"],
    assignedMemberIds,
  );

  return (
    <div className="min-h-screen bg-white p-4 sm:p-6 lg:p-8">
      {/* Top Header: Hello Admin + Search */}
      <div className="mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <h1 className="text-xl sm:text-2xl font-semibold text-gray-800">Hello Admin !</h1>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search"
            className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Page Title and Add Member Button */}
      <div className="mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Team assignment</h1>
          <p className="text-sm text-gray-700">Manage team members</p>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                onClick={() => setIsAddMemberModalOpen(true)}
              >
                <Plus size={18} />
                <span>Add member</span>
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-gray-900">Add a new team member</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Edit Member Modal */}
      {editingMember && (
        <EditMemberModal
          isOpen={true}
          onClose={() => setEditingMember(null)}
          memberId={editingMember.id}
          currentName={editingMember.name}
          currentPhone={editingMember.phone}
        />
      )}

      {/* Main Content with Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(value) =>
          setActiveTab(value as "operational" | "surgical" | "shelter")
        }
        className="w-full"
      >
        <div className="mb-6 flex items-center justify-start gap-x-2">
          <TabsList className="inline-flex items-center justify-center rounded-lg bg-gray-100 p-1 w-full sm:w-auto">
            <TabsTrigger
              value="operational"
              className="flex-1 sm:flex-none inline-flex items-center justify-center whitespace-nowrap px-3 py-1.5 text-sm font-medium text-gray-900 ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:rounded-md data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm"
            >
              Operational
            </TabsTrigger>
            <TabsTrigger
              value="shelter"
              className="flex-1 sm:flex-none inline-flex items-center justify-center whitespace-nowrap px-3 py-1.5 text-sm font-medium text-gray-900 ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:rounded-md data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm"
            >
              Shelter
            </TabsTrigger>
            <TabsTrigger
              value="surgical"
              className="flex-1 sm:flex-none inline-flex items-center justify-center whitespace-nowrap px-3 py-1.5 text-sm font-medium text-gray-900 ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:rounded-md data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm"
            >
              Surgical
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="operational" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            {/* Operational Members Section */}
            <div className="flex flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg sm:text-xl font-bold text-gray-900">
                      Operational Members
                    </h3>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info size={16} className="text-gray-400" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-gray-900">
                            View and manage drivers and catchers for operational
                            teams
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <p className="text-sm text-gray-700">
                    {operationalAvailable} out of {operationalTotal} members
                    available
                  </p>
                </div>
              </div>

              <div className="flex-1">
                <div className="h-full">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
                    {/* Drivers Section */}
                    <div>
                      <div className="mb-2 flex items-center gap-2">
                        <h4 className="text-sm font-medium text-gray-700">
                          Drivers
                        </h4>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Info size={14} className="text-gray-400" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-gray-900">
                                Team members responsible for vehicle operations
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <div className="space-y-2">
                        {membersData?.["operational team"].driver.map(
                          (member) => (
                            <MemberCard
                              key={member.id}
                              member={member}
                              section="operational team"
                              category="driver"
                            />
                          ),
                        )}
                      </div>
                    </div>

                    {/* Catchers Section */}
                    <div>
                      <div className="mb-2 flex items-center gap-2">
                        <h4 className="text-sm font-medium text-gray-700">
                          Catchers
                        </h4>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Info size={14} className="text-gray-400" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-gray-900">
                                Team members specialized in animal handling
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <div className="space-y-2">
                        {membersData?.["operational team"].catcher.map(
                          (member) => (
                            <MemberCard
                              key={member.id}
                              member={member}
                              section="operational team"
                              category="catcher"
                            />
                          ),
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Operational Teams Section */}
            <div className="flex flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg sm:text-xl font-bold text-gray-900">
                      Operational Teams
                    </h3>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info size={16} className="text-gray-400" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-gray-900">
                            Currently formed operational teams and their members
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <p className="text-sm text-gray-700">
                    {teams["operational team"].length} teams formed
                  </p>
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        className="rounded-md border border-blue-500 px-3 py-1 text-xs font-medium text-blue-500 hover:bg-blue-50"
                        onClick={() => setIsOperationalTeamModalOpen(true)}
                      >
                        Add team
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-gray-900">
                        Create a new operational team
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              <div className="flex-1">
                <div className="grid gap-4">
                  {teams["operational team"].length > 0 ? (
                    teams["operational team"].map((team) => (
                      <TeamCard
                        key={team.id}
                        team={team}
                        teamType="operational team"
                        onEdit={() => {
                          setEditingTeam(team);
                          setShowEditOperationalTeam(true);
                        }}
                      />
                    ))
                  ) : (
                    <div className="flex h-40 items-center justify-center rounded-lg border-2 border-dashed border-gray-200">
                      <div className="text-center">
                        <p className="text-sm text-gray-700">
                          No teams formed yet
                        </p>
                        <p className="text-xs text-gray-600">
                          Click "Add team" to create your first team
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="shelter" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            {/* Shelter Members Section */}
            <div className="flex flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg sm:text-xl font-bold text-gray-900">
                      Shelter Members
                    </h3>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info size={16} className="text-gray-400" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-gray-900">
                            View and manage ward boys for shelter operations
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <p className="text-sm text-gray-700">
                    {getAvailableMembers("shelter team")} out of{" "}
                    {getTotalMembers("shelter team")} members available
                  </p>
                </div>
              </div>

              <div className="flex-1">
                <div className="h-full">
                  <div className="grid gap-4">
                    {/* Ward Boys Section */}
                    <div>
                      <div className="mb-2 flex items-center gap-2">
                        <h4 className="text-sm font-medium text-gray-700">
                          Ward Boys
                        </h4>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Info size={14} className="text-gray-400" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-gray-900">
                                Team members responsible for shelter operations
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <div className="space-y-2">
                        {membersData?.["shelter team"]?.["ward boy"]?.map(
                          (member) => (
                            <MemberCard
                              key={member.id}
                              member={member}
                              section="shelter team"
                              category="ward boy"
                            />
                          ),
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Shelter Teams Section */}
            <div className="flex flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg sm:text-xl font-bold text-gray-900">
                      Shelter Teams
                    </h3>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info size={16} className="text-gray-400" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-gray-900">
                            Currently formed shelter teams and their members
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <p className="text-sm text-gray-700">
                    {teams["shelter team"]?.length ?? 0} teams formed
                  </p>
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        className="rounded-md border border-blue-500 px-3 py-1 text-xs font-medium text-blue-500 hover:bg-blue-50"
                        onClick={() => setIsOperationalTeamModalOpen(true)}
                      >
                        Add team
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-gray-900">Create a new shelter team</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              <div className="flex-1">
                <div className="grid gap-4">
                  {teams["shelter team"]?.length > 0 ? (
                    teams["shelter team"].map((team) => (
                      <TeamCard
                        key={team.id}
                        team={team}
                        teamType="shelter team"
                      />
                    ))
                  ) : (
                    <div className="flex h-40 items-center justify-center rounded-lg border-2 border-dashed border-gray-200">
                      <div className="text-center">
                        <p className="text-sm text-gray-700">
                          No teams formed yet
                        </p>
                        <p className="text-xs text-gray-600">
                          Click "Add team" to create your first team
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="surgical" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            {/* Surgical Members Section */}
            <div className="flex flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg sm:text-xl font-bold text-gray-900">
                      Surgical Members
                    </h3>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info size={16} className="text-gray-400" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-gray-900">
                            View and manage surgeons and medical assistants
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <p className="text-sm text-gray-700">
                    {surgicalAvailable} out of {surgicalTotal} members available
                  </p>
                </div>
              </div>

              <div className="flex-1">
                <div className="h-full">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
                    {/* Surgeons Section */}
                    <div>
                      <div className="mb-2 flex items-center gap-2">
                        <h4 className="text-sm font-medium text-gray-700">
                          Surgeons
                        </h4>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Info size={14} className="text-gray-400" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-gray-900">
                                Veterinary surgeons performing medical
                                procedures
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <div className="space-y-2">
                        {membersData?.["surgical team"].surgeon.map(
                          (member) => (
                            <MemberCard
                              key={member.id}
                              member={member}
                              section="surgical team"
                              category="surgeon"
                            />
                          ),
                        )}
                      </div>
                    </div>

                    {/* Medical Assistants Section */}
                    <div>
                      <div className="mb-2 flex items-center gap-2">
                        <h4 className="text-sm font-medium text-gray-700">
                          Medical Assistants
                        </h4>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Info size={14} className="text-gray-400" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-gray-900">
                                Trained professionals assisting in surgical
                                procedures
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <div className="space-y-2">
                        {membersData?.["surgical team"][
                          "medical assistant"
                        ].map((member) => (
                          <MemberCard
                            key={member.id}
                            member={member}
                            section="surgical team"
                            category="medical assistant"
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Surgical Teams Section */}
            <div className="flex flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg sm:text-xl font-bold text-gray-900">
                      Surgical Teams
                    </h3>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info size={16} className="text-gray-400" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-gray-900">
                            Currently formed surgical teams and their members
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <p className="text-sm text-gray-700">
                    {teams["surgical team"].length} teams formed
                  </p>
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        className="rounded-md border border-blue-500 px-3 py-1 text-xs font-medium text-blue-500 hover:bg-blue-50"
                        onClick={() => setIsSurgicalTeamModalOpen(true)}
                      >
                        Add team
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-gray-900">
                        Create a new surgical team
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              <div className="flex-1">
                <div className="grid gap-4">
                  {teams["surgical team"].length > 0 ? (
                    teams["surgical team"].map((team) => (
                      <TeamCard
                        key={team.id}
                        team={team}
                        teamType="surgical team"
                      />
                    ))
                  ) : (
                    <div className="flex h-40 items-center justify-center rounded-lg border-2 border-dashed border-gray-200">
                      <div className="text-center">
                        <p className="text-sm text-gray-700">
                          No teams formed yet
                        </p>
                        <p className="text-xs text-gray-600">
                          Click "Add team" to create your first team
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <AddMemberModal
        isOpen={isAddMemberModalOpen}
        onClose={() => setIsAddMemberModalOpen(false)}
        onAddMember={handleAddMember}
      />

      <AddSurgicalTeamModal
        isOpen={isSurgicalTeamModalOpen}
        onClose={() => setIsSurgicalTeamModalOpen(false)}
        onAddTeam={handleAddSurgicalTeam}
        availableMembers={filteredSurgicalMembers}
      />

      <AddOperationalTeamModal
        isOpen={isOperationalTeamModalOpen}
        onClose={() => setIsOperationalTeamModalOpen(false)}
        onAddTeam={handleAddOperationalTeam}
        availableMembers={filteredOperationalMembers}
      />

      {showEditOperationalTeam && editingTeam && (
        <EditOperationalTeamModal
          isOpen={showEditOperationalTeam}
          onClose={() => setShowEditOperationalTeam(false)}
          team={editingTeam}
          onUpdateTeam={handleUpdateOperationalTeam}
          availableMembers={filteredOperationalMembers}
        />
      )}
    </div>
  );
}
