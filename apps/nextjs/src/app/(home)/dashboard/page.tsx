"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  Archive,
  ArrowUpRight,
  Briefcase,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Dog,
  FolderKanban,
  Layers,
  MoreVertical,
  Plus,
  Search,
  Sprout,
  Users,
  X,
} from "lucide-react";

import { api } from "~/trpc/react";
import type { RouterOutputs } from "~/trpc/react";

interface DashboardStats {
  totalCaptures: number;
  totalReleases: number;
}

type DashboardTeam = RouterOutputs["dashboard"]["getTeamsByDate"][number];

// Placeholder data for teams
const ongoingTeams = [
  {
    name: "Team A",
    location: "Shankarpalle",
    avatarColor: "bg-blue-200",
    icon: <Users className="h-5 w-5 text-blue-600" />,
  },
  {
    name: "Team D",
    location: "Madhapur",
    avatarColor: "bg-pink-200",
    icon: <Users className="h-5 w-5 text-pink-600" />,
  },
  {
    name: "Team D",
    location: "Madhapur",
    avatarColor: "bg-pink-200",
    icon: <Users className="h-5 w-5 text-pink-600" />,
  },
  {
    name: "Team D",
    location: "Madhapur",
    avatarColor: "bg-pink-200",
    icon: <Users className="h-5 w-5 text-pink-600" />,
  },
  {
    name: "Team A",
    location: "Shankarpalle",
    avatarColor: "bg-blue-200",
    icon: <Users className="h-5 w-5 text-blue-600" />,
  },
  {
    name: "Team A",
    location: "Shankarpalle",
    avatarColor: "bg-blue-200",
    icon: <Users className="h-5 w-5 text-blue-600" />,
  },
];

// Placeholder team members for cards
const teamMembers = [
  { name: "A", avatar: "/placeholder-avatar.png" }, // Replace with actual avatar paths
  { name: "B", avatar: "/placeholder-avatar.png" },
  { name: "C", avatar: "/placeholder-avatar.png" },
  { name: "F", avatar: "/placeholder-avatar.png" },
];

interface CalendarDay {
  day: number;
  date: Date;
  isCurrentMonth: boolean;
  isSelected: boolean;
}

const normalizeVehicleColor = (color?: string | null) => {
  if (!color) return "#E5E7EB";
  const c = color.toLowerCase();
  if (c === "blue") return "#93C5FD";
  return color;
};

const formatDateDdMmYyyy = (date: Date) => {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
};

