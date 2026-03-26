import { and, eq, gte, isNull, lte, not, or, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@acme/db";
import {
  batchesTable,
  capturedDogsTable,
  locationsTable,
  operationTasksTable,
  releaseTasksTable,
  teamsTable,
  vehicleTable,
} from "@acme/db/schema";

import { createTRPCRouter, publicProcedure } from "../trpc";

const getDateRange = (date: Date) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  return { start, end };
};

// Define the surgical task status type
type SurgicalTaskStatus = "pending" | "in_progress" | "completed" | "cancelled";

export const dashboardRouter = createTRPCRouter({
  // Get ongoing teams with their details
  getTeamsByDate: publicProcedure
    .input(
      z.object({
        date: z.date().optional(),
      }),
    )
    .query(async ({ input }) => {
      try {
        console.log("Fetching teams with input:", input);

        // Create date range if date is provided
        let dateCondition = undefined;
        if (input?.date) {
          const start = new Date(input.date);
          start.setHours(0, 0, 0, 0);

          const end = new Date(input.date);
          end.setHours(23, 59, 59, 999);

          dateCondition = and(
            gte(operationTasksTable.updatedAt, start),
            lte(operationTasksTable.updatedAt, end),
          );
        }

        // Get ongoing teams from operations_tasks and join with teams and locations tables
        const query = db
          .select({
            id: teamsTable.id,
            name: teamsTable.name,
            location: locationsTable.name,
            members: teamsTable.members,
            // Add avatar color based on team name for consistent coloring
            avatarColor: sql<string>`CASE 
              WHEN ${teamsTable.name} LIKE '%A%' THEN 'bg-blue-200'
              WHEN ${teamsTable.name} LIKE '%B%' THEN 'bg-green-200'
              WHEN ${teamsTable.name} LIKE '%C%' THEN 'bg-yellow-200'
              ELSE 'bg-pink-200'
            END`,
            icon: sql<string>`'users'`,
          })
          .from(operationTasksTable)
          .innerJoin(teamsTable, eq(operationTasksTable.teamId, teamsTable.id))
          .innerJoin(
            locationsTable,
            eq(operationTasksTable.locationId, locationsTable.id),
          )
          .where(and(eq(operationTasksTable.status, "ongoing"), dateCondition))
          .groupBy(teamsTable.id, teamsTable.name, locationsTable.name);

        console.log("Generated SQL:", query.toSQL());
        const ongoingTeams = await query;
        console.log("Fetched teams:", ongoingTeams);

        return ongoingTeams;
      } catch (error) {
        console.error("Error in getTeamsByDate procedure:", error);
        throw new Error("Failed to fetch teams");
      }
    }),

  // Get overall statistics (all time)
  getStats: publicProcedure.query(async () => {
    try {
      // Count individual captured dogs (status='captured' and not yet released)
      const [captureAgg] = await db
        .select({
          value: sql<number>`cast(count(*) as int)`,
        })
        .from(capturedDogsTable)
        .where(
          and(
            eq(capturedDogsTable.status, "captured"),
            or(
              isNull(capturedDogsTable.releaseStatus),
              not(eq(capturedDogsTable.releaseStatus, "released")),
            ),
          ),
        );

      // Count individual released dogs (release_status='released')
      const [releaseAgg] = await db
        .select({
          value: sql<number>`cast(count(*) as int)`,
        })
        .from(capturedDogsTable)
        .where(eq(capturedDogsTable.releaseStatus, "released"));

      // Keep completedSurgeries based on batch surgical_task_status
      const allBatches = await db
        .select({
          surgicalTaskStatus: batchesTable.surgical_task_status,
        })
        .from(batchesTable);

      const completedSurgeries = allBatches.filter(
        (batch) => batch.surgicalTaskStatus === "completed",
      ).length;

      return {
        totalCaptures: captureAgg?.value ?? 0,
        totalReleases: releaseAgg?.value ?? 0,
        completedSurgeries,
      };
    } catch (error) {
      console.error("Error in getStats procedure:", error);
      throw new Error("Failed to fetch dashboard statistics");
    }
  }),

  // Get statistics for a date range
  getStatsByRange: publicProcedure
    .input(
      z.object({
        start: z.date(),
        end: z.date(),
      }),
    )
    .query(async ({ input }) => {
      try {
        const { start, end } = input;

        // Count captured dogs in the given date range (by capture date)
        const [captureAgg] = await db
          .select({
            value: sql<number>`cast(count(*) as int)`,
          })
          .from(capturedDogsTable)
          .where(
            and(
              gte(capturedDogsTable.createdAt, start),
              lte(capturedDogsTable.createdAt, end),
              eq(capturedDogsTable.status, "captured"),
              or(
                isNull(capturedDogsTable.releaseStatus),
                not(eq(capturedDogsTable.releaseStatus, "released")),
              ),
            ),
          );

        // Count released dogs in the given date range (by release date)
        const [releaseAgg] = await db
          .select({
            value: sql<number>`cast(count(*) as int)`,
          })
          .from(capturedDogsTable)
          .where(
            and(
              eq(capturedDogsTable.releaseStatus, "released"),
              gte(capturedDogsTable.releaseDate, start),
              lte(capturedDogsTable.releaseDate, end),
            ),
          );

        // Still derive completedSurgeries from batches within the range
        const batches = await db
          .select({
            surgicalTaskStatus: batchesTable.surgical_task_status,
            updatedAt: batchesTable.updatedAt,
          })
          .from(batchesTable)
          .where(
            and(
              gte(batchesTable.updatedAt, start),
              lte(batchesTable.updatedAt, end),
            ),
          );

        const completedSurgeries = batches.filter(
          (b) => b.surgicalTaskStatus === "completed",
        ).length;

        return {
          totalCaptures: captureAgg?.value ?? 0,
          totalReleases: releaseAgg?.value ?? 0,
          completedSurgeries,
        };
      } catch (error) {
        console.error("Error in getStatsByRange:", error);
        throw new Error("Failed to fetch statistics for range");
      }
    }),

  // Get statistics for a specific date
  getDailyStats: publicProcedure
    .input(
      z.object({
        date: z.date(),
      }),
    )
    .query(async ({ input }) => {
      try {
        const { start, end } = getDateRange(input.date);

        // Count captured dogs for the selected date (by capture date)
        const [captureAgg] = await db
          .select({
            value: sql<number>`cast(count(*) as int)`,
          })
          .from(capturedDogsTable)
          .where(
            and(
              gte(capturedDogsTable.createdAt, start),
              lte(capturedDogsTable.createdAt, end),
              eq(capturedDogsTable.status, "captured"),
              or(
                isNull(capturedDogsTable.releaseStatus),
                not(eq(capturedDogsTable.releaseStatus, "released")),
              ),
            ),
          );

        // Count released dogs for the selected date (by release date)
        const [releaseAgg] = await db
          .select({
            value: sql<number>`cast(count(*) as int)`,
          })
          .from(capturedDogsTable)
          .where(
            and(
              eq(capturedDogsTable.releaseStatus, "released"),
              gte(capturedDogsTable.releaseDate, start),
              lte(capturedDogsTable.releaseDate, end),
            ),
          );

        // Completed surgeries still based on batch surgical_task_status for that date
        const batches = await db
          .select({
            surgicalTaskStatus: batchesTable.surgical_task_status,
            updatedAt: batchesTable.updatedAt,
          })
          .from(batchesTable)
          .where(
            and(
              gte(batchesTable.updatedAt, start),
              lte(batchesTable.updatedAt, end),
            ),
          );

        const completedSurgeries = batches.filter(
          (batch) => batch.surgicalTaskStatus === "completed",
        ).length;

        return {
          date: input.date,
          totalCaptures: captureAgg?.value ?? 0,
          totalReleases: releaseAgg?.value ?? 0,
          completedSurgeries,
        };
      } catch (error) {
        console.error("Error in getDailyStats procedure:", error);
        throw new Error("Failed to fetch daily statistics");
      }
    }),

  // Get unique vehicle colors for ongoing capture batches and release tasks
  getOngoingVehicles: publicProcedure.query(async () => {
    try {
      // Active capture batches
      const activeCaptureVehicles = await db
        .select({
          id: batchesTable.id,
          vehicleColor: vehicleTable.vehicleColor,
        })
        .from(batchesTable)
        .leftJoin(vehicleTable, eq(batchesTable.vehicleId, vehicleTable.id))
        .where(eq(batchesTable.status, "active"));

      // Active/ongoing release tasks
      const activeReleaseVehicles = await db
        .select({
          id: releaseTasksTable.id,
          vehicleColor: vehicleTable.vehicleColor,
        })
        .from(releaseTasksTable)
        .leftJoin(
          vehicleTable,
          eq(releaseTasksTable.vehicleId, vehicleTable.id),
        )
        .where(
          or(
            eq(releaseTasksTable.status, "active"),
            eq(releaseTasksTable.status, "ongoing"),
          ),
        );

      const vehicleColors = [...activeCaptureVehicles, ...activeReleaseVehicles]
        .map((item) => item.vehicleColor)
        .filter((color): color is string => Boolean(color));

      const uniqueColors = Array.from(new Set(vehicleColors));

      return uniqueColors.map((color, index) => ({
        id: `vehicle-${index}`,
        color,
      }));
    } catch (error) {
      console.error("Error in getOngoingVehicles procedure:", error);
      return [];
    }
  }),
});
