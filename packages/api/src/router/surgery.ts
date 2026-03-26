import { TRPCError } from "@trpc/server";
import { and, desc, eq, isNull, not, or } from "drizzle-orm";
import { z } from "zod";

import {
  batchesTable,
  capturedDogsTable,
  teamsTable,
  vehicleTable,
  releaseTasksTable,
} from "@acme/db/schema";

import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";

// Helper to format dates consistently in IST (Asia/Kolkata)
const formatDateToIST = (date: Date | null | undefined) =>
  date
    ? date.toLocaleString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: "Asia/Kolkata",
      })
    : undefined;

export const surgeryRouter = createTRPCRouter({
  getAllBatches: publicProcedure.query(async ({ ctx }) => {
    try {
      const batches = await ctx.db
        .select({
          id: batchesTable.id,
          batchNumber: batchesTable.batchNumber,
          totalDogs: batchesTable.totalDogs,
          createdAt: batchesTable.createdAt,
          status: batchesTable.status,
          surgical_task_status: batchesTable.surgical_task_status,
        })
        .from(batchesTable)
        .where(
          and(
            eq(batchesTable.status, "completed"),
            isNull(batchesTable.surgical_task_status),
          ),
        )
        .orderBy(desc(batchesTable.createdAt));

      return batches.map((batch) => ({
        id: batch.id,
        batchId: batch.batchNumber,
        totalDogs: Number(batch.totalDogs) || 0,
        dateTime: formatDateToIST(batch.createdAt),
      }));
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch batches",
        cause: error,
      });
    }
  }),

  getCompletedSurgeries: publicProcedure.query(async ({ ctx }) => {
    try {
      const batches = await ctx.db
        .select({
          id: batchesTable.id,
          batchNumber: batchesTable.batchNumber,
          dogsReceived: batchesTable.dogsReceived,
          createdAt: batchesTable.createdAt,
          status: batchesTable.status,
          surgical_task_status: batchesTable.surgical_task_status,
          surgery_task_completed: batchesTable.surgery_task_completed,
          release_status: batchesTable.release_status,
        })
        .from(batchesTable)
        .where(
          and(
            eq(batchesTable.status, "completed"),
            eq(batchesTable.surgical_task_status, "completed"),
            // Only include batches where release_status is pending (null or 'pending')
            // Exclude batches that are 'due' (scheduled) or 'completed' (already released)
            or(
              isNull(batchesTable.release_status),
              eq(batchesTable.release_status, 'pending')
            )
          ),
        )
        .orderBy(desc(batchesTable.createdAt));

      if (!batches.length) {
        return [];
      }

      return batches.map((batch) => {
        if (!batch.batchNumber) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Invalid batch number",
          });
        }

        const completionDate = batch.surgery_task_completed || batch.createdAt;
        if (!completionDate) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Invalid date for batch",
          });
        }

        return {
          id: batch.id,
          batchId: batch.batchNumber,
          totalDogs: Number(batch.dogsReceived) || 0,
          dateTime: formatDateToIST(completionDate),
        };
      });
    } catch (error) {
      console.error("Error in getCompletedSurgeries:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch completed surgeries",
        cause: error,
      });
    }
  }),

  getBatchDogs: publicProcedure
    .input(
      z.object({
        batchId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        // Accept either primary UUID or batch number from the client
        const batch = await ctx.db
          .select({ id: batchesTable.id })
          .from(batchesTable)
          .where(
            or(
              eq(batchesTable.id, input.batchId), // UUID passed from client
              eq(batchesTable.batchNumber, input.batchId), // fallback to batch number
            ),
          )
          .limit(1);

        if (!batch.length) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Batch not found",
          });
        }

        const batchUuid = batch[0]?.id;
        if (!batchUuid) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Invalid batch ID",
          });
        }

        const dogs = await ctx.db
          .select({
            id: capturedDogsTable.id,
            dog_tag_id: capturedDogsTable.dog_tag_id,
            gender: capturedDogsTable.gender,
            surgeryStatus: capturedDogsTable.surgeryStatus,
            surgeryReason: capturedDogsTable.surgeryReason,
            surgery_remarks: capturedDogsTable.surgery_remarks,
            dogImageUrl: capturedDogsTable.dogImageUrl,
            batchId: capturedDogsTable.batchId,
            status: capturedDogsTable.status,
          })
          .from(capturedDogsTable)
          .where(
            and(
              and(
                eq(capturedDogsTable.batchId, batchUuid),
                eq(capturedDogsTable.status, "captured"),
              ),
              not(eq(capturedDogsTable.status, "missing")),
            ),
          )
          .orderBy(desc(capturedDogsTable.createdAt));

        return dogs.map((dog) => ({
          id: dog.id,
          dog_tag_id: dog.dog_tag_id,
          gender: dog.gender,
          surgeryStatus: dog.surgeryStatus,
          surgeryReason: dog.surgeryReason,
          surgery_remarks: dog.surgery_remarks,
          dogImageUrl: dog.dogImageUrl,
          batchId: dog.batchId,
          status: dog.status,
        }));
      } catch (error) {
        console.error("Error in getBatchDogs:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch dogs for batch",
          cause: error,
        });
      }
    }),

  updateDogSurgeryStatus: publicProcedure
    .input(
      z.object({
        dogId: z.string(),
        surgeryStatus: z.enum(["yes", "no"]),
        surgeryReason: z.string().optional(),
        surgery_remarks: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // First update the dog's status
        const updatedDog = await ctx.db
          .update(capturedDogsTable)
          .set({
            surgeryStatus: input.surgeryStatus,
            surgeryReason: input.surgeryReason,
            surgery_remarks: input.surgery_remarks,
            updatedAt: new Date(),
          })
          .where(eq(capturedDogsTable.id, input.dogId))
          .returning();

        if (!updatedDog.length) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Dog not found",
          });
        }

        const dog = updatedDog[0];
        if (!dog?.batchId) {
          return { success: true, dog };
        }

        // Check if all non-missing dogs in the batch have their surgery status updated
        const incompleteDogs = await ctx.db
          .select({
            id: capturedDogsTable.id,
          })
          .from(capturedDogsTable)
          .where(
            and(
              eq(capturedDogsTable.batchId, dog.batchId),
              not(eq(capturedDogsTable.status, "missing")),
              isNull(capturedDogsTable.surgeryStatus),
            ),
          );

        // If no incomplete dogs found, update the batch status
        if (incompleteDogs.length === 0) {
          await ctx.db
            .update(batchesTable)
            .set({
              surgical_task_status: "completed",
              surgery_task_completed: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(batchesTable.id, dog.batchId));
        }

        return { success: true, dog };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update dog surgery status",
          cause: error,
        });
      }
    }),

  getDogDetails: publicProcedure
    .input(
      z.object({
        dogId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        const dog = await ctx.db
          .select({
            id: capturedDogsTable.id,
            dogTagId: capturedDogsTable.dog_tag_id,
            gender: capturedDogsTable.gender,
            dogImageUrl: capturedDogsTable.dogImageUrl,
            weight: capturedDogsTable.weight,
            dogColor: capturedDogsTable.dogColor,
            block: capturedDogsTable.block,
            cageNo: capturedDogsTable.cageNo,
            location: capturedDogsTable.location,
            fullAddress: capturedDogsTable.fullAddress,
            coordinates: capturedDogsTable.coordinates,
            createdAt: capturedDogsTable.createdAt,
            batchId: capturedDogsTable.batchId,
          })
          .from(capturedDogsTable)
          .where(eq(capturedDogsTable.id, input.dogId))
          .limit(1);

        if (!dog.length) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Dog not found",
          });
        }

        const dogData = dog[0];
        if (!dogData || !dogData.batchId) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Dog or batch ID not found",
          });
        }

        // Get batch details to fetch team and vehicle info
        const batchDetails = await ctx.db
          .select({
            teamId: batchesTable.teamId,
            vehicleId: batchesTable.vehicleId,
          })
          .from(batchesTable)
          .where(eq(batchesTable.id, dogData.batchId))
          .limit(1);

        let teamMembers: string[] = [];
        let vehicleNumber = "";

        const batchDetail = batchDetails[0];
        if (batchDetail?.teamId) {
          const team = await ctx.db
            .select({
              members: teamsTable.members,
            })
            .from(teamsTable)
            .where(eq(teamsTable.id, batchDetail.teamId))
            .limit(1);

          const teamData = team[0];
          if (teamData?.members) {
            teamMembers = teamData.members.map(
              (member: { name: string }) => member.name,
            );
          }

          if (batchDetail.vehicleId) {
            const vehicle = await ctx.db
              .select({
                vehicleNumber: vehicleTable.vehicleNumber,
              })
              .from(vehicleTable)
              .where(eq(vehicleTable.id, batchDetail.vehicleId))
              .limit(1);

            const vehicleData = vehicle[0];
            if (vehicleData) {
              vehicleNumber = vehicleData.vehicleNumber ?? "";
            }
          }
        }

        return {
          ...dogData,
          blockAndCage:
            dogData.block && dogData.cageNo
              ? `${dogData.block}-${dogData.cageNo}`
              : "",
          vehicleNumber,
          team: teamMembers.join(", "),
          captureDateTime: formatDateToIST(dogData.createdAt ?? undefined),
          location: dogData.fullAddress || dogData.location || "",
          coordinates: dogData.coordinates,
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch dog details",
          cause: error,
        });
      }
    }),

  updateBatchRelease: protectedProcedure
    .input(
      z.object({
        batchId: z.string(),
        doctorName: z.string(),
        doctorPhoto: z.string(),
        doctorSignature: z.string(),
        releaseDate: z.date(),
        remarks: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Fetch specific batch by primary id
        const batch = await ctx.db
          .select({
            id: batchesTable.id,
            batchNumber: batchesTable.batchNumber,
          })
          .from(batchesTable)
          .where(eq(batchesTable.id, input.batchId))
          .limit(1);

        if (!batch.length) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Batch not found",
          });
        }

        // Update that batch only
        const updatedBatches = await ctx.db
          .update(batchesTable)
          .set({
            doctor_name: input.doctorName,
            doctor_photo: input.doctorPhoto,
            doctor_signature: input.doctorSignature,
            release_date: input.releaseDate,
            release_status: "due",
            batch_release_remarks: input.remarks,
            updatedAt: new Date(),
          })
          .where(eq(batchesTable.id, input.batchId))
          .returning();

        // Create release task entries for each updated row
        for (const batchRecord of updatedBatches) {
          try {
            await ctx.db.insert(releaseTasksTable).values({
              batchId: batchRecord.id,
              batchNumber: batchRecord.batchNumber,
              vehicleId: null,
              teamId: null,
            });
          } catch (e) {
            console.error("Failed to create release task for batch", batchRecord.id, e);
          }
        }

        // Return first updated record
        return updatedBatches[0];
      } catch (error) {
        console.error("Error updating batch release:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update batch release",
        });
      }
    }),

  // New query specifically for surgery tab
  createReleaseTasksForDueBatches: protectedProcedure.mutation(async ({ ctx }) => {
    // backfill release tasks for batches already marked as due but missing release_task entries
    const existingReleaseBatchIds = await ctx.db
      .select({ batchId: releaseTasksTable.batchId })
      .from(releaseTasksTable);
    const existingSet = new Set(existingReleaseBatchIds.map((r) => r.batchId));
    const dueBatches = await ctx.db
      .select({ id: batchesTable.id, batchNumber: batchesTable.batchNumber, vehicleId: batchesTable.vehicleId, teamId: batchesTable.teamId })
      .from(batchesTable)
      .where(eq(batchesTable.release_status, "due"));
    let count = 0;
    for (const b of dueBatches) {
      if (!existingSet.has(b.id)) {
        await ctx.db.insert(releaseTasksTable).values({
          batchId: b.id,
          batchNumber: b.batchNumber,
          vehicleId: b.vehicleId ?? null,
          teamId: b.teamId ?? null,
        });
        count++;
      }
    }
    return { success: true, inserted: count };
  }),

  getSurgeryBatches: publicProcedure.query(async ({ ctx }) => {
    try {
      console.log("Fetching surgery batches...");
      const batches = await ctx.db
        .select({
          id: batchesTable.id,
          batchNumber: batchesTable.batchNumber,
          dogsReceived: batchesTable.dogsReceived,
          createdAt: batchesTable.createdAt,
          endTime: batchesTable.endTime,
          status: batchesTable.status,
          shelter_task_status: batchesTable.shelter_task_status,
          surgical_task_status: batchesTable.surgical_task_status,
        })
        .from(batchesTable)
        .where(
          and(
            eq(batchesTable.status, "completed"),
            eq(batchesTable.shelter_task_status, "completed"),
            eq(batchesTable.surgical_task_status, "pending"),
          ),
        )
        .orderBy(desc(batchesTable.createdAt));

      console.log("Found batches:", batches);

      if (!batches.length) {
        console.log("No batches found");
        return [];
      }

      const formattedBatches = batches.map((batch) => ({
        id: batch.id,
        batchId: batch.batchNumber,
        totalDogs: Number(batch.dogsReceived) || 0,
        dateTime: formatDateToIST(batch.endTime || batch.createdAt), // Use endTime if available, fallback to createdAt
      }));

      console.log("Formatted batches:", formattedBatches);
      return formattedBatches;
    } catch (error) {
      console.error("Error in getSurgeryBatches:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch surgery batches",
        cause: error,
      });
    }
  }),
});