export default function DashboardPage() {
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedRange, setSelectedRange] = useState<
    "today" | "last_week" | "last_month" | "last_3_months" | null
  >(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<DashboardTeam | null>(null);

  // Helper to get range dates
  const getRangeDates = (
    range: "today" | "last_week" | "last_month" | "last_3_months",
  ) => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date(end);
    switch (range) {
      case "today":
        start.setHours(0, 0, 0, 0);
        break;
      case "last_week":
        start.setDate(start.getDate() - 7);
        break;
      case "last_month":
        start.setMonth(start.getMonth() - 1);
        break;
      case "last_3_months":
        start.setMonth(start.getMonth() - 3);
        break;
    }
    return { start, end };
  };

  // Fetch overall stats
  const { data: overallStats, isLoading: isLoadingOverall } =
    api.dashboard.getStats.useQuery(undefined, {
      refetchOnWindowFocus: false,
    });

  // Fetch stats for selected range
  const {
    data: rangeStats,
    isLoading: isLoadingRange,
    refetch: refetchRange,
  } = api.dashboard.getStatsByRange.useQuery(
    selectedRange
      ? getRangeDates(selectedRange)
      : { start: new Date(), end: new Date() },
    {
      enabled: !!selectedRange,
      refetchOnWindowFocus: false,
    },
  );

  // Fetch daily stats when a date is selected
  const { data: dailyStats, isLoading: isLoadingDaily } =
    api.dashboard.getDailyStats.useQuery(
      { date: selectedDate ?? new Date() },
      {
        enabled: !!selectedDate,
        refetchOnWindowFocus: false,
      },
    );

  // Fetch teams based on selected date
  const { data: teams = [], isLoading: isLoadingTeams } =
    api.dashboard.getTeamsByDate.useQuery(
      { date: selectedDate || undefined },
      {
        enabled: true,
        refetchOnWindowFocus: false,
      },
    );

  // Fetch ongoing vehicle colors for capture batches and release tasks
  const { data: ongoingVehicles = [] } =
    api.dashboard.getOngoingVehicles.useQuery(undefined, {
      refetchOnWindowFocus: false,
    });

  // Use daily stats if a date is selected, otherwise use overall stats
  const stats = selectedRange
    ? rangeStats
    : selectedDate
      ? dailyStats
      : overallStats;
  const isLoading =
    (selectedRange
      ? isLoadingRange
      : selectedDate
        ? isLoadingDaily
        : isLoadingOverall) || isLoadingTeams;
  const isDailyView = !!selectedDate;
  const rangeLabel = useMemo(() => {
    if (!selectedRange) return null;
    switch (selectedRange) {
      case "today":
        return "Today";
      case "last_week":
        return "Last 7 Days";
      case "last_month":
        return "Last 30 Days";
      case "last_3_months":
        return "Last 3 Months";
    }
  }, [selectedRange]);

  const handlePrevMonth = () => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1),
    );
  };

  const handleNextMonth = () => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1),
    );
  };

  const handleDateSelect = (day: number, isCurrentMonth: boolean) => {
    if (!isCurrentMonth) return;

    const selected = new Date(currentDate);
    selected.setDate(day);
    setSelectedDate((prev) => {
      // Toggle date selection if clicking the same date again
      if (prev && prev.toDateString() === selected.toDateString()) {
        return null;
      }
      return selected;
    });
  };

  const handleClearSelection = () => {
    setSelectedDate(null);
    setSelectedRange(null);
  };

  const getDaysInMonth = (dateToDisplay: Date): CalendarDay[] => {
    const year = dateToDisplay.getFullYear();
    const month = dateToDisplay.getMonth();

    const firstDayOfMonthJs = new Date(year, month, 1).getDay(); // 0 (Sun) - 6 (Sat)
    const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();

    const daysArray: CalendarDay[] = [];

    // Calculate Monday-based offset (0 for Monday, 6 for Sunday)
    const firstDayOffset = firstDayOfMonthJs === 0 ? 6 : firstDayOfMonthJs - 1;

    const prevMonthEndDate = new Date(year, month, 0).getDate();

    // Previous month's trailing days
    for (let i = firstDayOffset; i > 0; i--) {
      const prevMonthDay = prevMonthEndDate - i + 1;
      daysArray.push({
        day: prevMonthDay,
        date: new Date(year, month - 1, prevMonthDay),
        isCurrentMonth: false,
        isSelected: false,
      });
    }

    // Current month's days
    for (let i = 1; i <= daysInCurrentMonth; i++) {
      const dayDate = new Date(year, month, i);
      const isSelectedDay = selectedDate
        ? dayDate.toDateString() === selectedDate.toDateString()
        : false;

      daysArray.push({
        day: i,
        date: dayDate,
        isCurrentMonth: true,
        isSelected: isSelectedDay,
      });
    }

    // Next month's leading days to fill up 6 weeks (42 cells)
    let nextMonthDay = 1;
    while (daysArray.length < 42) {
      daysArray.push({
        day: nextMonthDay,
        date: new Date(year, month + 1, nextMonthDay),
        isCurrentMonth: false,
        isSelected: false,
      });
      nextMonthDay++;
    }
    return daysArray;
  };

  const days = getDaysInMonth(currentDate);
  const weekDays = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

  return (
    <div className="flex h-full flex-col p-4 font-sans lg:flex-row lg:p-6">
      {/* Main content area */}
      <div className="flex-1 space-y-6 lg:pr-6">
        {/* Top Row: Search bar ONLY */}
        <div className="flex items-center justify-between space-x-4">
          <div className="relative flex-1">
            {" "}
            {/* Search bar takes available space */}
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search"
              className="block w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-sm placeholder-gray-500 focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          {/* Filter buttons moved from here */}
        </div>

        {/* New Row: Total Activity Title and Filter Buttons */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-800 sm:text-xl">
              {isDailyView && selectedDate
                ? `Activity for ${formatDateDdMmYyyy(selectedDate)}`
                : "Total Activity"}
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* All Time tab */}
            <button
              onClick={handleClearSelection}
              className={`rounded-md px-2 py-1 text-xs font-medium sm:px-3 sm:text-sm ${!selectedRange && !selectedDate
                ? "bg-slate-800 text-white"
                : "text-gray-700 hover:bg-gray-100"
                }`}
            >
              All Time
            </button>
            {["today", "last_week", "last_month", "last_3_months"].map((r) => (
              <button
                key={r}
                onClick={() => {
                  setSelectedRange(r as any);
                  setSelectedDate(null); // clear calendar selection
                }}
                className={`rounded-md px-2 py-1 text-xs font-medium sm:px-3 sm:text-sm ${selectedRange === r
                  ? "bg-slate-800 text-white"
                  : "text-gray-700 hover:bg-gray-100"
                  }`}
              >
                {r === "today"
                  ? "Today"
                  : r === "last_week"
                    ? "Last Week"
                    : r === "last_month"
                      ? "Last Month"
                      : "Last 3 Months"}
              </button>
            ))}
          </div>
          {/* <div className="flex flex-shrink-0 space-x-1 rounded-lg bg-gray-200 p-0.5">
            <button className="rounded-md px-3 py-1 text-sm font-medium text-gray-700 hover:bg-white">
              Daily
            </button>
            <button className="rounded-md px-3 py-1 text-sm font-medium text-gray-700 hover:bg-white">
              Weekly
            </button>
            <button className="rounded-md bg-slate-800 px-3 py-1 text-sm font-medium text-white">
              Annually
            </button>
          </div> */}
        </div>

        {/* Activity Cards Section (was part of Total Activity Section) */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Total Captures Card */}
          <div
            className="rounded-xl bg-white p-6 shadow cursor-pointer transition duration-150 hover:-translate-y-0.5 hover:shadow-md hover:bg-gray-50"
            onClick={() => {
              const params = new URLSearchParams();
              if (selectedRange) params.set("range", selectedRange);
              else if (selectedDate) params.set("date", selectedDate.toISOString());
              const qs = params.toString();
              router.push(`/capture-list${qs ? `?${qs}` : ""}`);
            }}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-500">
                Total Captures
              </p>
              <ArrowUpRight className="h-5 w-5 text-gray-400" />
            </div>
            <p className="mt-2 text-3xl font-bold text-gray-800">
              {isLoading ? "..." : (stats?.totalCaptures ?? 0).toLocaleString()}
            </p>
            {/* <div className="mt-3 flex items-center space-x-2">
              <div className="flex -space-x-2">
                {teamMembers.map((member, index) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={index}
                    className="inline-block h-6 w-6 rounded-full ring-2 ring-white"
                    src={member.avatar}
                    alt={member.name}
                  />
                ))}
              </div>
              <p className="text-xs text-gray-500">Team A, B, C, F</p>
            </div> */}
          </div>

          {/* Total Releases Card */}
          <div
            className="rounded-xl bg-white p-6 shadow cursor-pointer transition duration-150 hover:-translate-y-0.5 hover:shadow-md hover:bg-gray-50"
            onClick={() => {
              const params = new URLSearchParams();
              if (selectedRange) params.set("range", selectedRange);
              else if (selectedDate) params.set("date", selectedDate.toISOString());
              const qs = params.toString();
              router.push(`/release-list${qs ? `?${qs}` : ""}`);
            }}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-500">
                Total Releases
              </p>
              <ArrowUpRight className="h-5 w-5 text-gray-400" />
            </div>
            <p className="mt-2 text-3xl font-bold text-gray-800">
              {isLoading ? "..." : (stats?.totalReleases ?? 0).toLocaleString()}
            </p>
            {/* <div className="mt-3 flex items-center space-x-2">
              <div className="flex -space-x-2">
                {teamMembers.map((member, index) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={index}
                    className="inline-block h-6 w-6 rounded-full ring-2 ring-white"
                    src={member.avatar}
                    alt={member.name}
                  />
                ))}
              </div>
              <p className="text-xs text-gray-500">Team A, B, C, F</p>
            </div> */}
          </div>
        </div>

        {/* Ongoing Teams Section */}
        <div className="rounded-xl bg-white p-6 shadow">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-800">
              Ongoing Teams
            </h2>
            <div className="flex items-center space-x-2">
              <div className="flex -space-x-1">
                {ongoingVehicles.slice(0, 3).map((vehicle) => (
                  <span
                    key={vehicle.id}
                    className="inline-block h-6 w-6 rounded-full ring-2 ring-white"
                    style={{
                      backgroundColor: normalizeVehicleColor(vehicle.color),
                    }}
                  />
                ))}
                {ongoingVehicles.length === 0 && (
                  <>
                    <span className="inline-block h-6 w-6 rounded-full bg-gray-300 ring-2 ring-white" />
                    <span className="inline-block h-6 w-6 rounded-full bg-gray-300 ring-2 ring-white" />
                    <span className="inline-block h-6 w-6 rounded-full bg-gray-300 ring-2 ring-white" />
                  </>
                )}
              </div>
              {/* <button className="rounded-full p-1 text-gray-500 hover:bg-gray-100">
                <Plus className="h-5 w-5" />
              </button>  */}
              {/* <button className="rounded-full p-1 text-gray-500 hover:bg-gray-100">
                <MoreVertical className="h-5 w-5" />
              </button> */}
            </div>
          </div>
          <div className="space-y-3">
            {isLoading ? (
              // Loading state
              Array(2)
                .fill(0)
                .map((_, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between rounded-lg p-3"
                  >
                    <div className="flex items-center">
                      <div className="mr-3 h-10 w-10 animate-pulse rounded-full bg-gray-200"></div>
                      <div className="space-y-2">
                        <div className="h-4 w-24 animate-pulse rounded bg-gray-200"></div>
                        <div className="h-3 w-16 animate-pulse rounded bg-gray-200"></div>
                      </div>
                    </div>
                    <div className="h-8 w-16 animate-pulse rounded bg-gray-200"></div>
                  </div>
                ))
            ) : teams.length > 0 ? (
              // Teams list
              teams.map((team) => (
                <div
                  key={team.id}
                  className="flex items-center justify-between rounded-lg p-3 hover:bg-gray-50"
                >
                  <div className="flex items-center">
                    <div
                      className={`mr-3 flex h-10 w-10 items-center justify-center rounded-full ${team.avatarColor}`}
                    >
                      <Users
                        className={`h-5 w-5 ${team.avatarColor.includes("blue") ? "text-blue-600" : "text-pink-600"}`}
                      />
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">{team.name}</p>
                      <p className="text-xs text-gray-500">{team.location}</p>
                    </div>
                  </div>
                  <button
                    className="rounded-md px-3 py-1 text-sm font-medium text-blue-600 hover:bg-blue-50"
                    type="button"
                    onClick={() => setSelectedTeam(team)}
                  >
                    View
                  </button>
                </div>
              ))
            ) : (
              // No teams message
              <div className="rounded-lg bg-gray-50 p-4 text-center text-sm text-gray-500">
                {selectedDate
                  ? `No teams active on ${selectedDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                  : "No active teams found"}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Sidebar */}
      <div className="mt-6 w-full space-y-6 lg:mt-0 lg:w-80 lg:flex-shrink-0 xl:w-96">
        {/* Calendar Section */}
        <div className="rounded-xl bg-white p-4 shadow sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <button
              onClick={handlePrevMonth}
              className="rounded-full p-1 text-gray-500 hover:bg-gray-100"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <h3 className="text-xs font-semibold text-gray-700 sm:text-sm">
              {currentDate
                .toLocaleDateString("en-US", { month: "long", year: "numeric" })
                .toUpperCase()}
            </h3>
            <button
              onClick={handleNextMonth}
              className="rounded-full p-1 text-gray-500 hover:bg-gray-100"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs">
            {weekDays.map((day) => (
              <div key={day} className="font-medium text-gray-500">
                {day}
              </div>
            ))}
            {days.map((dayObj, index) => (
              <button
                key={index}
                type="button"
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs sm:h-8 sm:w-8 sm:text-sm ${dayObj.isCurrentMonth ? "cursor-pointer" : "cursor-default"
                  } ${dayObj.isSelected ? "bg-blue-600 font-medium text-white" : ""
                  } ${dayObj.isCurrentMonth && !dayObj.isSelected
                    ? "text-gray-800 hover:bg-gray-100"
                    : ""
                  } ${!dayObj.isCurrentMonth ? "text-gray-400" : ""}`}
                onClick={() =>
                  handleDateSelect(dayObj.day, dayObj.isCurrentMonth)
                }
              >
                {dayObj.day}
              </button>
            ))}
          </div>
        </div>

        {/* Analytics Section */}
        <div className="rounded-xl bg-white p-4 shadow sm:p-6">
          <h3 className="mb-4 text-base font-semibold text-gray-800 sm:text-lg">
            Analytics
          </h3>
          <div className="flex items-center justify-center">
            <div className="relative h-32 w-32 sm:h-40 sm:w-40">
              <svg className="h-full w-full" viewBox="0 0 36 36">
                <path
                  className="text-gray-200"
                  strokeWidth="3.5"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845
                    a 15.9155 15.9155 0 0 1 0 31.831
                    a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-blue-600"
                  strokeWidth="3.5"
                  strokeDasharray={`${Math.min(100, stats ? (stats.totalCaptures + stats.totalReleases) / 10 : 0)}, 100`}
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845
                    a 15.9155 15.9155 0 0 1 0 31.831
                    a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-bold text-blue-600 sm:text-2xl">
                  {isLoading ? (
                    <div className="h-6 w-8 animate-pulse rounded bg-gray-200"></div>
                  ) : (
                    Number(stats?.totalCaptures || 0) +
                    Number(stats?.totalReleases || 0)
                  )}
                </span>
                <span className="text-xs text-gray-500">
                  {selectedDate ? "Dogs Today" : "Total Dogs"}
                </span>
              </div>
            </div>
          </div>
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Surgicals Completed:</span>
              {isLoading ? (
                <div className="h-4 w-6 animate-pulse rounded bg-gray-200"></div>
              ) : (
                <span className="font-semibold text-green-500">
                  {stats?.completedSurgeries || 0}
                </span>
              )}
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Operations Completed:</span>
              <span className="font-semibold text-green-500">0</span>
            </div>
          </div>
        </div>

        {/* Create Assignment Section */}
        {selectedTeam && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="relative w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
              <button
                type="button"
                onClick={() => setSelectedTeam(null)}
                className="absolute right-3 top-3 rounded-full p-1 text-gray-500 hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>

              <h3 className="mb-1 text-lg font-semibold text-gray-800">
                {selectedTeam.name}
              </h3>
              <p className="mb-4 text-sm text-gray-500">
                {selectedTeam.location}
              </p>

              <div className="max-h-64 space-y-2 overflow-y-auto">
                {selectedTeam.members && selectedTeam.members.length > 0 ? (
                  selectedTeam.members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between rounded-md border border-gray-100 px-3 py-2"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-800">
                          {member.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {member.role}
                          {member.category ? ` · ${member.category}` : ""}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500">
                    No members found for this team.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
