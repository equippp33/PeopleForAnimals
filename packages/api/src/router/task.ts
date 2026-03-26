import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { TRPCError } from "@trpc/server";
import {
  and,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  not,
  or,
  sql,
} from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";

import { db } from "@acme/db";
import {
  batchesTable,
  capturedDogsTable,
  circlesTable,
  locationsTable,
  operationTasksTable,
  releaseTasksTable,
  surgicalTasksTable,
  tasksTable,
  teamsTable,
  vehicleTable,
} from "@acme/db/schema";

import { env } from "../../../db/env";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";

const taskSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  status: z.enum(["pending", "in_progress", "completed"]).default("pending"),
  assignedTo: z.string().optional(),
  dueDate: z.date().optional(),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
});

export const taskRouter = createTRPCRouter({
  create: protectedProcedure
    .input(taskSchema)
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.insert(tasksTable).values({
        ...input,
        status: input.status,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }),

  getMyActiveBatch: protectedProcedure.query(async ({ ctx }) => {
    const teams = await ctx.db.query.teamsTable.findMany();
    const userTeam = teams.find((team) =>
      team.members.some((member) => member.id === ctx.session.userId),
    );
    if (!userTeam) {
      return { batch: null } as const;
    }

    const rows = await ctx.db
      .select({
        batchId: batchesTable.id,
        batchNumber: batchesTable.batchNumber,
        operationTaskId: batchesTable.operationTaskId,
        taskType: operationTasksTable.taskType,
        circleName: circlesTable.name,
        hiCircleName: circlesTable.hiCircleName,
        teCircleName: circlesTable.teCircleName,
        areaName: locationsTable.area,
        locationName: locationsTable.name,
        hi_name: locationsTable.hi_name,
        te_name: locationsTable.te_name,
      })
      .from(batchesTable)
      .leftJoin(
        operationTasksTable,
        eq(batchesTable.operationTaskId, operationTasksTable.id),
      )
      .leftJoin(circlesTable, eq(operationTasksTable.circleId, circlesTable.id))
      .leftJoin(
        locationsTable,
        eq(operationTasksTable.locationId, locationsTable.id),
      )
      .where(
        and(
          eq(batchesTable.teamId, userTeam.id),
          eq(batchesTable.status, "active"),
        ),
      )
      .orderBy(desc(batchesTable.startTime));

    const row = rows[0];
    if (!row) {
      return { batch: null } as const;
    }

    return {
      batch: {
        id: row.batchId,
        batchNumber: row.batchNumber,
        operationTaskId: row.operationTaskId,
        taskType: row.taskType as "capture" | "release",
        circleName: row.circleName ? String(row.circleName) : null,
        hiCircleName: row.hiCircleName ? String(row.hiCircleName) : null,
        teCircleName: row.teCircleName ? String(row.teCircleName) : null,
        areaName: row.areaName ? String(row.areaName) : null,
        locationName: row.locationName ? String(row.locationName) : null,
        hi_name: row.hi_name ? String(row.hi_name) : null,
        te_name: row.te_name ? String(row.te_name) : null,
      },
    } as const;
  }),

  getActiveBatchSummaryByOperationTaskIds: protectedProcedure
    .input(z.object({ operationTaskIds: z.array(z.string()) }))
    .query(async ({ ctx, input }) => {
      if (!input.operationTaskIds.length) {
        return { anyActiveByTaskId: {}, myActiveByTaskId: {} } as const;
      }

      const teams = await ctx.db.query.teamsTable.findMany();
      const userTeam = teams.find((team) =>
        team.members.some((member) => member.id === ctx.session.userId),
      );
      if (!userTeam) {
        return { anyActiveByTaskId: {}, myActiveByTaskId: {} } as const;
      }

      const activeRows = await ctx.db
        .select({
          operationTaskId: batchesTable.operationTaskId,
          teamId: batchesTable.teamId,
        })
        .from(batchesTable)
        .where(
          and(
            inArray(batchesTable.operationTaskId, input.operationTaskIds),
            eq(batchesTable.status, "active"),
          ),
        );

      const anyActiveByTaskId: Record<string, boolean> = {};
      const myActiveByTaskId: Record<string, boolean> = {};

      for (const row of activeRows) {
        const opId = row.operationTaskId;
        anyActiveByTaskId[opId] = true;
        if (row.teamId === userTeam.id) {
          myActiveByTaskId[opId] = true;
        }
      }

      return { anyActiveByTaskId, myActiveByTaskId } as const;
    }),

  getAll: protectedProcedure.query(async ({ ctx }) => {
    return await ctx.db.query.tasksTable.findMany({
      orderBy: (tasks, { desc }) => [desc(tasks.createdAt)],
    });
  }),

  getById: protectedProcedure
    .input(z.string())
    .query(async ({ ctx, input }) => {
      const task = await ctx.db
        .select({
          id: operationTasksTable.id,
          taskType: operationTasksTable.taskType,
          status: operationTasksTable.status,
          createdAt: operationTasksTable.createdAt,
          updatedAt: operationTasksTable.updatedAt,
          location: {
            id: locationsTable.id,
            name: locationsTable.name,
            hi_name: locationsTable.hi_name,
            te_name: locationsTable.te_name,
            hi_notes: locationsTable.hi_notes,
            te_notes: locationsTable.te_notes,
            area: locationsTable.area,
            notes: locationsTable.notes,
            coordinates: locationsTable.coordinates,
          },
          team: {
            id: teamsTable.id,
            name: teamsTable.name,
            category: teamsTable.category,
            members: teamsTable.members,
          },
          vehicle: {
            id: vehicleTable.id,
            name: vehicleTable.name,
            vehicleNumber: vehicleTable.vehicleNumber,
          },
        })
        .from(operationTasksTable)
        .leftJoin(
          locationsTable,
          eq(operationTasksTable.locationId, locationsTable.id),
        )
        .leftJoin(teamsTable, eq(operationTasksTable.teamId, teamsTable.id))
        .leftJoin(
          vehicleTable,
          eq(operationTasksTable.vehicleId, vehicleTable.id),
        )
        .where(eq(operationTasksTable.id, input))
        .then((rows) => rows[0]);

      if (!task) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Task not found",
        });
      }

      // Get circles for the location if it exists
      if (task.location?.id) {
        const circles = await ctx.db
          .select({
            circleId: circlesTable.id,
            circleName: circlesTable.name,
            circleHiName: circlesTable.hiCircleName,
            circleTeName: circlesTable.teCircleName,

            coordinates: circlesTable.coordinates,
            volunteers: circlesTable.volunteers,
            operationTask: {
              id: operationTasksTable.id,
              status: operationTasksTable.status,
            },
          })
          .from(circlesTable)
          .leftJoin(
            operationTasksTable,
            eq(circlesTable.id, operationTasksTable.circleId),
          )
          .where(eq(circlesTable.locationId, task.location.id));

        return {
          ...task,
          location: {
            ...task.location,

            circles: circles.map((circle) => ({
              name: circle.circleName,
              hiCircleName: circle.circleHiName,
              teCircleName: circle.circleTeName,
              coordinates: circle.coordinates,
              volunteers:
                typeof circle.volunteers === "string"
                  ? JSON.parse(circle.volunteers)
                  : circle.volunteers,
              operationTask: circle.operationTask,
            })),
          },
          createdAt: task.createdAt?.toISOString() ?? new Date().toISOString(),
          updatedAt: task.updatedAt?.toISOString() ?? new Date().toISOString(),
        };
      }

      return {
        ...task,
        location: {
          ...task.location,
          circles: [],
        },
        createdAt: task.createdAt?.toISOString() ?? new Date().toISOString(),
        updatedAt: task.updatedAt?.toISOString() ?? new Date().toISOString(),
      };
    }),

  update: protectedProcedure
    .input(taskSchema.extend({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return await ctx.db
        .update(tasksTable)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(tasksTable.id, id));
    }),

  delete: protectedProcedure
    .input(z.string())
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.delete(tasksTable).where(eq(tasksTable.id, input));
    }),

  createOperationTask: publicProcedure
    .input(
      z.object({
        vehicleId: z.string(),
        teamId: z.string(),
        taskType: z.enum(["capture", "release"]),
        locationId: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const task = await db
          .insert(operationTasksTable)
          .values({
            vehicleId: input.vehicleId,
            teamId: input.teamId,
            taskType: input.taskType,
            locationId: input.locationId,
          })
          .returning();

        return { success: true, task: task[0] };
      } catch (error) {
        console.error("Error creating operation task:", error);
        return { success: false, error: "Failed to create operation task" };
      }
    }),

  createSurgicalTask: publicProcedure
    .input(
      z.object({
        batch: z.string(),
        teamId: z.string(),
        dogId: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const task = await db
          .insert(surgicalTasksTable)
          .values({
            batch: input.batch,
            teamId: input.teamId,
            dogId: input.dogId,
          })
          .returning();

        return { success: true, task: task[0] };
      } catch (error) {
        console.error("Error creating surgical task:", error);
        return { success: false, error: "Failed to create surgical task" };
      }
    }),

  getAllOperationTasks: publicProcedure.query(async () => {
    try {
      const tasks = await db
        .select({
          id: operationTasksTable.id,
          taskType: operationTasksTable.taskType,
          status: operationTasksTable.status,
          createdAt: operationTasksTable.createdAt,
          updatedAt: operationTasksTable.updatedAt,
          location: {
            id: locationsTable.id,
            name: locationsTable.name,
            hi_name: locationsTable.hi_name,
            te_name: locationsTable.te_name,
            hi_notes: locationsTable.hi_notes,
            te_notes: locationsTable.te_notes,
            area: locationsTable.area,
            notes: locationsTable.notes,
            coordinates: locationsTable.coordinates,
          },
          team: {
            id: teamsTable.id,
            name: teamsTable.name,
            category: teamsTable.category,
            members: teamsTable.members,
          },
          vehicle: {
            id: vehicleTable.id,
            name: vehicleTable.name,
            vehicleNumber: vehicleTable.vehicleNumber,
            vehicleColor: vehicleTable.vehicleColor,
          },
        })
        .from(operationTasksTable)
        .leftJoin(
          locationsTable,
          eq(operationTasksTable.locationId, locationsTable.id),
        )
        .leftJoin(teamsTable, eq(operationTasksTable.teamId, teamsTable.id))
        .leftJoin(
          vehicleTable,
          eq(operationTasksTable.vehicleId, vehicleTable.id),
        );
      return tasks;
    } catch (error) {
      console.error("Error fetching operation tasks:", error);
      throw error;
    }
  }),

  getAllBatches: publicProcedure.query(async () => {
    try {
      const batches = await db
        .select({
          // Batch fields
          id: batchesTable.id,
          batchNumber: batchesTable.batchNumber,
          operationTaskId: batchesTable.operationTaskId,
          status: batchesTable.status,
          startTime: batchesTable.startTime,
          endTime: batchesTable.endTime,
          totalDogs: batchesTable.totalDogs,
          release_date: batchesTable.release_date,
          createdAt: batchesTable.createdAt,
          updatedAt: batchesTable.updatedAt,
          capture_supervisor_name: batchesTable.capture_supervisor_name,
          capture_supervisor_photo: batchesTable.capture_supervisor_photo,

          // Team fields
          teamId: teamsTable.id,
          teamName: teamsTable.name,
          teamCategory: teamsTable.category,
          teamMembers: teamsTable.members,

          // Task fields
          taskId: operationTasksTable.id,
          taskType: operationTasksTable.taskType,

          // Location fields
          circleId: circlesTable.id,
          circleName: circlesTable.name,
          hiCircleName: circlesTable.hiCircleName,
          teCircleName: circlesTable.teCircleName,
          locationId: locationsTable.id,
          locationName: locationsTable.name,
          hi_name: locationsTable.hi_name,
          te_name: locationsTable.te_name,
          hi_notes: locationsTable.hi_notes,
          te_notes: locationsTable.te_notes,

          locationArea: locationsTable.area,

          // Vehicle fields
          vehicleId: vehicleTable.id,
          vehicleName: vehicleTable.name,
          vehicleNumber: vehicleTable.vehicleNumber,
          vehicleColor: vehicleTable.vehicleColor,
        })
        .from(batchesTable)
        .leftJoin(teamsTable, eq(batchesTable.teamId, teamsTable.id))
        .leftJoin(
          operationTasksTable,
          eq(batchesTable.operationTaskId, operationTasksTable.id),
        )
        .leftJoin(
          circlesTable,
          eq(operationTasksTable.circleId, circlesTable.id),
        )
        .leftJoin(
          locationsTable,
          eq(circlesTable.locationId, locationsTable.id),
        )
        .leftJoin(vehicleTable, eq(batchesTable.vehicleId, vehicleTable.id))
        .orderBy(desc(batchesTable.createdAt));

      return batches.map((batch) => {
        const circleName = batch.circleName ? String(batch.circleName) : null;
        const locationName = batch.locationName
          ? String(batch.locationName)
          : null;
        const locationArea = batch.locationArea
          ? String(batch.locationArea)
          : null;
        const hi_name = batch.hi_name ? String(batch.hi_name) : null;
        const te_name = batch.te_name ? String(batch.te_name) : null;
        const hi_notes = batch.hi_notes ? String(batch.hi_notes) : null;
        const te_notes = batch.te_notes ? String(batch.te_notes) : null;

        const vehicleInfo = batch.vehicleId
          ? {
              id: batch.vehicleId,
              name: batch.vehicleName ? String(batch.vehicleName) : null,
              number: batch.vehicleNumber ? String(batch.vehicleNumber) : null,
              color: batch.vehicleColor ? String(batch.vehicleColor) : null,
            }
          : null;

        return {
          id: batch.id,
          batchNumber: batch.batchNumber,
          operationTaskId: batch.operationTaskId,
          status: batch.status,
          startTime: batch.startTime,
          endTime: batch.endTime,
          totalDogs: batch.totalDogs,
          release_date: batch.release_date,
          createdAt: batch.createdAt,
          updatedAt: batch.updatedAt,
          capture_supervisor_name: batch.capture_supervisor_name,
          capture_supervisor_photo: batch.capture_supervisor_photo,
          vehicle: vehicleInfo, // Add vehicle info to the response
          team: {
            id: batch.teamId,
            name: String(batch.teamName),
            category: String(batch.teamCategory),
            members: batch.teamMembers,
          },
          operationTask: {
            id: batch.taskId,
            taskType: batch.taskType,
            circle: circleName
              ? {
                  id: batch.circleId,
                  name: circleName,
                  hiCircleName: batch.hiCircleName,
                  teCircleName: batch.teCircleName,
                  location: locationName
                    ? {
                        id: batch.locationId,
                        name: locationName,
                        hi_name: hi_name,
                        te_name: te_name,
                        hi_notes: hi_notes,
                        te_notes: te_notes,
                        area: locationArea ?? undefined,
                      }
                    : undefined,
                }
              : undefined,
          },
        };
      });
    } catch (error) {
      console.error("Error fetching batches:", error);
      throw error;
    }
  }),

  assignReleaseTaskFromBatch: protectedProcedure
    .input(
      z.object({
        batchId: z.string(),
        vehicleId: z.string(),
        teamId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Fetch batch with its linked operation task details
      const batchWithTask = await ctx.db
        .select({
          vehicleId: operationTasksTable.vehicleId,
          teamId: operationTasksTable.teamId,
          locationId: operationTasksTable.locationId,
          circleId: operationTasksTable.circleId,
        })
        .from(batchesTable)
        .leftJoin(
          operationTasksTable,
          eq(batchesTable.operationTaskId, operationTasksTable.id),
        )
        .where(eq(batchesTable.id, input.batchId))
        .then((rows) => rows[0]);

      if (!batchWithTask) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Batch not found",
        });
      }

      // Update all release tasks for this batch that are still pending/active (null ids)
      await ctx.db
        .update(releaseTasksTable)
        .set({
          vehicleId: input.vehicleId ?? batchWithTask.vehicleId,
          teamId: input.teamId,
          locationId: batchWithTask.locationId,
          circleId: batchWithTask.circleId,
          status: "active",
          updatedAt: new Date(),
        })
        .where(eq(releaseTasksTable.batchId, input.batchId));

      return { success: true };
    }),

  unassignReleaseTask: protectedProcedure
    .input(
      z.object({
        batchId: z.string(),
        vehicleId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Find the release task for this batch and vehicle
      const releaseTask = await ctx.db
        .select()
        .from(releaseTasksTable)
        .where(
          and(
            eq(releaseTasksTable.batchId, input.batchId),
            eq(releaseTasksTable.vehicleId, input.vehicleId),
          ),
        )
        .then((rows) => rows[0]);

      if (!releaseTask) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Release task not found",
        });
      }

      // Unassign the team and reset status to pending
      await ctx.db
        .update(releaseTasksTable)
        .set({
          teamId: null,
          vehicleId: null,
          status: "pending",
          updatedAt: new Date(),
        })
        .where(eq(releaseTasksTable.id, releaseTask.id));

      return { success: true };
    }),

  getAllSurgicalTasks: publicProcedure.query(async () => {
    try {
      const tasks = await db
        .select({
          id: surgicalTasksTable.id,
          batch: surgicalTasksTable.batch,
          status: surgicalTasksTable.status,
          createdAt: surgicalTasksTable.createdAt,
          updatedAt: surgicalTasksTable.updatedAt,
          dog: {
            id: capturedDogsTable.id,
            gender: capturedDogsTable.gender,
            location: capturedDogsTable.location,
            dogImageUrl: capturedDogsTable.dogImageUrl,
            fullAddress: capturedDogsTable.fullAddress,
          },
          team: {
            id: teamsTable.id,
            name: teamsTable.name,
            category: teamsTable.category,
            members: teamsTable.members,
          },
        })
        .from(surgicalTasksTable)
        .leftJoin(teamsTable, eq(surgicalTasksTable.teamId, teamsTable.id))
        .leftJoin(
          capturedDogsTable,
          eq(surgicalTasksTable.dogId, capturedDogsTable.id),
        );

      return tasks;
    } catch (error) {
      console.error("Error fetching surgical tasks:", error);
      throw error;
    }
  }),

  // Fetch all release tasks with team, vehicle, batch, and status info for vehicle assignment UI
  getAllReleaseTasks: protectedProcedure.query(async ({ ctx }) => {
    const tasks = await ctx.db
      .select({
        id: releaseTasksTable.id,
        status: releaseTasksTable.status,
        teamId: releaseTasksTable.teamId,
        vehicleId: releaseTasksTable.vehicleId,
        batchId: releaseTasksTable.batchId,
        createdAt: releaseTasksTable.createdAt,
        updatedAt: releaseTasksTable.updatedAt,
        batchNumber: releaseTasksTable.batchNumber,
        locationId: releaseTasksTable.locationId,
        circleId: releaseTasksTable.circleId,
        circleName: circlesTable.name,
        // Only select nested fields from the joined tables, not duplicate ids
        team: {
          id: teamsTable.id,
          name: teamsTable.name,
          category: teamsTable.category,
          members: teamsTable.members,
        },
        vehicle: {
          id: vehicleTable.id,
          name: vehicleTable.name,
          vehicleNumber: vehicleTable.vehicleNumber,
        },
        // Release specific fields from batches table
        releasedDogs: batchesTable.released_dogs,
        releaseSupervisorPhoto: batchesTable.release_supervisor_photo,
        releaseDate: batchesTable.release_date,
      })
      .from(releaseTasksTable)
      .leftJoin(teamsTable, eq(releaseTasksTable.teamId, teamsTable.id))
      .leftJoin(vehicleTable, eq(releaseTasksTable.vehicleId, vehicleTable.id))
      .leftJoin(circlesTable, eq(releaseTasksTable.circleId, circlesTable.id))
      .leftJoin(batchesTable, eq(releaseTasksTable.batchId, batchesTable.id));
    return tasks.map((task) => ({
      id: task.id,
      status: task.status,
      teamId: task.teamId,
      vehicleId: task.vehicleId,
      batchId: task.batchId,
      batchNumber: task.batchNumber,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      locationId: task.locationId,
      circleId: task.circleId,
      circleName: task.circleName,
      team: task.team,
      vehicle: task.vehicle,
      releasedDogs: task.releasedDogs,
      releaseSupervisorPhoto: task.releaseSupervisorPhoto,
      releaseDate: task.releaseDate,
    }));
  }),

  // Fetch a single release task by its id, including related batch, circle, location, team and vehicle information
  getReleaseById: publicProcedure
    .input(z.string())
    .query(async ({ input: id }) => {
      const [task] = await db
        .select({
          id: releaseTasksTable.id,
          status: releaseTasksTable.status,
          teamId: releaseTasksTable.teamId,
          vehicleId: releaseTasksTable.vehicleId,
          batchId: releaseTasksTable.batchId,
          createdAt: releaseTasksTable.createdAt,
          updatedAt: releaseTasksTable.updatedAt,
          locationId: locationsTable.id,
          locationName: locationsTable.name,
          hi_name: locationsTable.hi_name,
          te_name: locationsTable.te_name,
          hi_notes: locationsTable.hi_notes,
          te_notes: locationsTable.te_notes,

          locationArea: locationsTable.area,
          locationNotes: locationsTable.notes,
          locationCoordinates: locationsTable.coordinates,
          teamId2: teamsTable.id,
          teamName: teamsTable.name,
          teamCategory: teamsTable.category,
          teamMembers: teamsTable.members,
          vehicleId2: vehicleTable.id,
          vehicleName: vehicleTable.name,
          vehicleNumber: vehicleTable.vehicleNumber,
          surgeryTaskCompleted: batchesTable.surgery_task_completed,
          totalRelease: batchesTable.totalDogs,
          dogsReceived: batchesTable.dogsReceived,
          batchReleaseRemarks: batchesTable.batch_release_remarks,
          circleId: circlesTable.id,
          circleName: circlesTable.name,
          hiCircleName: circlesTable.hiCircleName,
          teCircleName: circlesTable.teCircleName,
          circleCoordinates: circlesTable.coordinates,
          circleVolunteers: circlesTable.volunteers,
          releaseDate: batchesTable.release_date, // expose batch release_date for potential client-side use
        })
        .from(releaseTasksTable)
        .where(eq(releaseTasksTable.id, id))
        .leftJoin(batchesTable, eq(releaseTasksTable.batchId, batchesTable.id))
        .leftJoin(
          locationsTable,
          eq(releaseTasksTable.locationId, locationsTable.id),
        )
        .leftJoin(circlesTable, eq(releaseTasksTable.circleId, circlesTable.id))
        .leftJoin(teamsTable, eq(releaseTasksTable.teamId, teamsTable.id))
        .leftJoin(
          vehicleTable,
          eq(releaseTasksTable.vehicleId, vehicleTable.id),
        );

      if (!task) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Release task not found",
        });
      }

      // Fetch all circles for location (optional)
      let circles = [] as {
        circleId: string | null;
        circleName: string | null;
        hiCircleName: string | null;
        teCircleName: string | null;
        coordinates: unknown;
        volunteers: unknown;
      }[];
      if (task.locationId) {
        circles = await db
          .select({
            circleId: circlesTable.id,
            circleName: circlesTable.name,
            hiCircleName: circlesTable.hiCircleName,
            teCircleName: circlesTable.teCircleName,
            coordinates: circlesTable.coordinates,
            volunteers: circlesTable.volunteers,
          })
          .from(circlesTable)
          .where(eq(circlesTable.locationId, task.locationId));
      }

      return {
        id: task.id,
        status: task.status,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        surgeryTaskCompleted: task.surgeryTaskCompleted,
        batchId: task.batchId,
        circleId: task.circleId,
        totalRelease: task.totalRelease ?? 0,
        dogsReceived: task.dogsReceived ?? 0,
        batchReleaseRemarks: task.batchReleaseRemarks ?? null,
        location: {
          id: task.locationId,
          name: String(task.locationName),
          hi_name: task.hi_name,
          te_name: task.te_name,
          hi_notes: task.hi_notes,
          te_notes: task.te_notes,
          area: task.locationArea,
          notes: task.locationNotes,
          coordinates: task.locationCoordinates,
          circles,
        },
        circle: task.circleId
          ? {
              id: task.circleId,
              name: task.circleName,
              coordinates: task.circleCoordinates,
              volunteers:
                typeof task.circleVolunteers === "string"
                  ? JSON.parse(task.circleVolunteers)
                  : task.circleVolunteers,
            }
          : null,
        team: task.teamId2
          ? {
              id: task.teamId2,
              name: task.teamName,
              category: task.teamCategory,
              members: task.teamMembers,
            }
          : null,
        vehicle: task.vehicleId2
          ? {
              id: task.vehicleId2,
              name: task.vehicleName,
              vehicleNumber: task.vehicleNumber,
            }
          : null,
      };
    }),

  getTasksByType: publicProcedure
    .input(
      z.object({
        taskType: z.enum(["capture", "release"]),
        date: z.string(),
      }),
    )
    .query(async ({ input }) => {
      /* --- Handle release tasks from dedicated release_tasks table --- */
      if (input.taskType === "release") {
        try {
          const releaseTasks = await db
            .select({
              id: releaseTasksTable.id,
              status: releaseTasksTable.status,
              teamId: releaseTasksTable.teamId,
              vehicleId: releaseTasksTable.vehicleId,
              batchId: releaseTasksTable.batchId,
              createdAt: releaseTasksTable.createdAt,
              updatedAt: releaseTasksTable.updatedAt,
              locationId: locationsTable.id,
              locationName: locationsTable.name,
              hi_name: locationsTable.hi_name,
              te_name: locationsTable.te_name,
              hi_notes: locationsTable.hi_notes,
              te_notes: locationsTable.te_notes,

              locationArea: locationsTable.area,
              locationNotes: locationsTable.notes,
              locationCoordinates: locationsTable.coordinates,
              teamId2: teamsTable.id,
              teamName: teamsTable.name,
              teamCategory: teamsTable.category,
              teamMembers: teamsTable.members,
              vehicleId2: vehicleTable.id,
              vehicleName: vehicleTable.name,
              vehicleNumber: vehicleTable.vehicleNumber,
              totalRelease: batchesTable.totalDogs,
              dogsReceived: batchesTable.dogsReceived,
              batchReleaseRemarks: batchesTable.batch_release_remarks,
              circleId: circlesTable.id,
              circleName: circlesTable.name,
              circleHiName: circlesTable.hiCircleName,
              circleTeName: circlesTable.teCircleName,

              circleCoordinates: circlesTable.coordinates,
              circleVolunteers: circlesTable.volunteers,
              releaseDate: batchesTable.release_date, // expose batch release_date for potential client-side use
            })
            .from(releaseTasksTable)
            .where(
              sql`to_char(${batchesTable.release_date}, 'YYYY-MM-DD') = ${input.date}`,
            )
            .leftJoin(
              batchesTable,
              eq(releaseTasksTable.batchId, batchesTable.id),
            )
            .leftJoin(
              locationsTable,
              eq(releaseTasksTable.locationId, locationsTable.id),
            )
            .leftJoin(
              circlesTable,
              eq(releaseTasksTable.circleId, circlesTable.id),
            )
            .leftJoin(teamsTable, eq(releaseTasksTable.teamId, teamsTable.id))
            .leftJoin(
              vehicleTable,
              eq(releaseTasksTable.vehicleId, vehicleTable.id),
            );

          // Fetch circles for each location similar to capture tasks
          const locationsWithCircles = await Promise.all(
            releaseTasks.map(async (task) => {
              if (!task.locationId) return task;

              const circles = await db
                .select({
                  circleId: circlesTable.id,
                  circleName: circlesTable.name,
                  circleHiName: circlesTable.hiCircleName,
                  circleTeName: circlesTable.teCircleName,

                  coordinates: circlesTable.coordinates,
                  volunteers: circlesTable.volunteers,
                })
                .from(circlesTable)
                .where(eq(circlesTable.locationId, task.locationId));

              return {
                id: task.id,
                taskType: "release" as const,
                status: task.status,
                teamId: task.teamId,
                vehicleId: task.vehicleId,
                createdAt: task.createdAt,
                updatedAt: task.updatedAt,
                totalRelease: task.totalRelease ?? 0,
                dogsReceived: task.dogsReceived ?? 0,
                batchReleaseRemarks: task.batchReleaseRemarks ?? null,
                location: {
                  id: task.locationId,
                  name: String(task.locationName),
                  hi_name: task.hi_name,
                  te_name: task.te_name,
                  hi_notes: task.hi_notes,
                  te_notes: task.te_notes,

                  area: String(task.locationArea),
                  notes: task.locationNotes,
                  coordinates: task.locationCoordinates,
                  circles: circles.map((circle) => ({
                    id: circle.circleId,
                    name: String(circle.circleName),
                    hiCircleName: circle.circleHiName,
                    teCircleName: circle.circleTeName,
                    coordinates: circle.coordinates,
                    volunteers:
                      typeof circle.volunteers === "string"
                        ? JSON.parse(circle.volunteers)
                        : circle.volunteers,
                  })),
                },
                team: task.teamId2
                  ? {
                      id: task.teamId2,
                      name: String(task.teamName),
                      category: String(task.teamCategory),
                      members: task.teamMembers,
                    }
                  : undefined,
                vehicle: task.vehicleId2
                  ? {
                      id: task.vehicleId2,
                      name: String(task.vehicleName),
                      vehicleNumber: String(task.vehicleNumber),
                    }
                  : undefined,
              };
            }),
          );

          return {
            success: true,
            tasks: locationsWithCircles.map((task) => ({
              ...task,
              createdAt:
                task.createdAt?.toISOString() ?? new Date().toISOString(),
              updatedAt:
                task.updatedAt?.toISOString() ?? new Date().toISOString(),
            })),
          };
        } catch (error) {
          console.error("Error fetching release tasks:", error);
          return {
            success: false,
            error: "Failed to fetch release tasks",
          } as const;
        }
      }
      /* --- Existing capture task logic below --- */
      try {
        const tasks = await db
          .select({
            id: operationTasksTable.id,
            taskType: operationTasksTable.taskType,
            status: operationTasksTable.status,
            teamId: operationTasksTable.teamId,
            vehicleId: operationTasksTable.vehicleId,
            createdAt: operationTasksTable.createdAt,
            updatedAt: operationTasksTable.updatedAt,
            locationId: locationsTable.id,
            locationName: locationsTable.name,
            hi_name: locationsTable.hi_name,
            te_name: locationsTable.te_name,
            hi_notes: locationsTable.hi_notes,
            te_notes: locationsTable.te_notes,

            locationArea: locationsTable.area,
            locationNotes: locationsTable.notes,
            locationCoordinates: locationsTable.coordinates,
            teamId2: teamsTable.id,
            teamName: teamsTable.name,
            teamCategory: teamsTable.category,
            teamMembers: teamsTable.members,
            vehicleId2: vehicleTable.id,
            vehicleName: vehicleTable.name,
            vehicleNumber: vehicleTable.vehicleNumber,
          })
          .from(operationTasksTable)
          .leftJoin(
            locationsTable,
            eq(operationTasksTable.locationId, locationsTable.id),
          )
          .leftJoin(teamsTable, eq(operationTasksTable.teamId, teamsTable.id))
          .leftJoin(
            vehicleTable,
            eq(operationTasksTable.vehicleId, vehicleTable.id),
          )
          .where(eq(operationTasksTable.taskType, input.taskType));

        // Get circles for each location
        const locationsWithCircles = await Promise.all(
          tasks.map(async (task) => {
            if (!task.locationId) return task;

            const circles = await db
              .select({
                circleId: circlesTable.id,
                circleName: circlesTable.name,
                circleHiName: circlesTable.hiCircleName,
                circleTeName: circlesTable.teCircleName,

                coordinates: circlesTable.coordinates,
                volunteers: circlesTable.volunteers,
                taskId: operationTasksTable.id,
                taskStatus: operationTasksTable.status,
              })
              .from(circlesTable)
              .leftJoin(
                operationTasksTable,
                eq(circlesTable.id, operationTasksTable.circleId),
              )
              .where(eq(circlesTable.locationId, task.locationId));

            return {
              id: task.id,
              taskType: task.taskType,
              status: task.status,
              teamId: task.teamId,
              vehicleId: task.vehicleId,
              createdAt: task.createdAt,
              updatedAt: task.updatedAt,
              location: {
                id: task.locationId,
                name: String(task.locationName),
                hi_name: task.hi_name,
                te_name: task.te_name,
                hi_notes: task.hi_notes,
                te_notes: task.te_notes,
                area: String(task.locationArea),
                notes: task.locationNotes,
                coordinates: task.locationCoordinates,
                circles: circles.map((circle) => ({
                  id: circle.circleId,
                  name: String(circle.circleName),
                  hiCircleName: circle.circleHiName,
                  teCircleName: circle.circleTeName,
                  coordinates: circle.coordinates,
                  volunteers:
                    typeof circle.volunteers === "string"
                      ? JSON.parse(circle.volunteers)
                      : circle.volunteers,
                  operationTask: circle.taskId
                    ? {
                        id: circle.taskId,
                        status: circle.taskStatus,
                      }
                    : undefined,
                })),
              },
              team: task.teamId2
                ? {
                    id: task.teamId2,
                    name: String(task.teamName),
                    category: String(task.teamCategory),
                    members: task.teamMembers,
                  }
                : undefined,
              vehicle: task.vehicleId2
                ? {
                    id: task.vehicleId2,
                    name: String(task.vehicleName),
                    vehicleNumber: String(task.vehicleNumber),
                  }
                : undefined,
            };
          }),
        );

        return {
          success: true,
          tasks: locationsWithCircles.map((task) => ({
            ...task,
            createdAt:
              task.createdAt?.toISOString() ?? new Date().toISOString(),
            updatedAt:
              task.updatedAt?.toISOString() ?? new Date().toISOString(),
          })),
        };
      } catch (error) {
        console.error("Error fetching tasks:", error);
        return { success: false, error: "Failed to fetch tasks" };
      }
    }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        taskId: z.string(),
        status: z.enum(["pending", "ongoing", "completed"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Helper: find the calling user's team (if any)
      const getUserTeamId = async () => {
        const teams = await ctx.db.query.teamsTable.findMany();
        const userTeam = teams.find((team) =>
          team.members.some((member) => member.id === ctx.session.userId),
        );
        return userTeam?.id ?? null;
      };

      if (input.status === "completed") {
        // Task finished ⇒ make available to others
        await ctx.db
          .update(operationTasksTable)
          .set({
            status: "pending",
            teamId: null,
            updatedAt: new Date(),
          })
          .where(eq(operationTasksTable.id, input.taskId));
      } else if (input.status === "ongoing") {
        // When marking as ongoing ensure it is locked to the caller's team
        const teamId = await getUserTeamId();
        await ctx.db
          .update(operationTasksTable)
          .set({
            status: "ongoing",
            teamId: teamId,
            updatedAt: new Date(),
          })
          .where(eq(operationTasksTable.id, input.taskId));
      } else {
        // Generic update
        await ctx.db
          .update(operationTasksTable)
          .set({
            status: input.status,
            updatedAt: new Date(),
          })
          .where(eq(operationTasksTable.id, input.taskId));
      }
      return { success: true };
    }),

  // ---------------------------------------------------------------------------
  // Release-task status update (works on release_tasks table)
  // ---------------------------------------------------------------------------
  updateReleaseStatus: protectedProcedure
    .input(
      z.object({
        taskId: z.string(),
        status: z.enum(["pending", "ongoing", "completed"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const getUserTeamId = async () => {
        const teams = await ctx.db.query.teamsTable.findMany();
        const userTeam = teams.find((team) =>
          team.members.some((member) => member.id === ctx.session.userId),
        );
        return userTeam?.id ?? null;
      };

      if (input.status === "completed") {
        await ctx.db
          .update(releaseTasksTable)
          .set({
            status: "pending",
            teamId: null,
            updatedAt: new Date(),
          })
          .where(eq(releaseTasksTable.id, input.taskId));
      } else if (input.status === "ongoing") {
        const teamId = await getUserTeamId();
        await ctx.db
          .update(releaseTasksTable)
          .set({
            status: "ongoing",
            teamId: teamId,
            updatedAt: new Date(),
          })
          .where(eq(releaseTasksTable.id, input.taskId));
      } else {
        await ctx.db
          .update(releaseTasksTable)
          .set({
            status: input.status,
            updatedAt: new Date(),
          })
          .where(eq(releaseTasksTable.id, input.taskId));
      }
      return { success: true };
    }),

  getUploadURL: publicProcedure
    .input(
      z.object({
        folderName: z.string(),
        contentType: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const id = nanoid();
        const { folderName, contentType } = input;

        if (!folderName) {
          return { success: false, error: "No folder name provided" };
        }

        const S3 = new S3Client({
          region: "auto",
          endpoint: env.CLOUDFLARE_R2_ENDPOINT ?? "",
          credentials: {
            accessKeyId: env.CLOUDFLARE_R2_ACCESS_KEY_ID ?? "",
            secretAccessKey: env.CLOUDFLARE_R2_SECRET_ACCESS_KEY ?? "",
          },
        });

        const uploadUrl = await getSignedUrl(
          S3,
          new PutObjectCommand({
            Bucket: "3-0-images",
            Key: `${folderName}/${id}`,
            ContentType: contentType,
          }),
          { expiresIn: 3600 },
        );

        const fileUrl = `${env.CLOUDFLARE_R2_PUBLIC_URL}/${folderName}/${id}`;

        return {
          success: true,
          data: {
            success: true,
            uploadParams: uploadUrl,
            fileUrl,
            id,
          },
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to upload to R2 : ${error as string}`,
        };
      }
    }),

  uploadCapturedDog: protectedProcedure
    .input(
      z.object({
        operationTaskId: z.string(),
        batchId: z.string().optional(),
        dogImageUrl: z.string(),
        gender: z.string(),
        location: z.string().optional(),
        coordinates: z
          .object({
            latitude: z.number(),
            longitude: z.number(),
          })
          .optional(),
        fullAddress: z.string().optional(),
        feederName: z.string().optional(),
        feederPhoneNumber: z.string().optional(),
        dogColor: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        console.log(
          "Starting dog upload with operation task ID:",
          input.operationTaskId,
        );
        console.log("Using batch ID:", input.batchId);

        // Determine batch: prefer explicit batchId, otherwise fall back to legacy lookup
        let batch;

        if (input.batchId) {
          // New path: strict association using explicit batchId
          batch = await ctx.db.query.batchesTable.findFirst({
            where: eq(batchesTable.id, input.batchId),
          });

          if (!batch) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Batch not found for this dog upload",
            });
          }

          if (batch.operationTaskId !== input.operationTaskId) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Batch does not belong to the given operation task",
            });
          }

          if (batch.status !== "active") {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message:
                "Batch is not active. Please start a new batch before capturing dogs.",
            });
          }
        } else {
          // Legacy path: support old offline queue items that don't have batchId stored
          console.log(
            "No batchId provided, falling back to legacy active batch lookup by operationTaskId",
          );
          batch = await ctx.db.query.batchesTable.findFirst({
            where: and(
              eq(batchesTable.operationTaskId, input.operationTaskId),
              eq(batchesTable.status, "active"),
            ),
          });

          if (!batch) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message:
                "No active batch found for this operation task. Please create a batch first.",
            });
          }
        }

        console.log("Found batch for dog upload:", batch);

        // Get the operation task with its circle and location
        const operationTask = await ctx.db.query.operationTasksTable.findFirst({
          where: eq(operationTasksTable.id, input.operationTaskId),
          with: {
            circle: true,
            location: true,
          },
        });

        console.log("Found operation task:", operationTask);

        if (!operationTask) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Operation task not found",
          });
        }

        // Get the circle name either from the circle or location
        let circleName = operationTask.circle?.name;
        if (!circleName && operationTask.location) {
          // If no direct circle, try to get the first circle from the location
          const locationCircle = await ctx.db.query.circlesTable.findFirst({
            where: eq(circlesTable.locationId, operationTask.location.id),
          });
          circleName = locationCircle?.name;
        }

        if (!circleName) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "No circle found for this operation task",
          });
        }

        console.log("Using circle name:", circleName);

        // Get first four letters of circle name (or all if less than 4)
        const circlePrefix = circleName.slice(0, 4).toUpperCase();

        // Get existing dogs **in this batch** to determine the next available number
        const existingDogs = await ctx.db.query.capturedDogsTable.findMany({
          where: eq(capturedDogsTable.batchId, batch.id),
          orderBy: desc(capturedDogsTable.dog_tag_id),
        });

        console.log("Found existing dogs in batch:", existingDogs.length);

        // Extract existing numbers from dog_tag_ids to find the first available number
        const existingNumbers = new Set<number>();
        existingDogs.forEach((dog) => {
          if (dog.dog_tag_id) {
            const match = /\d+$/.exec(dog.dog_tag_id);
            if (match) {
              existingNumbers.add(parseInt(match[0], 10));
            }
          }
        });

        // Find the first available number (starting from 1)
        let nextNumber = 1;
        while (existingNumbers.has(nextNumber)) {
          nextNumber++;
        }

        console.log(
          "Existing numbers:",
          Array.from(existingNumbers).sort((a, b) => a - b),
        );
        console.log("Next available number:", nextNumber);

        // Create the dog_tag_id with padded number
        const dog_tag_id = `${circlePrefix}${nextNumber.toString().padStart(4, "0")}`;
        console.log("Generated dog_tag_id:", dog_tag_id);

        const capturedDog = await ctx.db
          .insert(capturedDogsTable)
          .values({
            operationTaskId: input.operationTaskId,
            batchId: batch.id,
            dogImageUrl: input.dogImageUrl,
            gender: input.gender,
            location: input.location,
            coordinates: input.coordinates,
            fullAddress: input.fullAddress,
            dog_tag_id: dog_tag_id,
            feederName: input.feederName,
            feederPhoneNumber: input.feederPhoneNumber,
            dogColor: input.dogColor,
          })
          .returning();

        // Update total dogs count in batch
        await ctx.db
          .update(batchesTable)
          .set({
            totalDogs: (batch.totalDogs ?? 0) + 1,
            updatedAt: new Date(),
          })
          .where(eq(batchesTable.id, batch.id));

        console.log("Successfully created captured dog:", capturedDog[0]);

        return { success: true, capturedDog: capturedDog[0] };
      } catch (error) {
        console.error("Detailed error in uploadCapturedDog:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to upload captured dog",
          cause: error,
        });
      }
    }),

  getCapturedDogs: publicProcedure
    .input(z.object({ operationTaskId: z.string() }))
    .query(async ({ ctx, input }) => {
      return await ctx.db.query.capturedDogsTable.findMany({
        where: and(
          eq(capturedDogsTable.operationTaskId, input.operationTaskId),
          // Exclude dogs that are released (either via status or releaseStatus)
          not(eq(capturedDogsTable.status, "released")),
          or(
            isNull(capturedDogsTable.releaseStatus),
            not(eq(capturedDogsTable.releaseStatus, "released")),
          ),
        ),
        orderBy: desc(capturedDogsTable.createdAt),
      });
    }),

  getCapturedDogsByBatch: publicProcedure
    .input(z.object({ batchId: z.string() }))
    .query(async ({ ctx, input }) => {
      console.log(
        "🔍 getCapturedDogsByBatch called with batchId:",
        input.batchId,
      );

      // First, let's see ALL dogs in this batch for debugging
      const allDogsInBatch = await ctx.db.query.capturedDogsTable.findMany({
        where: eq(capturedDogsTable.batchId, input.batchId),
        orderBy: desc(capturedDogsTable.createdAt),
      });

      console.log(
        "🔍 ALL dogs in batch (before filtering):",
        allDogsInBatch.length,
      );
      console.log(
        "🔍 All dogs details:",
        allDogsInBatch.map((dog) => ({
          id: dog.id.slice(0, 8),
          dogTagId: dog.dog_tag_id,
          status: dog.status,
          releaseStatus: dog.releaseStatus,
          batchId: dog.batchId?.slice(0, 8),
        })),
      );

      const dogs = await ctx.db.query.capturedDogsTable.findMany({
        where: and(
          eq(capturedDogsTable.batchId, input.batchId),
          // Exclude dogs that are released (either via status or releaseStatus)
          not(eq(capturedDogsTable.status, "released")),
          or(
            isNull(capturedDogsTable.releaseStatus),
            not(eq(capturedDogsTable.releaseStatus, "released")),
          ),
        ),
        orderBy: desc(capturedDogsTable.createdAt),
      });

      console.log("🔍 Found", dogs.length, "dogs for batch", input.batchId);
      console.log(
        "🔍 Dogs:",
        dogs.map((dog) => ({
          id: dog.id.slice(0, 8),
          dogTagId: dog.dog_tag_id,
          status: dog.status,
          releaseStatus: dog.releaseStatus,
          batchId: dog.batchId?.slice(0, 8),
        })),
      );

      return dogs;
    }),

  updateDogStatus: publicProcedure
    .input(
      z.object({
        dogIds: z.array(z.string()),
        status: z.string(),
        // Optional release fields
        releasePhoto: z.string().optional(),
        releaseDate: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const updates = input.dogIds.map((dogId) =>
        ctx.db
          .update(capturedDogsTable)
          .set({
            updatedAt: new Date(),
            ...(input.status === "released"
              ? {
                  // Do NOT overwrite the core status column; instead set the dedicated release_status column
                  releaseStatus: "released",
                  releasePhoto: input.releasePhoto,
                  releaseDate: input.releaseDate
                    ? new Date(input.releaseDate)
                    : new Date(),
                }
              : {
                  // For other statuses, update the main status column
                  status: input.status,
                }),
          })
          .where(eq(capturedDogsTable.id, dogId)),
      );

      await Promise.all(updates);

      // If dogs are being released, check if all dogs in their batches are now released
      if (input.status === "released") {
        // Get batch IDs for the released dogs
        const releasedDogs = await ctx.db
          .select({ batchId: capturedDogsTable.batchId })
          .from(capturedDogsTable)
          .where(
            and(
              inArray(capturedDogsTable.id, input.dogIds),
              isNotNull(capturedDogsTable.batchId),
            ),
          );

        // Get unique batch IDs
        const batchIds = [
          ...new Set(releasedDogs.map((dog) => dog.batchId).filter(Boolean)),
        ];

        // For each batch, check if all dogs are released
        for (const batchId of batchIds) {
          if (!batchId) continue;

          // Count total dogs in batch
          const totalDogsInBatch = await ctx.db
            .select({ count: sql<number>`count(*)` })
            .from(capturedDogsTable)
            .where(eq(capturedDogsTable.batchId, batchId));

          // Count released dogs in batch
          const releasedDogsInBatch = await ctx.db
            .select({ count: sql<number>`count(*)` })
            .from(capturedDogsTable)
            .where(
              and(
                eq(capturedDogsTable.batchId, batchId),
                eq(capturedDogsTable.releaseStatus, "released"),
              ),
            );

          const totalCount = totalDogsInBatch[0]?.count || 0;
          const releasedCount = releasedDogsInBatch[0]?.count || 0;

          // If all dogs in the batch are released, update batch status to completed
          if (totalCount > 0 && releasedCount === totalCount) {
            await ctx.db
              .update(batchesTable)
              .set({
                release_status: "completed",
                updatedAt: new Date(),
              })
              .where(eq(batchesTable.id, batchId));

            console.log(
              `Batch ${batchId} marked as completed - all ${totalCount} dogs released`,
            );
          }
        }
      }

      return { success: true };
    }),

  getDogs: publicProcedure.query(async () => {
    try {
      const dogs = await db
        .select()
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

      return dogs;
    } catch (error) {
      console.error("Error fetching captured dogs:", error);
      return [];
    }
  }),

  getReleasedDogs: publicProcedure.query(async () => {
    try {
      const dogs = await db
        .select()
        .from(capturedDogsTable)
        .where(eq(capturedDogsTable.releaseStatus, "released"))
        .orderBy(desc(capturedDogsTable.releaseDate));

      return dogs;
    } catch (error) {
      console.error("Error fetching released dogs:", error);
      return [];
    }
  }),

  getDogsByBatchId: publicProcedure
    .input(z.object({ batchId: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        console.log("Fetching dogs for batch ID:", input.batchId);

        const dogs = await ctx.db
          .select({
            id: capturedDogsTable.id,
            dogImageUrl: capturedDogsTable.dogImageUrl,
            gender: capturedDogsTable.gender,
            location: capturedDogsTable.location,
            coordinates: capturedDogsTable.coordinates,
            fullAddress: capturedDogsTable.fullAddress,
            status: capturedDogsTable.status,
            releaseStatus: capturedDogsTable.releaseStatus,
            surgeryStatus: capturedDogsTable.surgeryStatus,
            surgeryReason: capturedDogsTable.surgeryReason,
            surgery_remarks: capturedDogsTable.surgery_remarks,
            createdAt: capturedDogsTable.createdAt,
            updatedAt: capturedDogsTable.updatedAt,
            dog_tag_id: capturedDogsTable.dog_tag_id,
            feederName: capturedDogsTable.feederName,
            feederPhoneNumber: capturedDogsTable.feederPhoneNumber,
            dogColor: capturedDogsTable.dogColor,
            cageNo: capturedDogsTable.cageNo,
            weight: capturedDogsTable.weight,
            block: capturedDogsTable.block,
          })
          .from(capturedDogsTable)
          .where(eq(capturedDogsTable.batchId, input.batchId))
          .orderBy(desc(capturedDogsTable.createdAt));

        console.log("Found dogs:", dogs.length);
        return dogs;
      } catch (error) {
        console.error("Error fetching dogs by batch ID:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch dogs",
          cause: error,
        });
      }
    }),

  deleteSurgicalTask: publicProcedure
    .input(z.object({ taskId: z.string() }))
    .mutation(async ({ input }) => {
      try {
        await db
          .delete(surgicalTasksTable)
          .where(eq(surgicalTasksTable.id, input.taskId));

        return { success: true };
      } catch (error) {
        console.error("Error deleting surgical task:", error);
        return { success: false, error: "Failed to delete surgical task" };
      }
    }),

  deleteOperationTask: publicProcedure
    .input(z.object({ taskId: z.string() }))
    .mutation(async ({ input }) => {
      try {
        await db
          .delete(capturedDogsTable)
          .where(eq(capturedDogsTable.operationTaskId, input.taskId));

        await db
          .delete(operationTasksTable)
          .where(eq(operationTasksTable.id, input.taskId));

        return { success: true };
      } catch (error) {
        console.error("Error deleting operation task:", error);
        return { success: false, error: "Failed to delete operation task" };
      }
    }),

  createBatch: protectedProcedure
    .input(
      z.object({
        operationTaskId: z.string(),
        teamId: z.string().optional(),
        vehicleId: z.string().optional(),
        userId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        console.log("Creating batch with input:", input);
        console.log("Current user:", ctx.session.userId);
        // Get the operation task
        const operationTask = await ctx.db.query.operationTasksTable.findFirst({
          where: eq(operationTasksTable.id, input.operationTaskId),
          with: {
            team: true,
            vehicle: true,
          },
        });

        console.log("Found operation task:", operationTask);

        if (!operationTask) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Operation task not found",
          });
        }

        // Get team ID
        let teamId = input.teamId;
        if (!teamId) {
          const teams = await ctx.db.query.teamsTable.findMany();
          console.log("All teams:", teams);

          const userTeam = teams.find((team) =>
            team.members.some((member) => member.id === ctx.session.userId),
          );
          console.log("Found user team:", userTeam);

          if (!userTeam) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "User's team not found",
            });
          }
          teamId = userTeam.id;
        }

        // Reuse existing active batch for this operation task **for this team**, if any.
        // This prevents creating multiple active batches for the same team when they
        // tap "Continue capturing" multiple times or across days without ending
        // the previous batch, while still allowing *other* teams to have their
        // own independent active batches for the same operation task.
        const existingActiveBatch = await ctx.db.query.batchesTable.findFirst({
          where: and(
            eq(batchesTable.operationTaskId, input.operationTaskId),
            eq(batchesTable.status, "active"),
            eq(batchesTable.teamId, teamId),
          ),
        });

        if (existingActiveBatch) {
          console.log(
            "Existing active batch found for operation task and team, reusing:",
            existingActiveBatch,
          );
          return {
            success: true,
            batch: existingActiveBatch,
          };
        }

        // Get vehicle ID
        let vehicleId = input.vehicleId;
        if (!vehicleId) {
          const team = await ctx.db.query.teamsTable.findFirst({
            where: eq(teamsTable.id, teamId),
          });
          console.log("Team for vehicle:", team);

          if (team?.vehicleId) {
            vehicleId = team.vehicleId;
          } else {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "No vehicle found for team",
            });
          }
        }

        // Get vehicle details
        const vehicle = await ctx.db.query.vehicleTable.findFirst({
          where: eq(vehicleTable.id, vehicleId),
        });
        console.log("Found vehicle:", vehicle);

        if (!vehicle?.vehicleNumber) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Vehicle not found or missing vehicle number",
          });
        }

        // Get team details
        const team = await ctx.db.query.teamsTable.findFirst({
          where: eq(teamsTable.id, teamId),
        });
        console.log("Team details:", team);

        if (!team) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Team not found",
          });
        }

        const driver = team.members.find((member) => member.role === "driver");
        console.log("Found driver:", driver);

        if (!driver) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Driver not found in team",
          });
        }

        // Generate batch number
        const vehicleLastFourDigits = vehicle.vehicleNumber
          .replace(/\D/g, "")
          .slice(-4);
        const currentDate = new Date();
        const formattedDate = `${currentDate.getDate().toString().padStart(2, "0")}${(
          currentDate.getMonth() + 1
        )
          .toString()
          .padStart(2, "0")}${currentDate.getFullYear().toString().slice(-2)}`;

        // Prefer the logged-in team member's name (matched by ctx.session.userId),
        // then fall back to the driver's name.
        const currentTeamMember = team.members.find(
          (member) => member.id === ctx.session.userId,
        );

        const userNameForBatch = (
          currentTeamMember?.name ?? driver.name
        ).replace(/\s+/g, "");
        const batchNumber = `${vehicleLastFourDigits}${userNameForBatch}_${formattedDate}`;
        console.log("Generated batch number:", batchNumber);

        // Create batch
        const batch = await ctx.db
          .insert(batchesTable)
          .values({
            batchNumber,
            operationTaskId: input.operationTaskId,
            teamId,
            vehicleId,
            userId: input.userId ?? ctx.session.userId,
            status: "active",
            startTime: new Date(),
          })
          .returning();

        console.log("Created batch:", batch);

        if (!batch[0]) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create batch",
          });
        }

        return {
          success: true,
          batch: batch[0],
        };
      } catch (error) {
        console.error("Detailed error in createBatch:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error ? error.message : "Failed to create batch",
          cause: error,
        });
      }
    }),

  updateBatchEndTime: protectedProcedure
    .input(
      z.object({
        batchId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const updatedBatch = await ctx.db
          .update(batchesTable)
          .set({
            endTime: new Date(),
            status: "completed",
            updatedAt: new Date(),
          })
          .where(eq(batchesTable.id, input.batchId))
          .returning();

        const batch = updatedBatch[0];

        // If this batch is linked to an operation task, update that task's status
        // based on whether any other active batches remain for the same task.
        if (batch?.operationTaskId) {
          const remainingActive = await ctx.db.query.batchesTable.findFirst({
            where: and(
              eq(batchesTable.operationTaskId, batch.operationTaskId),
              eq(batchesTable.status, "active"),
            ),
          });

          await ctx.db
            .update(operationTasksTable)
            .set({
              // If no active batches remain, reset to pending so the task
              // appears as a fresh "Start Task" again. If some team still has
              // an active batch, keep it as ongoing.
              status: remainingActive ? "ongoing" : "pending",
              // Clear teamId so the task is not locked to a single team.
              teamId: null,
              updatedAt: new Date(),
            })
            .where(eq(operationTasksTable.id, batch.operationTaskId));
        }

        return { success: true, batch };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update batch end time",
        });
      }
    }),

  // ---- NEW: release end task mutation ----
  updateReleaseSupervisorDetails: protectedProcedure
    .input(
      z.object({
        batchId: z.string(),
        supervisorName: z.string(),
        supervisorPhotoUrl: z.string(),
        supervisorSignatureUrl: z.string(),
        releasedDogs: z.number().optional(), // ignored, computed server-side
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const {
          batchId,
          supervisorName,
          supervisorPhotoUrl,
          supervisorSignatureUrl,
        } = input;

        // Count dogs released in this batch
        const countRows = await ctx.db
          .select({ count: sql<number>`COUNT(*)` })
          .from(capturedDogsTable)
          .where(
            and(
              eq(capturedDogsTable.batchId, batchId),
              eq(capturedDogsTable.releaseStatus, "released"),
            ),
          );
        const releasedCount = Number(countRows[0]?.count) || 0;

        // Update batch
        const updatedBatch = await ctx.db
          .update(batchesTable)
          .set({
            release_supervisor_name: supervisorName,
            release_supervisor_photo: supervisorPhotoUrl,
            release_supervisor_signature: supervisorSignatureUrl,
            released_dogs: releasedCount,
            release_status: "completed",
            release_date: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(batchesTable.id, batchId))
          .returning();

        if (!updatedBatch.length) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Batch not found",
          });
        }

        const batch = updatedBatch[0]!;
        if (batch.operationTaskId) {
          await ctx.db
            .update(operationTasksTable)
            .set({ status: "pending", teamId: null, updatedAt: new Date() })
            .where(eq(operationTasksTable.id, batch.operationTaskId));
        }

        // Mark related release tasks as completed
        await ctx.db
          .update(releaseTasksTable)
          .set({ status: "completed", updatedAt: new Date() })
          .where(eq(releaseTasksTable.batchId, input.batchId));

        return { success: true, batch };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update release supervisor details",
          cause: error,
        });
      }
    }),

  getReleasedDogsCount: protectedProcedure
    .input(z.object({ batchId: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const countRows = await ctx.db
          .select({ count: sql<number>`COUNT(*)` })
          .from(capturedDogsTable)
          .where(
            and(
              eq(capturedDogsTable.batchId, input.batchId),
              eq(capturedDogsTable.releaseStatus, "released"),
            ),
          );
        return {
          success: true,
          count: Number(countRows[0]?.count) || 0,
        } as const;
      } catch (error) {
        return {
          success: false,
          error: "Failed to fetch released dogs count",
        } as const;
      }
    }),

  updateBatchSupervisorDetails: protectedProcedure
    .input(
      z.object({
        batchId: z.string(),
        supervisorName: z.string(),
        supervisorPhotoUrl: z.string(),
        supervisorSignatureUrl: z.string(),
        dogsReceived: z.number(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Update the batch with all supervisor details and set status to completed
        const updatedBatch = await ctx.db
          .update(batchesTable)
          .set({
            capture_supervisor_name: input.supervisorName,
            capture_supervisor_photo: input.supervisorPhotoUrl,
            capture_supervisor_signature: input.supervisorSignatureUrl,
            dogsReceived: input.dogsReceived,
            status: "completed",
            endTime: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(batchesTable.id, input.batchId))
          .returning();

        if (!updatedBatch.length) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Batch not found",
          });
        }

        const batch = updatedBatch[0]!;

        // If this batch is linked to an operation task, update that task's
        // status based on whether any other active batches remain for the
        // same task.
        if (batch.operationTaskId) {
          const remainingActive = await ctx.db.query.batchesTable.findFirst({
            where: and(
              eq(batchesTable.operationTaskId, batch.operationTaskId),
              eq(batchesTable.status, "active"),
            ),
          });

          const updateResult = await ctx.db
            .update(operationTasksTable)
            .set({
              // If no active batches remain, reset to pending so the task
              // appears as a fresh "Start Task" again. If some team still has
              // an active batch, keep it as ongoing.
              status: remainingActive ? "ongoing" : "pending",
              teamId: null,
              updatedAt: new Date(),
            })
            .where(eq(operationTasksTable.id, batch.operationTaskId));

          console.log("Operation task update result:", updateResult);
        }

        return { success: true, batch };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update supervisor details",
          cause: error,
        });
      }
    }),

  getBatchDetails: protectedProcedure
    .input(z.object({ batchId: z.string() }))
    .query(
      async ({
        ctx,
        input,
      }): Promise<{
        id: string;
        totalDogs: number;
        endTime?: string;
        circleName: string;
        location?: {
          name: string;
          hi_name?: string;
          te_name?: string;
        };
        circle?: {
          name: string;
          hiCircleName?: string;
          teCircleName?: string;
        };
      }> => {
        try {
          const batchRows = await ctx.db
            .select({
              id: batchesTable.id,
              totalDogs: batchesTable.totalDogs,
              endTime: batchesTable.endTime,
              operationTaskId: batchesTable.operationTaskId,
            })
            .from(batchesTable)
            .where(eq(batchesTable.id, input.batchId));
          const batch = batchRows[0];

          if (!batch) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Batch not found",
            });
          }

          // Get operation task with circle and location details
          let opRow:
            | { circleName?: string; locationName?: string }
            | undefined = undefined;
          let opRows: any[] = [];
          if (batch.operationTaskId) {
            opRows = await ctx.db
              .select({
                circleName: circlesTable.name,
                circleHiName: circlesTable.hiCircleName,
                circleTeName: circlesTable.teCircleName,

                locationName: locationsTable.name,
                hi_name: locationsTable.hi_name,
                te_name: locationsTable.te_name,
                hi_notes: locationsTable.hi_notes,
                te_notes: locationsTable.te_notes,
              })
              .from(operationTasksTable)
              .leftJoin(
                circlesTable,
                eq(operationTasksTable.circleId, circlesTable.id),
              )
              .leftJoin(
                locationsTable,
                eq(circlesTable.locationId, locationsTable.id),
              )
              .where(eq(operationTasksTable.id, batch.operationTaskId));
            const op = opRows[0];
            opRow = op
              ? {
                  circleName: op.circleName ?? undefined,
                  locationName: op.locationName ?? undefined,
                }
              : undefined;
          }

          return {
            id: batch.id,
            totalDogs: Number(batch.totalDogs) || 0,
            endTime: batch.endTime ? batch.endTime.toISOString() : undefined,
            circleName: String(
              opRow?.circleName ?? opRow?.locationName ?? "Unknown Location",
            ),
            location: opRows[0]
              ? {
                  name: opRows[0].locationName ?? "Unknown Location",
                  hi_name: opRows[0].hi_name ?? undefined,
                  te_name: opRows[0].te_name ?? undefined,
                }
              : undefined,
            circle: opRows[0]
              ? {
                  name: opRows[0].circleName ?? "Unknown Circle",
                  hiCircleName: opRows[0].circleHiName ?? undefined,
                  teCircleName: opRows[0].circleTeName ?? undefined,
                }
              : undefined,
          };
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to fetch batch details",
          });
        }
      },
    ),

  getCompletedReleaseTasks: protectedProcedure
    .input(
      z.object({
        teamId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        const releaseTasks = await ctx.db
          .select({
            id: releaseTasksTable.id,
            batchId: releaseTasksTable.batchId,
            batchNumber: releaseTasksTable.batchNumber,
            status: releaseTasksTable.status,
            teamId: releaseTasksTable.teamId,
            releasedDogs: batchesTable.released_dogs,
            dogsReceived: batchesTable.dogsReceived,
            team: {
              id: teamsTable.id,
              name: teamsTable.name,
            },
            vehicle: {
              id: vehicleTable.id,
              name: vehicleTable.name,
              vehicleNumber: vehicleTable.vehicleNumber,
            },
            location: {
              id: locationsTable.id,
              name: locationsTable.name,
              notes: locationsTable.notes,
              coordinates: locationsTable.coordinates,
            },
            circle: {
              id: circlesTable.id,
              name: circlesTable.name,
              coordinates: circlesTable.coordinates,
            },
            updatedAt: releaseTasksTable.updatedAt,
            createdAt: releaseTasksTable.createdAt,
          })
          .from(releaseTasksTable)
          .leftJoin(teamsTable, eq(releaseTasksTable.teamId, teamsTable.id))
          .leftJoin(
            vehicleTable,
            eq(releaseTasksTable.vehicleId, vehicleTable.id),
          )
          .leftJoin(
            locationsTable,
            eq(releaseTasksTable.locationId, locationsTable.id),
          )
          .leftJoin(
            circlesTable,
            eq(releaseTasksTable.circleId, circlesTable.id),
          )
          .leftJoin(
            batchesTable,
            eq(releaseTasksTable.batchId, batchesTable.id),
          )
          .where(
            and(
              eq(releaseTasksTable.status, "completed"),
              eq(releaseTasksTable.teamId, input.teamId),
            ),
          )
          .orderBy(desc(releaseTasksTable.updatedAt));

        return {
          success: true,
          tasks: releaseTasks.map((task) => ({
            id: task.id,
            batchId: task.batchId,
            batchNumber: task.batchNumber,
            status: task.status,
            teamId: task.teamId,
            releasedDogs: task.releasedDogs || 0,
            dogsReceived: task.dogsReceived || 0,
            team: task.team,
            vehicle: task.vehicle,
            location: task.location,
            circle: task.circle,
            updatedAt:
              task.updatedAt?.toISOString() || new Date().toISOString(),
            createdAt:
              task.createdAt?.toISOString() || new Date().toISOString(),
          })),
        };
      } catch (error) {
        console.error("Error fetching completed release tasks:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch completed release tasks",
        });
      }
    }),

  getCompletedBatches: protectedProcedure
    .input(
      z.object({
        teamId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        const completedBatches = await ctx.db
          .select({
            id: batchesTable.id,
            batchNumber: batchesTable.batchNumber,
            status: batchesTable.status,
            endTime: batchesTable.endTime,
            totalDogs: batchesTable.totalDogs,
            teamId: batchesTable.teamId,
            operationTaskId: operationTasksTable.id,
            circleName: circlesTable.name,
            circleHiName: circlesTable.hiCircleName,
            circleTeName: circlesTable.teCircleName,

            circleCoordinates: circlesTable.coordinates,
            locationName: locationsTable.name,
            hi_name: locationsTable.hi_name,
            te_name: locationsTable.te_name,
            hi_notes: locationsTable.hi_notes,
            te_notes: locationsTable.te_notes,

            locationNotes: locationsTable.notes,
            teamName: teamsTable.name,
          })
          .from(batchesTable)
          .leftJoin(
            operationTasksTable,
            eq(batchesTable.operationTaskId, operationTasksTable.id),
          )
          .leftJoin(
            circlesTable,
            eq(operationTasksTable.circleId, circlesTable.id),
          )
          .leftJoin(
            locationsTable,
            eq(circlesTable.locationId, locationsTable.id),
          )
          .leftJoin(teamsTable, eq(batchesTable.teamId, teamsTable.id))
          .where(
            and(
              eq(batchesTable.status, "completed"),
              eq(batchesTable.teamId, input.teamId),
            ),
          )
          .orderBy(desc(batchesTable.endTime));

        return {
          success: true,
          batches: completedBatches.map((batch) => ({
            id: batch.id,
            batchNumber: batch.batchNumber,
            status: batch.status,
            endTime: batch.endTime,
            totalDogs: Number(batch.totalDogs) || 0,
            teamId: batch.teamId,
            operationTask: {
              id: batch.operationTaskId,
              circle: {
                name: batch.circleName,
                coordinates: batch.circleCoordinates,
                location: {
                  name: batch.locationName,
                  notes: batch.locationNotes,
                },
              },
            },
            team: {
              name: batch.teamName,
            },
            displayName: `${batch.batchNumber} - ${batch.circleName ?? "Unknown Circle"}`,
            locationNotes: batch.locationNotes ?? "",
            coordinates: batch.circleCoordinates ?? null,
          })),
        };
      } catch (error) {
        console.error("Error fetching completed batches:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch completed batches",
        });
      }
    }),

  deleteCapturedDog: protectedProcedure
    .input(z.object({ dogId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        console.log("Deleting captured dog with ID:", input.dogId);

        // First, get the dog to check batch info
        const dogToDelete = await ctx.db.query.capturedDogsTable.findFirst({
          where: eq(capturedDogsTable.id, input.dogId),
        });

        if (!dogToDelete) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Dog not found",
          });
        }

        console.log("Found dog to delete:", dogToDelete);

        // Delete the dog from database
        await ctx.db
          .delete(capturedDogsTable)
          .where(eq(capturedDogsTable.id, input.dogId));

        // Update batch total dogs count if the dog was part of a batch
        if (dogToDelete.batchId) {
          const batch = await ctx.db.query.batchesTable.findFirst({
            where: eq(batchesTable.id, dogToDelete.batchId),
          });

          if (batch?.totalDogs && batch.totalDogs > 0) {
            await ctx.db
              .update(batchesTable)
              .set({
                totalDogs: batch.totalDogs - 1,
                updatedAt: new Date(),
              })
              .where(eq(batchesTable.id, dogToDelete.batchId));

            console.log(
              `Updated batch ${dogToDelete.batchId} total dogs count: ${batch.totalDogs} -> ${batch.totalDogs - 1}`,
            );
          }
        }

        console.log("Successfully deleted captured dog:", input.dogId);
        return { success: true };
      } catch (error) {
        console.error("Error deleting captured dog:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete captured dog",
        });
      }
    }),
});
