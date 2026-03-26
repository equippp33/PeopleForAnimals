import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Animated,
  PanResponder,
  Dimensions,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { LinearGradient } from "expo-linear-gradient";
import type * as Location from "expo-location";
import { useFocusEffect, useRouter } from "expo-router";
import { AntDesign, EvilIcons, Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { format, addDays } from "date-fns";
import { api } from "~/utils/api";
import { useTranslation } from "~/utils/LanguageContext";
import CalendarHeader from "../_components/CalenderHeader";
import { useTabContext } from "../_components/TabContext";

interface Circle {
  name: string;
  hiCircleName?: string;
  teCircleName?: string;
  coordinates: { lat: number; lng: number };
  volunteers: Volunteer[];
  operationTask: { id: string; status: string } | null;
}

interface Location {
  id: string;
  name: string;
  area: string;
  notes: string | null;
  hi_name?: string;
  te_name?: string;
  hi_area?: string;
  te_area?: string;
  hi_notes?: string | null;
  te_notes?: string | null;
  coordinates: { lat: number; lng: number };
  circles: Circle[];
}

interface Team {
  id: string;
  name: string;
  members: { id: string; name: string }[];
}

interface Vehicle {
  id: string;
  name: string;
}

interface TaskResponse {
  id: string;
  taskType: "capture" | "release";
  status: string | null;
  teamId: string | null;
  vehicleId: string | null;
  location: Location | null;
  team: Team | null;
  vehicle: Vehicle | null;
  createdAt: string;
  updatedAt: string;
}

interface ListItem {
  id: string;
  location: Location;
  circles: {
    name: string;
    hiCircleName?: string;
    teCircleName?: string;
    coordinates: { lat: number; lng: number };
    operationTaskId: string | null;
    status: string;
    volunteers: Volunteer[];
  }[];
  team: string;
  status: string | null;
  taskType: "capture" | "release";
  createdAt: string;
  time: string;
  totalRelease: number;
  dogsReceived?: number;
  teamId: string | null;
  vehicleId: string | null;
  vehicle: Vehicle | null;
  updatedAt: string;
  notes?: string;
}

interface TeamMember {
  id: string;
  name: string;
  role: string;
  category: string;
}

interface Task {
  id: string;
  taskType: "capture" | "release";
  status: string | null;
  teamId: string | null;
  vehicleId: string | null;
  location: Location;
  team: string;
  vehicle: Vehicle | null;
  createdAt: string;
  updatedAt: string;
  circles: {
    name: string;
    hiCircleName?: string;
    teCircleName?: string;
    coordinates: { lat: number; lng: number };
    operationTaskId: string | null;
    status: string;
    volunteers: Volunteer[];
  }[];
  notes?: string;
  dogsReceived?: number;
}

interface ActiveBatchSummary {
  anyActiveByTaskId: Record<string, boolean>;
  myActiveByTaskId: Record<string, boolean>;
}

const OperationalPage = () => {
  const { language, t } = useTranslation();
  const pickLang = (en: string, hi?: string, te?: string) =>
    language === "hi" ? (hi ?? en) : language === "te" ? (te ?? en) : en;
  const [selectedDate, setSelectedDate] = useState(new Date());
  const { selectedTab, setSelectedTab } = useTabContext();

  // Memoized styles to prevent color preservation issues
  const tabStyles = useMemo(
    () => ({
      releaseActive: { opacity: 0.8 },
      captureActive: { opacity: 0.8 },
      inactive: { opacity: 1 },
      locationTileBackground: { backgroundColor: "rgba(230, 246, 255, 0.5)" },
      circleTileBackground: { backgroundColor: "rgba(230, 246, 255, 0.5)" },
      textOpacity: { opacity: 0.6 },
    }),
    [],
  );
  const [expandedTile, setExpandedTile] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  // vehicle reading alert
  const [vehicleModalVisible, setVehicleModalVisible] = useState(false);
  const [selectedCircles, setSelectedCircles] = useState<
    Record<string, string>
  >({});
  // Track which tasks have just been started (for button text logic)
  const [justStartedTasks, setJustStartedTasks] = useState<
    Record<string, boolean>
  >({});
  const [refreshing, setRefreshing] = useState(false); // State for refreshing

  const [isOngoingBadgeExpanded, setIsOngoingBadgeExpanded] = useState(false);
  const windowDimensions = Dimensions.get("window");
  const [ongoingBadgePosition, setOngoingBadgePosition] = useState({
    x: windowDimensions.width - 90,
    y: 200,
  });
  const ongoingBadgeDragStart = useRef({
    x: ongoingBadgePosition.x,
    y: ongoingBadgePosition.y,
  });
  const ongoingBadgePositionRef = useRef(ongoingBadgePosition);
  const ongoingBadgeIsDragging = useRef(false);
  const ongoingBadgeHasBeenMovedManually = useRef(false);
  const [teamStatusLayout, setTeamStatusLayout] = useState<
    { x: number; y: number; width: number; height: number } | null
  >(null);

  useEffect(() => {
    ongoingBadgePositionRef.current = ongoingBadgePosition;
  }, [ongoingBadgePosition]);

  // Once we know where the team status banner is, snap the badge near its
  // right side (only if the user hasn't already dragged it somewhere).
  useEffect(() => {
    if (!teamStatusLayout || ongoingBadgeHasBeenMovedManually.current) return;

    const DOT_SIZE = 32;
    const MARGIN = 16; // small offset from the right edge

    const newX =
      teamStatusLayout.x + teamStatusLayout.width - DOT_SIZE - MARGIN;
    const newY =
      teamStatusLayout.y + teamStatusLayout.height / 2 - DOT_SIZE / 2;

    setOngoingBadgePosition({ x: newX, y: newY });
  }, [teamStatusLayout]);

  const ongoingBadgePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        ongoingBadgeDragStart.current = {
          x: ongoingBadgePositionRef.current.x,
          y: ongoingBadgePositionRef.current.y,
        };
        ongoingBadgeIsDragging.current = false;
      },
      onPanResponderMove: (_, gestureState) => {
        const distance = Math.max(
          Math.abs(gestureState.dx),
          Math.abs(gestureState.dy),
        );

        // Ignore tiny movements so a tap doesn't move the badge
        if (!ongoingBadgeIsDragging.current && distance < 5) {
          return;
        }

        if (!ongoingBadgeIsDragging.current) {
          ongoingBadgeIsDragging.current = true;
          ongoingBadgeHasBeenMovedManually.current = true;
        }

        const rawX = ongoingBadgeDragStart.current.x + gestureState.dx;
        const rawY = ongoingBadgeDragStart.current.y + gestureState.dy;

        setOngoingBadgePosition({
          x: rawX,
          y: rawY,
        });
      },
      onPanResponderRelease: () => {
        // If the user just tapped (no real drag), toggle expand/collapse
        if (!ongoingBadgeIsDragging.current) {
          setIsOngoingBadgeExpanded((prev) => !prev);
        }

        ongoingBadgeIsDragging.current = false;
      },
    }),
  ).current;

  const router = useRouter();

  const { data: currentUser } = api.user.getCurrentUser.useQuery(undefined);
  const { data: teams, refetch: refetchTeams } =
    api.team.getAllTeams.useQuery(undefined, {
      // Auto-refresh team assignments periodically (every 3s)
      refetchInterval: 3000,
    });
  const { data: vehicles, refetch: refetchVehicles } =
    api.vehicle.getAllVehicles.useQuery(undefined, {
      // Auto-refresh vehicle assignments periodically (every 3s)
      refetchInterval: 3000,
    });

  const captureTasks = api.task.getTasksByType.useQuery(
    {
      taskType: "capture",
      date: format(selectedDate, "yyyy-MM-dd"),
    },
    {
      // Auto-refresh capture tasks periodically (every 3s)
      refetchInterval: 3000,
    },
  );

  const releaseTasks = api.task.getTasksByType.useQuery(
    {
      taskType: "release",
      date: format(selectedDate, "yyyy-MM-dd"),
    },
    {
      // Auto-refresh release tasks periodically (every 3s)
      refetchInterval: 3000,
    },
  );

  const { data: myActiveBatchData } = api.task.getMyActiveBatch.useQuery();
  const myActiveBatch = myActiveBatchData?.batch ?? null;

  const captureOperationTaskIds = useMemo(() => {
    if (!captureTasks.data?.success) return [];
    const tasks = (captureTasks.data.tasks as TaskResponse[]).filter(
      (t: any) => t?.location?.circles,
    );
    return tasks.map((t) => t.id);
  }, [captureTasks.data]);

  const { data: activeBatchSummaryData } =
    api.task.getActiveBatchSummaryByOperationTaskIds.useQuery(
      { operationTaskIds: captureOperationTaskIds },
      { enabled: captureOperationTaskIds.length > 0 },
    );

  const activeBatchSummary: ActiveBatchSummary =
    activeBatchSummaryData ?? { anyActiveByTaskId: {}, myActiveByTaskId: {} };

  // All release tasks (used only to highlight dates in the calendar header)
  const { data: allReleaseTasks } = api.task.getAllReleaseTasks.useQuery(
    undefined,
    {
      // Auto-refresh release calendar highlights periodically (every 3s)
      refetchInterval: 3000,
    },
  );

  const { assignedReleaseDates, overdueReleaseDates } = useMemo(() => {
    if (!allReleaseTasks || !teams || !currentUser) {
      return {
        assignedReleaseDates: [] as string[],
        overdueReleaseDates: [] as string[],
      };
    }

    const userTeam = (teams as Team[]).find((team) =>
      team.members.some(
        (member: { id: string; name: string }) => member.id === currentUser.id,
      ),
    );

    if (!userTeam) {
      return {
        assignedReleaseDates: [] as string[],
        overdueReleaseDates: [] as string[],
      };
    }

    const assignedSet = new Set<string>();
    const overdueSet = new Set<string>();
    const now = new Date();
    const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

    (allReleaseTasks as any[]).forEach((task) => {
      const status = (task).status;
      const releaseDate = (task).releaseDate as
        | string
        | Date
        | null
        | undefined;
      const teamId = (task).teamId as string | null | undefined;

      if (!releaseDate || status === "completed") return;
      // Only consider releases assigned to this user's team
      if (!teamId || teamId !== userTeam.id) return;

      const dateObj = new Date(releaseDate);
      const key = format(dateObj, "yyyy-MM-dd");

      if (dateObj < cutoff) {
        overdueSet.add(key);
      } else {
        assignedSet.add(key);
      }
    });

    return {
      assignedReleaseDates: Array.from(assignedSet),
      overdueReleaseDates: Array.from(overdueSet),
    };
  }, [allReleaseTasks, teams, currentUser]);

  // Release dates assigned to the current user's team but
  // outside the visible 15-day window [today-7, today+7]
  const teamOutOfWindowReleaseDates = useMemo(() => {
    if (!allReleaseTasks || !teams || !currentUser) return [] as string[];

    const userTeam = (teams as Team[]).find((team) =>
      team.members.some(
        (member: { id: string; name: string }) => member.id === currentUser.id,
      ),
    );

    if (!userTeam) return [] as string[];

    const now = new Date();
    const todayMidnight = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const windowStart = addDays(todayMidnight, -7);
    const windowEnd = addDays(todayMidnight, 7);

    const set = new Set<string>();

    (allReleaseTasks as any[]).forEach((task) => {
      const status = (task).status;
      const releaseDate = (task).releaseDate as
        | string
        | Date
        | null
        | undefined;
      const teamId = (task).teamId as string | null | undefined;

      if (!releaseDate || status === "completed") return;
      if (!teamId || teamId !== userTeam.id) return;

      const dateObj = new Date(releaseDate);
      if (dateObj < windowStart || dateObj > windowEnd) {
        const key = format(dateObj, "yyyy-MM-dd");
        set.add(key);
      }
    });

    return [...set].sort();
  }, [allReleaseTasks, teams, currentUser]);

  const filteredReleaseTasks = useMemo(() => {
    const tasksArr = releaseTasks.data?.tasks;
    if (!Array.isArray(tasksArr)) return [];
    return tasksArr.filter(
      (task) => (task as { status?: string }).status !== "completed",
    );
  }, [releaseTasks.data]);

  // Refetch tasks when screen is focused (after navigation)
  useFocusEffect(
    React.useCallback(() => {
      captureTasks.refetch();
      releaseTasks.refetch();
      void refetchTeams();
      void refetchVehicles();
    }, [selectedDate]),
  );

  // Handle pull-to-refresh
  const onRefresh = async () => {
    setRefreshing(true); // Show the spinner
    // Reset UI state to prevent color preservation
    setExpandedTile(null);
    setSelectedCircles({});
    await Promise.all([
      captureTasks.refetch(),
      releaseTasks.refetch(),
      refetchTeams(),
      refetchVehicles(),
    ]); // Refetch tasks, teams, and vehicles
    setRefreshing(false); // Hide the spinner
  };

  const getUserTeam = () => {
    if (!currentUser || !teams) return null;

    return teams.find((team: Team) =>
      team.members.some(
        (member: { id: string; name: string }) => member.id === currentUser.id,
      ),
    );
  };

  const getUserVehicle = () => {
    const userTeam = getUserTeam();
    if (!userTeam || !vehicles) return null;

    // Prefer team.vehicleId if present; fall back to any nested vehicle id shape
    const vehicleId =
      (userTeam as any).vehicleId ??
      ((userTeam as any).vehicle?.id);

    if (!vehicleId) return null;

    const vehicle = vehicles.find((v: any) => v.id === vehicleId);
    return vehicle ?? null;
  };

  const hasOngoingTask = useMemo(() => {
    const userTeam = getUserTeam();
    if (!userTeam) return false;

    const myCaptureActive = Object.values(activeBatchSummary.myActiveByTaskId).some(
      (v) => v,
    );
    const myReleaseOngoing = filteredReleaseTasks.some(
      (task: any) => task?.status === "ongoing" && task?.teamId === userTeam.id,
    );

    return myCaptureActive || myReleaseOngoing;
  }, [activeBatchSummary, filteredReleaseTasks, teams, currentUser]);

  // Overall flag: does this user/team have ANY task active (ongoing or just started but not yet synced)?
  const anyTaskActive = useMemo(() => {
    if (hasOngoingTask) return true;
    return Object.values(justStartedTasks).some((v) => v);
  }, [hasOngoingTask, justStartedTasks]);

  const currentReleaseOngoingInfo = useMemo(() => {
    const userTeam = getUserTeam();
    if (!userTeam) return null;

    const releaseArr: TaskResponse[] =
      releaseTasks.data?.success && Array.isArray(releaseTasks.data.tasks)
        ? (releaseTasks.data.tasks as TaskResponse[])
        : [];

    const ongoing = releaseArr.find(
      (t) =>
        (t.status === "ongoing" || t.status === "active") &&
        t.teamId === userTeam.id &&
        t.location,
    );

    if (!ongoing?.location) return null;

    const location: any = ongoing.location;
    const circles = Array.isArray(location.circles) ? location.circles : [];

    let circleName: string | undefined;
    let hiCircleName: string | undefined;
    let teCircleName: string | undefined;

    const matchedCircle = circles.find(
      (c: any) => c?.operationTask?.id === ongoing.id,
    );

    const circleForDisplay = matchedCircle || circles[0];

    if (circleForDisplay) {
      circleName = circleForDisplay.name;
      hiCircleName = circleForDisplay.hiCircleName;
      teCircleName = circleForDisplay.teCircleName;
    }

    const areaName: string =
      location.area ?? location.name ?? "";
    const hiAreaName: string | undefined =
      location.hi_area ?? location.hi_name;
    const teAreaName: string | undefined =
      location.te_area ?? location.te_name;

    return {
      taskId: ongoing.id,
      taskType: ongoing.taskType,
      circleName: circleName ?? "Unknown circle",
      hiCircleName,
      teCircleName,
      areaName,
      hiAreaName,
      teAreaName,
    };
  }, [releaseTasks.data, teams, currentUser]);

  const currentOngoingInfo = useMemo(() => {
    if (!myActiveBatch) {
      return currentReleaseOngoingInfo;
    }
    const areaName: string =
      myActiveBatch.areaName ?? myActiveBatch.locationName ?? "";
    const hiAreaName: string | null = myActiveBatch.hi_name ?? null;
    const teAreaName: string | null = myActiveBatch.te_name ?? null;

    return {
      taskId: myActiveBatch.operationTaskId,
      taskType: myActiveBatch.taskType,
      circleName: myActiveBatch.circleName ?? "Unknown circle",
      hiCircleName: myActiveBatch.hiCircleName ?? undefined,
      teCircleName: myActiveBatch.teCircleName ?? undefined,
      areaName,
      hiAreaName: hiAreaName ?? undefined,
      teAreaName: teAreaName ?? undefined,
    };
  }, [myActiveBatch, currentReleaseOngoingInfo]);

  const badgeIsOngoing = !!currentOngoingInfo;

  const canStartTask = (task: Task) => {
    const userTeam = getUserTeam();
    if (!userTeam) return false;

    // If task is pending, anyone can start it unless their team has an ongoing task
    if (task.status === "pending") {
      return !anyTaskActive;
    }

    // If task is ongoing, only the assigned team can continue it
    if (task.status === "ongoing") {
      return task.teamId === userTeam.id;
    }

    return false;
  };

  const getTaskButtonState = (task: Task) => {
    const userTeam = getUserTeam();
    const userVehicle = getUserVehicle();

    // If user is not in a team or has no assigned vehicle, show disabled Start Task button
    if (!userTeam || !userVehicle) {
      return {
        text: "Start Task",
        disabled: true,
        style: "bg-gray-400",
      };
    }

    // If task is completed, show as completed
    if (task.status === "completed") {
      return {
        text: "Task Completed",
        disabled: true,
        style: "bg-gray-400",
      };
    }

    // Collect all operation task IDs (task.id + all circle operationTaskIds)
    // because each circle can have its own operationTaskId
    // Note: API returns operationTask.id but interface says operationTaskId - check both
    const allOperationTaskIds = [
      task.id,
      ...(task.circles || [])
        .map((c: any) => c.operationTaskId ?? c.operationTask?.id)
        .filter((id): id is string => !!id),
    ];

    // Check if any of these IDs were "just started" locally
    const hasJustStarted = allOperationTaskIds.some(
      (opId) => !!justStartedTasks[opId],
    );

    if (task.taskType === "capture") {
      // Check if myActiveBatch (used by badge) matches any of this task's operation IDs
      const isMyActiveBatchTask = myActiveBatch?.operationTaskId
        ? allOperationTaskIds.includes(myActiveBatch.operationTaskId)
        : false;

      const myHasActiveBatch = isMyActiveBatchTask || allOperationTaskIds.some(
        (opId) => !!activeBatchSummary.myActiveByTaskId[opId],
      );
      const anyHasActiveBatch = allOperationTaskIds.some(
        (opId) => !!activeBatchSummary.anyActiveByTaskId[opId],
      );

      if (myHasActiveBatch) {
        return {
          text: "Continue Task",
          disabled: false,
          style: "bg-[#1B85F3]",
        };
      }

      if (anyHasActiveBatch) {
        if (anyTaskActive) {
          return {
            text: "Complete Current Task",
            disabled: true,
            style: "bg-gray-400",
          };
        }
        return {
          text: "Join Task",
          disabled: false,
          style: "bg-[#1B85F3]",
        };
      }
    }

    // If task is ongoing but not assigned to a specific team (teamId is null),
    // allow other teams to join (and allow this team to continue if they locally started).
    // This prevents the button from disappearing due to falling through to the default state.
    if (task.status === "ongoing" && !task.teamId) {
      if (hasJustStarted) {
        return {
          text: "Continue Task",
          disabled: false,
          style: "bg-[#1B85F3]",
        };
      }
      if (anyTaskActive) {
        return {
          text: "Complete Current Task",
          disabled: true,
          style: "bg-gray-400",
        };
      }
      return {
        text: "Join Task",
        disabled: false,
        style: "bg-[#1B85F3]",
      };
    }

    // If task is ongoing and assigned to another team, allow this team to join
    // only if they don't already have another active task.
    if (task.status === "ongoing" && task.teamId && task.teamId !== userTeam.id) {
      if (anyTaskActive) {
        return {
          text: "Complete Current Task",
          disabled: true,
          style: "bg-gray-400",
        };
      }
      return {
        text: "Join Task",
        disabled: false,
        style: "bg-[#1B85F3]",
      };
    }

    // If task is ongoing and assigned to this team
    if (task.status === "ongoing" && task.teamId === userTeam.id) {
      return {
        text: "Continue Task",
        disabled: false,
        style: "bg-[#1B85F3]",
      };
    }

    // Pending tasks
    if (task.status === "pending") {
      // If this particular pending task was already started by us but backend not updated yet
      if (hasJustStarted) {
        return {
          text: "Continue Task",
          disabled: false,
          style: "bg-[#1B85F3]",
        };
      }
      if (anyTaskActive) {
        return {
          text: "Complete Current Task",
          disabled: true,
          style: "bg-gray-400",
        };
      }
      // Otherwise allow starting
      return {
        text: t("Start Task"),
        disabled: false,
        style: "bg-[#1B85F3]",
      };
    }

    // Default fallback
    return {
      text: "",
      disabled: true,
      style: "",
    };
  };

  // Check AsyncStorage for just started tasks on mount/focus
  const checkStartedTasks = async () => {
    // Check both capture and release tasks
    const allTasks = [
      ...(captureTasks.data?.success
        ? (captureTasks.data.tasks ?? []).filter(
          (t: any) => t?.location?.circles,
        )
        : []),
      ...(releaseTasks.data?.success
        ? (releaseTasks.data.tasks ?? []).filter(
          (t: any) => t?.location?.circles,
        )
        : []),
    ];
    const updated: Record<string, boolean> = {};
    for (const task of allTasks) {
      try {
        const flag = await AsyncStorage.getItem(`task_started_${task.id}`);
        if (flag === "true") {
          updated[task.id] = true;
          // DON'T remove the flag here - keep it until task is confirmed
        }
      } catch (e) {
        // ignore
      }
    }
    setJustStartedTasks(updated);
  };

  // Initial check for just started tasks
  useEffect(() => {
    checkStartedTasks();
  }, [captureTasks.data, releaseTasks.data]);

  useFocusEffect(
    React.useCallback(() => {
      captureTasks.refetch();
      releaseTasks.refetch();
      checkStartedTasks();
    }, [selectedDate]),
  );

  // Log the raw API response to verify data
  useEffect(() => {
    if (captureTasks.error) {
      console.error("Capture Tasks Error:", captureTasks.error);
    }
    if (releaseTasks.error) {
      console.error("Release Tasks Error:", releaseTasks.error);
    }
    console.log("Capture Tasks Response:", captureTasks.data);
    console.log("Release Tasks Response:", releaseTasks.data);
  }, [
    captureTasks.data,
    captureTasks.error,
    releaseTasks.data,
    releaseTasks.error,
  ]);


  // Map API data to lists with circles
  console.log("→ captureTasks object", JSON.stringify(captureTasks, null, 2));
  const releaseList = useMemo(() => {
    if (!releaseTasks.data?.success) return [];
    const userTeam = getUserTeam();
    if (!userTeam) return [];
    // Only include tasks with required properties
    const tasks = (releaseTasks.data.tasks as TaskResponse[]).filter(
      (t: any) =>
        t &&
        t.status !== "completed" &&
        t.location?.circles &&
        // only show tasks assigned to this user's team
        t.teamId === userTeam.id,
    );

    // Group tasks by location name to avoid duplicates
    const locationMap = new Map();

    tasks.forEach((rawTask) => {
      if (!rawTask.location) return;

      const locationKey = rawTask.location.name;
      if (!locationMap.has(locationKey)) {
        locationMap.set(locationKey, {
          id: rawTask.id,
          taskType: rawTask.taskType,
          status: rawTask.status,
          teamId: rawTask.teamId,
          vehicleId: rawTask.vehicleId,
          location: rawTask.location,
          team: rawTask.team?.name || "Unassigned",
          vehicle: rawTask.vehicle,
          batchId: (rawTask as any).batchId ?? undefined,
          createdAt: rawTask.createdAt,
          updatedAt: rawTask.updatedAt,
          totalRelease: (rawTask as any).totalRelease ?? 0,
          dogsReceived: (rawTask as any).dogsReceived ?? 0,

          circles: rawTask.location.circles || [],
        });
      } else {
        // Merge circles if location already exists, avoiding duplicates
        const existingLocation = locationMap.get(locationKey);
        const existingCircleNames = new Set(
          (existingLocation.circles as { name: string }[]).map((c) => c.name),
        );
        const newCircles = (rawTask.location.circles || []).filter(
          (circle) => !existingCircleNames.has(circle.name),
        );
        existingLocation.circles = [...existingLocation.circles, ...newCircles];
      }
    });

    return Array.from(locationMap.values());
  }, [releaseTasks.data]);

  const captureList = useMemo(() => {
    if (!captureTasks.data?.success) return [];
    // Only include capture tasks with required properties.
    // We intentionally DO NOT filter by team here so that other teams can
    // see tasks which are already ongoing for someone else and choose to
    // join them.
    const tasks = (captureTasks.data.tasks as TaskResponse[]).filter(
      (t: any) => t?.location?.circles,
    );

    // Group tasks by location name to avoid duplicates
    const locationMap = new Map();

    tasks.forEach((rawTask) => {
      if (!rawTask.location) return;

      const locationKey = rawTask.location.name;
      if (!locationMap.has(locationKey)) {
        locationMap.set(locationKey, {
          id: rawTask.id,
          taskType: rawTask.taskType,
          status: rawTask.status,
          teamId: rawTask.teamId,
          vehicleId: rawTask.vehicleId,
          location: rawTask.location,
          team: rawTask.team?.name || "Unassigned",
          vehicle: rawTask.vehicle,
          batchId: (rawTask as any).batchId ?? undefined,
          createdAt: rawTask.createdAt,
          updatedAt: rawTask.updatedAt,
          totalRelease: (rawTask as any).totalRelease ?? 0,
          dogsReceived: (rawTask as any).dogsReceived ?? 0,
          notes: rawTask.location.notes || undefined,
          circles: rawTask.location.circles || [],
        });
      } else {
        // Merge circles if location already exists, avoiding duplicates
        const existingLocation = locationMap.get(locationKey);
        const existingCircleNames = new Set(
          (existingLocation.circles as { name: string }[]).map((c) => c.name),
        );
        const newCircles = (rawTask.location.circles || []).filter(
          (circle) => !existingCircleNames.has(circle.name),
        );
        existingLocation.circles = [...existingLocation.circles, ...newCircles];
      }
    });

    return Array.from(locationMap.values());
  }, [captureTasks.data]);

  // Filter lists based on search query
  const filteredReleaseList = releaseList.filter((item) =>
    item.location.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );
  const filteredCaptureList = captureList.filter((item) =>
    item.location.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // Handle circle selection/deselection
  const handleCircleSelection = (taskId: string, circleName: string) => {
    setSelectedCircles((prev) => {
      if (prev[taskId] === circleName) {
        const newSelectedCircles = { ...prev };
        delete newSelectedCircles[taskId];
        return newSelectedCircles;
      }
      return { ...prev, [taskId]: circleName };
    });
  };

  // Create a mutation for checking team vehicle reading
  const checkTeamVehicleReading =
    api.vehicleData.checkTeamVehicleReading.useMutation();

  // Helper to verify daily vehicle reading before navigating to release location
  const canNavigateToRelease = async (): Promise<boolean> => {
    try {
      // Check if any team member has added vehicle reading for today
      const result = await checkTeamVehicleReading.mutateAsync();

      if (result.success && result.hasReading) {
        return true;
      } else {
        setVehicleModalVisible(true);
        return false;
      }
    } catch (error) {
      console.error("Error checking team vehicle reading:", error);
      // Fallback to local storage check for backward compatibility
      const todayKey = `vehicle_reading_${new Date().toISOString().slice(0, 10)}`;
      const done = await AsyncStorage.getItem(todayKey);
      if (!done) {
        setVehicleModalVisible(true);
        return false;
      }
      return true;
    }
  };

  return (
    <GestureHandlerRootView className="flex-1">
      {/* Vehicle Reading Modal */}
      <Modal
        transparent
        animationType="fade"
        visible={vehicleModalVisible}
        onRequestClose={() => setVehicleModalVisible(false)}
      >
        <View style={styles.backdrop}>
          <LinearGradient
            colors={["#ffffff", "#ffe5e5", "#ff6b6b"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.modalCard}
          >
            <Text style={styles.modalTitle}>🚫 OOPS</Text>
            <Text style={styles.modalBody}>Please update vehicle reading</Text>
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setVehicleModalVisible(false)}
              >
                <Text style={styles.cancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.addBtn}
                onPress={() => {
                  setVehicleModalVisible(false);
                  router.push("/ABC/operationalScreens/addspeed" as any);
                }}
              >
                <Text style={styles.addTxt}>Add Reading</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      </Modal>

      <View className="flex-1 bg-white">
        <CalendarHeader
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          assignedReleaseDates={assignedReleaseDates}
          overdueReleaseDates={overdueReleaseDates}
        />

        {teamOutOfWindowReleaseDates.length > 0 && (
          <View className="mt-1 mb-1">
            <Text className="px-4 text-[11px] font-medium text-red-700">
              {t("Due Release Dates")}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="mt-1 px-4"
            >
              {teamOutOfWindowReleaseDates.map((dateKey) => {
                const dateObj = new Date(dateKey);
                const isSelected =
                  format(selectedDate, "yyyy-MM-dd") === dateKey;
                return (
                  <TouchableOpacity
                    key={dateKey}
                    onPress={() => {
                      setSelectedTab("release");
                      setSelectedDate(dateObj);
                    }}
                    className={`mr-2 items-center justify-center rounded-xl border px-3 py-2 ${isSelected
                      ? "bg-blue-100 border-[#D1E6FF]"
                      : "bg-red-50 border-red-200"
                      }`}
                    activeOpacity={1}
                  >
                    <Text
                      className={`text-sm font-medium ${isSelected ? "text-[#1B85F3]" : "text-red-500"
                        }`}
                    >
                      {format(dateObj, "MMM")}
                    </Text>
                    <Text
                      className={`text-sm font-medium ${isSelected ? "text-[#4b4d50]" : "text-red-500"
                        }`}
                    >
                      {format(dateObj, "dd")}
                    </Text>
                    <Text
                      className={`text-[11px] font-medium ${isSelected ? "text-[#1B85F3]" : "text-red-500"
                        }`}
                    >
                      {format(dateObj, "EEE")}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Team Status Indicator */}
        {(() => {
          const userTeam = getUserTeam();
          if (userTeam) {
            const userVehicle = getUserVehicle();
            const hasAssignedVehicle = !!userVehicle;
            const vehicleDisplayName =
              (userVehicle as any)?.name ||
              (userVehicle as any)?.vehicleNumber ||
              t("Unknown Vehicle");
            return (
              <View
                className="mx-4 mt-3 mb-2 rounded-lg bg-blue-50 border border-blue-200 p-3"
                onLayout={(event) => setTeamStatusLayout(event.nativeEvent.layout)}
              >
                <Text className="text-sm font-medium text-[#1B85F3]">
                  {t("Team Status: You are in team")} <Text className="font-bold">{userTeam.name}</Text>
                </Text>
                <Text className="mt-1 text-sm font-medium text-[#1B85F3]">
                  {hasAssignedVehicle ? (
                    <>
                      {t("Vehicle Status: You are in vehicle")} <Text className="font-bold">{vehicleDisplayName}</Text>
                    </>
                  ) : (
                    <Text className="mt-1 text-sm font-medium text-red-700">
                      {t('Vehicle Status: "No vehicle is assigned yet"')}
                    </Text>
                  )}
                </Text>
              </View>
            );
          } else {
            const userVehicle = getUserVehicle();
            const hasAssignedVehicle = !!userVehicle;
            const vehicleDisplayName =
              (userVehicle as any)?.name ||
              (userVehicle as any)?.vehicleNumber ||
              t("Unknown Vehicle");
            return (
              <View
                className="mx-4 mt-3 mb-2 rounded-lg bg-red-50 border border-red-200 p-3"
                onLayout={(event) => setTeamStatusLayout(event.nativeEvent.layout)}
              >
                <Text className="text-sm font-medium text-red-700">
                  {t("Team Status: Please join a team to start a task")}
                </Text>
                <Text className="mt-1 text-sm font-medium text-[#1B85F3]">
                  {hasAssignedVehicle ? (
                    <>
                      {t("Vehicle Status: You are in vehicle")} <Text className="font-bold">{vehicleDisplayName}</Text>
                    </>
                  ) : (
                    <Text className="mt-1 text-sm font-medium text-red-700">
                      {t('Vehicle Status: "No vehicle is assigned yet"')}
                    </Text>
                  )}
                </Text>
              </View>
            );
          }
        })()}

        {/* Toggle Buttons for Release and Capture */}
        <View
          className="mx-4 my-4 mb-6 mt-3 flex-row rounded-2xl"
          style={{
            shadowColor: "#1B85F3",
            shadowOffset: { width: 10, height: 4 },
            shadowOpacity: 0.1,
            shadowRadius: 4.65,
            elevation: 9,
            backgroundColor: "white",
          }}
        >
          <TouchableOpacity
            onPress={() => setSelectedTab("release")}
            activeOpacity={1}
            className={`flex-1 rounded-2xl py-4 ${selectedTab === "release" ? "m-1.5 bg-[#E6F6FF]" : "m-1.5 bg-white"}`}
          >
            <Text
              className={`text-center font-medium uppercase ${selectedTab === "release" ? "text-black" : "text-[#A0AEC0]"}`}
              style={
                selectedTab === "release"
                  ? tabStyles.releaseActive
                  : tabStyles.inactive
              }
            >
              {pickLang("Release", "रिलीज़", "రిలీజ్")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setSelectedTab("capture")}
            activeOpacity={1}
            className={`flex-1 rounded-2xl py-4 ${selectedTab === "capture" ? "m-1.5 bg-[#E6F6FF]" : "m-1.5 bg-white"}`}
          >
            <Text
              className={`text-center font-medium uppercase ${selectedTab === "capture" ? "text-black" : "text-[#A0AEC0]"}`}
              style={
                selectedTab === "capture"
                  ? tabStyles.captureActive
                  : tabStyles.inactive
              }
            >
              {pickLang("Capture", "कैप्चर", "క్యాప్చర్")}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search Bar with Icons */}
        <View className="mx-4 mb-10 mt-1 flex-row items-center rounded-xl border border-[#e6f6ff] bg-[#FEFEFE] px-3 py-1">
          <EvilIcons name="search" size={20} color="#A0AEC0" />
          <TextInput
            className="mx-2 flex-1 text-sm text-black"
            placeholder={t("Search")}
            placeholderTextColor="#A0AEC0"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <TouchableOpacity>
            <Feather name="filter" size={20} color="#A0AEC0" />
          </TouchableOpacity>
        </View>

        {/* Separate Lists for Release and Capture */}
        <View className="flex-1 px-4 pb-6">
          <FlatList
            data={
              selectedTab === "release"
                ? filteredReleaseList
                : filteredCaptureList
            }
            keyExtractor={(item: ListItem) => item.id}
            contentContainerStyle={{}}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled={true}
            scrollEnabled={true}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={["#1B85F3"]} // Match your app's theme
                progressBackgroundColor="#ffffff" // Optional: Customize background
              />
            }
            ListEmptyComponent={
              <View className="items-center justify-center rounded-2xl bg-[#F0F4F8] px-4 py-6">
                <Text className="text-sm text-gray-500">
                  {selectedTab === "release"
                    ? t("Release list is empty")
                    : t("Capture list is empty")}
                </Text>
              </View>
            }
            renderItem={({ item }: { item: ListItem }) => (
              <View>
                {/* Location Tile */}
                <View
                  className="mb-3 rounded-2xl border border-[#e6f6ff] px-4 py-6"
                  style={tabStyles.locationTileBackground}
                >
                  {expandedTile !== item.id && (
                    <View className="absolute left-0 top-3/4 z-10 h-10 w-1 rounded-full bg-[#1B85F3]" />
                  )}
                  <TouchableOpacity
                    className="flex-row items-center justify-between"
                    activeOpacity={1}
                    onPress={() =>
                      setExpandedTile(expandedTile === item.id ? null : item.id)
                    }
                  >
                    <View className="flex-1 flex-row items-center gap-3">
                      <EvilIcons name="location" size={24} color="#1B85F3" />
                      <View className="flex-1 flex-row items-center">
                        <Text
                          className="w-3/4 text-base font-semibold tracking-tight text-[#606873]"
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {pickLang(
                            item.location.name,
                            item.location.hi_name ?? undefined,
                            item.location.te_name ?? undefined,
                          )}
                        </Text>
                      </View>
                    </View>
                    <AntDesign
                      name={expandedTile === item.id ? "down" : "right"}
                      size={20}
                      color="black"
                    />
                  </TouchableOpacity>
                </View>

                {/* Expanded Location Details with Volunteers */}
                {expandedTile === item.id && (
                  <View className="mb-3 px-1">
                    {/* <View className="mb-3">
                      <Text className="text-black text-sm font-medium">Volunteers</Text>
                      {item.volunteers && item.volunteers.length > 0 ? (
                        item.volunteers.map((volunteer, index) => (
                          <View key={index} className="mb-2">

                          </View>
                        ))
                      ) : (
                        <Text className="text-sm text-gray-500">No volunteers assigned</Text>
                      )}
                    </View> */}

                    {/* Circles List */}
                    {item.circles.length > 0 ? (
                      item.circles.map((circle: any, index: number) => {
                        return (
                          <View key={index}>
                            <View
                              className="mb-1 rounded-2xl border border-[#e6f6ff] px-4 py-5"
                              style={tabStyles.circleTileBackground}
                            >
                              <TouchableOpacity
                                className="flex-row items-center justify-between"
                                activeOpacity={1}
                                onPress={() =>
                                  handleCircleSelection(item.id, circle.name)
                                }
                              >
                                <View className="flex-1 flex-row items-center gap-2">
                                  <View
                                    className={`mr-2 h-5 w-5 rounded-full ${selectedCircles[item.id] === circle.name
                                      ? "border-[#1b83f3c7] bg-[#1B85F3]"
                                      : "border-[#A0AEC0]"
                                      }`}
                                    style={{ borderWidth: 1.4 }}
                                  >
                                    {selectedCircles[item.id] ===
                                      circle.name && (
                                        <View className="m-auto h-3 w-3 rounded-full bg-white" />
                                      )}
                                  </View>
                                  <Text
                                    className={`text-base font-semibold ${selectedCircles[item.id] === circle.name
                                      ? "text-[#1B85F3]"
                                      : "text-[#606873]"
                                      }`}
                                    numberOfLines={1}
                                    ellipsizeMode="tail"
                                  >
                                    {pickLang(
                                      circle.name,
                                      circle.hiCircleName,
                                      circle.teCircleName,
                                    )}
                                  </Text>
                                </View>
                              </TouchableOpacity>
                            </View>

                            {/* Expanded Circle Details */}
                            {selectedCircles[item.id] === circle.name && (
                              <LinearGradient
                                colors={["white", "#00A5FF"]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 0, y: 5 }}
                                style={{
                                  borderRadius: 16,
                                  borderTopRightRadius: 0,
                                  borderTopLeftRadius: 0,
                                }}
                                className="mb-2 px-5 py-5"
                              >
                                {item.taskType === "capture" ? (
                                  <View className="flex-1">
                                    <View className="flex-row justify-between">
                                      <View>
                                        <Text className="text-sm font-medium text-black">
                                          {t("Admin Comments")}
                                        </Text>
                                        <Text
                                          className="font-regular mb-4 text-sm text-black"
                                          style={tabStyles.textOpacity}
                                          numberOfLines={2}
                                          ellipsizeMode="tail"
                                        >
                                          {pickLang(
                                            item.notes ?? "",
                                            item.location.hi_notes ?? undefined,
                                            item.location.te_notes ?? undefined,
                                          ) || "N/A"}
                                        </Text>
                                      </View>
                                      <View>
                                        {/* <Text className="text-sm font-medium text-black">
                                          Last visited
                                        </Text> */}
                                        {/* <Text className="font-regular text-sm text-[#00000099]">
                                          20 Jan, 2025
                                        </Text> */}
                                      </View>
                                    </View>

                                    {/* Volunteers for this specific circle */}
                                    <View className="flex-1">
                                      <View className="">
                                        <Text className="mb-1 text-sm font-medium text-black">
                                          {t("Circle Volunteers")}
                                        </Text>
                                      </View>

                                      <ScrollView
                                        style={{ maxHeight: 120 }}
                                        scrollEnabled={
                                          circle.volunteers.length > 1
                                        }
                                        showsVerticalScrollIndicator={false}
                                      >
                                        {circle.volunteers.map(
                                          (
                                            volunteer: {
                                              name: string;
                                              phoneNumber: string;
                                            },
                                            volunteerIndex: number,
                                          ) => (
                                            <View key={volunteerIndex}>
                                              <Text
                                                className="font-regular mb-2 text-sm text-black"
                                                style={{ opacity: 0.6 }}
                                              >
                                                {volunteer.name} -{" "}
                                                {volunteer.phoneNumber}
                                              </Text>
                                            </View>
                                          ),
                                        )}
                                      </ScrollView>
                                    </View>
                                    {/* Bottom Actions */}
                                    <View>
                                      <View className="flex-row items-center justify-end">
                                        <View className="flex-row items-center justify-between gap-2">
                                          <TouchableOpacity
                                            className={`rounded-3xl p-3 px-5 ${getTaskButtonState(item).style}`}
                                            onPress={async () => {
                                              const buttonState =
                                                getTaskButtonState(item);
                                              if (!buttonState.disabled) {
                                                // If the button text is "Start Task", set the flag
                                                if (
                                                  buttonState.text ===
                                                  "Start Task"
                                                ) {
                                                  await AsyncStorage.setItem(
                                                    `task_started_${item.id}`,
                                                    "true",
                                                  );
                                                  await checkStartedTasks(); // <-- Force refresh before navigating
                                                }
                                                const clickedAt =
                                                  new Date().toISOString();
                                                router.navigate({
                                                  pathname:
                                                    "/ABC/operationalScreens/capturemap",
                                                  params: {
                                                    id:
                                                      circle.operationTask?.id ||
                                                      item.id,
                                                    coordinates: JSON.stringify(
                                                      circle.coordinates,
                                                    ),
                                                    circleName: circle.name,
                                                    clickedAt,
                                                  },
                                                });
                                              }
                                            }}
                                            disabled={
                                              getTaskButtonState(item).disabled
                                            }
                                          >
                                            <Text className="text-sm font-medium text-white">
                                              {getTaskButtonState(item).text}
                                            </Text>
                                          </TouchableOpacity>
                                        </View>
                                      </View>
                                    </View>
                                  </View>
                                ) : (
                                  <>
                                    <View className="flex-row items-center justify-between">
                                      <Text className="text-sm font-medium text-gray-700">
                                        {pickLang(
                                          circle.name,
                                          circle.hiCircleName,
                                          circle.teCircleName,
                                        )}
                                      </Text>
                                      <View className="flex-row items-center space-x-2">
                                        <View className="h-2 w-2 rounded-full bg-green-500" />
                                      </View>
                                    </View>
                                    <View className="mt-2 flex-row justify-between border-b border-[#104D8D14] pb-2">
                                      <Text className="text-sm font-medium text-[#104D8D]">
                                        {t("Team")}
                                      </Text>
                                      <Text className="text-sm font-medium text-[#104D8D]">
                                        {item.team}
                                      </Text>
                                    </View>
                                    <View className="mt-2 flex-row justify-between border-b border-[#104D8D14] pb-2">
                                      <Text className="text-sm font-medium text-[#104D8D]">
                                        {t("Last update")}
                                      </Text>
                                      <Text className="text-sm font-medium text-[#104D8D]">
                                        {format(
                                          new Date(item.updatedAt),
                                          "MMM do, yyyy",
                                        )}
                                      </Text>
                                    </View>
                                    {/* <View className="mt-2 flex-row justify-between border-b border-[#104D8D14] pb-2">
                                      <Text className="text-sm font-medium text-[#104D8D]">
                                        Time
                                      </Text>
                                      <Text className="text-sm font-medium text-[#104D8D]">
                                        {item.time}
                                      </Text>
                                    </View> */}
                                    <View className="mt-2 flex-row justify-between border-b border-[#104D8D14] pb-2">
                                      <Text className="text-sm font-medium text-[#104D8D]">
                                        {t("Total release")}
                                      </Text>
                                      <Text className="text-sm font-medium text-[#104D8D]">
                                        {item.dogsReceived}
                                      </Text>
                                    </View>
                                    {/* <View className="mt-2 flex-row justify-between border-b border-[#104D8D14] pb-2">
                                      <Text className="text-sm font-medium text-[#104D8D]">
                                        Dogs received
                                      </Text>
                                      <Text className="text-sm font-medium text-[#104D8D]">
                                        {item.dogsReceived}
                                      </Text>
                                    </View> */}
                                    <View className="mt-4 flex-row justify-between">
                                      <TouchableOpacity className="mr-2 flex-1 rounded-full border border-[#1B85F3] bg-transparent py-3">
                                        <Text className="text-center text-sm font-semibold text-[#1B85F3]">
                                          {t("Release list")}
                                        </Text>
                                      </TouchableOpacity>
                                      <TouchableOpacity
                                        className="ml-2 flex-1 rounded-full bg-[#1B85F3] py-3"
                                        onPress={async () => {
                                          // Require daily reading
                                          const allowed =
                                            await canNavigateToRelease();
                                          if (!allowed) return;

                                          const circleName =
                                            selectedCircles[item.id];
                                          const circleObj =
                                            item.circles.find(
                                              (c: any) => c.name === circleName,
                                            ) || item.circles[0];
                                          router.push({
                                            pathname:
                                              "/ABC/operationalScreens/releasemap",
                                            params: {
                                              taskId: item.id,
                                            },
                                          });
                                        }}
                                      >
                                        <Text className="text-center text-sm font-semibold text-white">
                                          {t("Go to location")}
                                        </Text>
                                      </TouchableOpacity>
                                    </View>
                                  </>
                                )}
                              </LinearGradient>
                            )}
                          </View>
                        );
                      })
                    ) : (
                      <Text className="text-sm text-gray-500">
                        No circles available
                      </Text>
                    )}
                  </View>
                )}
              </View>
            )}
          />
        </View>

        <Animated.View
          style={[
            styles.ongoingBadgeContainer,
            {
              left: isOngoingBadgeExpanded
                ? Math.min(
                  Math.max(ongoingBadgePosition.x, 8),
                  windowDimensions.width - 260 - 8,
                )
                : ongoingBadgePosition.x,
              top: ongoingBadgePosition.y,
            },
          ]}
          {...ongoingBadgePanResponder.panHandlers}
        >
          {isOngoingBadgeExpanded ? (
            <View style={styles.ongoingBadgeExpanded}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginBottom: 4,
                }}
              >
                <Feather
                  name="truck"
                  size={16}
                  color="white"
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.ongoingBadgeTitle}>
                  {badgeIsOngoing
                    ? currentOngoingInfo?.taskType === "capture"
                      ? t("Capture task ongoing")
                      : t("Release task ongoing")
                    : t("Circle and Area not started")}
                </Text>
              </View>
              {(badgeIsOngoing && currentOngoingInfo?.taskType === "capture") ? (
                <Text style={styles.ongoingBadgeText}>
                  {`${pickLang("Circle", "सर्किल", "సర్కిల్")}: ${pickLang(
                    currentOngoingInfo?.circleName ?? "",
                    currentOngoingInfo?.hiCircleName,
                    currentOngoingInfo?.teCircleName,
                  )}`}
                </Text>
              ) : null}
              <Text style={styles.ongoingBadgeText}>
                {badgeIsOngoing
                  ? `${pickLang("Area", "एरिया", "ఏరియా")}: ${pickLang(
                    currentOngoingInfo?.areaName ?? "",
                    currentOngoingInfo?.hiAreaName,
                    currentOngoingInfo?.teAreaName,
                  )}`
                  : `${pickLang("Area", "एरिया", "ఏరియా")}: ${t("Not started")}`}
              </Text>
            </View>
          ) : (
            <View style={styles.ongoingBadgeDot}>
              <Feather name="truck" size={16} color="white" />
              <View
                style={[
                  styles.ongoingStatusDot,
                  {
                    backgroundColor: badgeIsOngoing ? "#22c55e" : "#f97316",
                  },
                ]}
              />
            </View>
          )}
        </Animated.View>
      </View>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalCard: {
    width: "85%",
    borderRadius: 32,
    padding: 28,
    alignItems: "center",
  },
  modalTitle: {
    color: "red",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 12,
  },
  modalBody: {
    color: "red",
    textAlign: "center",
    marginBottom: 24,
  },
  buttonRow: {
    flexDirection: "row",
  },
  cancelBtn: {
    borderWidth: 1,
    borderColor: "#fff",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginRight: 8,
  },
  cancelTxt: {
    color: "#fff",
  },
  addBtn: {
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  addTxt: {
    color: "#c81d1d",
    fontWeight: "600",
  },
  ongoingBadgeContainer: {
    position: "absolute",
    opacity: 0.9,
    borderWidth: 2,
    borderColor: "white",
    borderRadius: 18,
  },
  ongoingBadgeDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(27,133,243,0.9)",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    borderWidth: 1,
    borderColor: "white",
  },
  ongoingStatusDot: {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: 6,
    top: 2,
    right: -3,
    borderWidth: 1,
    borderColor: "white",
  },
  ongoingBadgeExpanded: {
    minWidth: 220,
    maxWidth: 260,
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: "rgba(27,133,243,0.95)",
  },
  ongoingBadgeTitle: {
    color: "white",
    fontWeight: "700",
    fontSize: 13,
    marginBottom: 4,
  },
  ongoingBadgeText: {
    color: "white",
    fontSize: 12,
  },
});

export default OperationalPage;
