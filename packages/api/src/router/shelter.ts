import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import {
  batchesTable,
  capturedDogsTable,
  circlesTable,
  locationsTable,
  operationTasksTable,
  teamsTable,
} from "@acme/db/schema";

import { createTRPCRouter, protectedProcedure } from "../trpc";

export const shelterRouter = createTRPCRouter({
  // Get all batches for shelter
  getAllBatches: protectedProcedure.query(async ({ ctx }) => {
    try {
      const result = await ctx.db
        .select({
          id: batchesTable.id,
          batchNumber: batchesTable.batchNumber,
          status: batchesTable.status,
          startTime: batchesTable.startTime,
          endTime: batchesTable.endTime,
          totalDogs: batchesTable.totalDogs,
          shelter_task_status: batchesTable.shelter_task_status,
          teamId: teamsTable.id,
          teamName: teamsTable.name,
          circleId: circlesTable.id,
          circleName: circlesTable.name,
          locationName: locationsTable.name,
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
        .where(
          and(
            eq(batchesTable.status, "completed"),
            eq(batchesTable.shelter_task_status, "pending"),
          ),
        )
        .orderBy(desc(batchesTable.createdAt));

      return result.map((row) => ({
        id: row.id,
        batchNumber: row.batchNumber,
        status: row.status,
        shelter_task_status: row.shelter_task_status,
        startTime: row.startTime?.toISOString(),
        endTime: row.endTime?.toISOString(),
        totalDogs: Number(row.totalDogs ?? 0),
        team: row.teamId
          ? {
              id: row.teamId,
              name: row.teamName,
            }
          : undefined,
        operationTask: {
          circle: row.circleId
            ? {
                name: row.circleName,
                location: {
                  name: row.locationName,
                },
              }
            : undefined,
        },
      }));
    } catch (error) {
      console.error("Error fetching batches:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch batches",
      });
    }
  }),

  // Get batch details by ID
  getBatchDetails: protectedProcedure
    .input(z.object({ batchId: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const batch = await ctx.db
          .select({
            id: batchesTable.id,
            batchNumber: batchesTable.batchNumber,
            status: batchesTable.status,
            startTime: batchesTable.startTime,
            endTime: batchesTable.endTime,
            totalDogs: batchesTable.totalDogs,
            team: {
              id: teamsTable.id,
              name: teamsTable.name,
            },
            operationTaskId: operationTasksTable.id,
            circleName: circlesTable.name,
            locationName: locationsTable.name,
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
          .where(eq(batchesTable.id, input.batchId))
          .then((rows) => rows[0]);

        if (!batch) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Batch not found",
          });
        }

        return {
          ...batch,
          status: batch.status ?? "pending",
          totalDogs: Number(batch.totalDogs ?? 0),
          circleName: batch.circleName ?? batch.locationName ?? "Unknown Location",
        };
      } catch (error) {
        console.error("Error fetching batch details:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch batch details",
        });
      }
    }),

  // Get dogs in a batch
  getDogsByBatchId: protectedProcedure
    .input(z.object({ batchId: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const dogs = await ctx.db
          .select({
            id: capturedDogsTable.id,
            dogImageUrl: capturedDogsTable.dogImageUrl,
            gender: capturedDogsTable.gender,
            location: capturedDogsTable.location,
            coordinates: capturedDogsTable.coordinates,
            fullAddress: capturedDogsTable.fullAddress,
            status: capturedDogsTable.status,
            dog_tag_id: capturedDogsTable.dog_tag_id,
            weight: capturedDogsTable.weight,
            block: capturedDogsTable.block,
            cageNo: capturedDogsTable.cageNo,
            dogColor: capturedDogsTable.dogColor,
            createdAt: capturedDogsTable.createdAt,
            updatedAt: capturedDogsTable.updatedAt,
          })
          .from(capturedDogsTable)
          .where(eq(capturedDogsTable.batchId, input.batchId))
          .orderBy(desc(capturedDogsTable.createdAt));

        return dogs.map((dog) => ({
          ...dog,
          coordinates: dog.coordinates as {
            latitude: number;
            longitude: number;
          } | null,
          weight: dog.weight ? Number(dog.weight) : null,
        }));
      } catch (error) {
        console.error("Error fetching dogs:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch dogs",
        });
      }
    }),

  // Update dog status and details
  updateDogStatus: protectedProcedure
    .input(
      z.object({
        dogId: z.string(),
        status: z.enum(["captured", "missing"]),
        weight: z.number().optional(),
        block: z.string().optional(),
        cageNo: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        console.log("Updating dog status:", input);

        const updateData = {
          status: input.status,
          ...(input.status === "captured" && {
            weight: input.weight ? input.weight.toString() : null,
            block: input.block,
            cageNo: input.cageNo,
          }),
          updatedAt: new Date(),
        };

        const updatedDog = await ctx.db
          .update(capturedDogsTable)
          .set(updateData)
          .where(eq(capturedDogsTable.id, input.dogId))
          .returning();

        if (!updatedDog.length) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Dog not found",
          });
        }

        return {
          success: true,
          dog: {
            ...updatedDog[0],
            weight: updatedDog[0]?.weight
              ? Number(updatedDog[0]?.weight)
              : null,
          },
        };
      } catch (error) {
        console.error("Error updating dog status:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update dog status",
        });
      }
    }),

  // End batch with supervisor details
  endBatchWithSupervisor: protectedProcedure
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
        const updatedBatch = await ctx.db
          .update(batchesTable)
          .set({
            shelter_task_status: "completed",
            ward_supervisor_name: input.supervisorName,
            ward_supervisor_photo: input.supervisorPhotoUrl,
            ward_supervisor_signature: input.supervisorSignatureUrl,
            dogsReceived: input.dogsReceived,
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

        return {
          success: true,
          batch: {
            ...updatedBatch[0],
            totalDogs: Number(updatedBatch[0]?.totalDogs ?? 0),
            endTime: updatedBatch[0]?.endTime?.toISOString(),
          },
        };
      } catch (error) {
        console.error("Error ending batch:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to end batch",
        });
      }
    }),

  // End batch time
  endBatchTime: protectedProcedure
    .input(z.object({ batchId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const updatedBatch = await ctx.db
          .update(batchesTable)
          .set({
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

        return {
          success: true,
          batch: {
            ...updatedBatch[0],
            endTime: updatedBatch[0]?.endTime?.toISOString(),
          },
        };
      } catch (error) {
        console.error("Error updating batch end time:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update batch end time",
        });
      }
    }),

  // Update supervisor details
  updateSupervisorDetails: protectedProcedure
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
        console.log("Updating supervisor details:", input);

        // First update the batch with supervisor details and mark as completed
        const updatedBatch = await ctx.db
          .update(batchesTable)
          .set({
            ward_supervisor_name: input.supervisorName,
            ward_supervisor_photo: input.supervisorPhotoUrl,
            ward_supervisor_signature: input.supervisorSignatureUrl,
            dogsReceived: input.dogsReceived,
            shelter_task_status: "completed",
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

        // Verify the update was successful
        const verifyUpdate = await ctx.db
          .select({ shelter_task_status: batchesTable.shelter_task_status })
          .from(batchesTable)
          .where(eq(batchesTable.id, input.batchId))
          .then((rows) => rows[0]);

        if (verifyUpdate?.shelter_task_status !== "completed") {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to update shelter task status",
          });
        }

        return {
          success: true,
          batch: updatedBatch[0],
        };
      } catch (error) {
        console.error("Error updating supervisor details:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update supervisor details",
        });
      }
    }),

  // Complete shelter task
  completeShelterTask: protectedProcedure
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
            shelter_task_status: "completed",
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

        return {
          success: true,
          batch: updatedBatch[0],
        };
      } catch (error) {
        console.error("Error completing shelter task:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to complete shelter task",
        });
      }
    }),
});
