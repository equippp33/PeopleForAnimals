import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@acme/db";
import {
  operationTasksTable,
  releaseTasksTable,
  teamsTable,
  vehicleTable,
} from "@acme/db/schema";

import { createTRPCRouter, publicProcedure } from "../trpc";

const VehicleInput = z.object({
  name: z.string(),
  vehicleNumber: z.string(),
  vehicleColor: z.string(),
  locationName: z.string().optional(),
  locationCoordinates: z.string().optional(),
});

export const vehicleRouter = createTRPCRouter({
  getAllVehicles: publicProcedure.query(async () => {
    try {
      const vehicles = await db
        .select()
        .from(vehicleTable)
        .where(eq(vehicleTable.active, true));
      return vehicles;
    } catch (error) {
      console.error("Error fetching vehicles:", error);
      throw error;
    }
  }),

  createVehicle: publicProcedure
    .input(VehicleInput)
    .mutation(async ({ input }) => {
      try {
        const vehicle = await db
          .insert(vehicleTable)
          .values({
            name: input.name,
            vehicleNumber: input.vehicleNumber,
            vehicleColor: input.vehicleColor,
            locationName: input.locationName,
            locationCoordinates: input.locationCoordinates,
          })
          .returning();

        return { success: true, vehicle: vehicle[0] };
      } catch (error) {
        console.error("Error creating vehicle:", error);
        return { success: false, error: "Failed to create vehicle" };
      }
    }),

  updateVehicleLocation: publicProcedure
    .input(
      z.object({
        vehicleId: z.string(),
        locationName: z.string(),
        locationCoordinates: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const vehicle = await db
          .update(vehicleTable)
          .set({
            locationName: input.locationName,
            locationCoordinates: input.locationCoordinates,
            updatedAt: new Date(),
          })
          .where(eq(vehicleTable.id, input.vehicleId))
          .returning();

        return { success: true, vehicle: vehicle[0] };
      } catch (error) {
        console.error("Error updating vehicle location:", error);
        return { success: false, error: "Failed to update vehicle location" };
      }
    }),

  deleteVehicle: publicProcedure
    .input(z.object({ vehicleId: z.string() }))
    .mutation(async ({ input }) => {
      try {
        const vehicleId = input.vehicleId;

        // Soft delete: set active to false instead of deleting
        // This preserves vehicle data for historical reports
        const updatedVehicle = await db
          .update(vehicleTable)
          .set({
            active: false,
            updatedAt: new Date(),
          })
          .where(eq(vehicleTable.id, vehicleId))
          .returning();

        if (!updatedVehicle.length) {
          throw new Error("Vehicle not found");
        }

        // Clean up related assignments to prevent orphaned records

        // 1. Clear references from teams so they can be reassigned
        await db
          .update(teamsTable)
          .set({
            vehicleId: null,
            updatedAt: new Date(),
          })
          .where(eq(teamsTable.vehicleId, vehicleId));

        // 2. Unassign vehicle from pending operation tasks
        await db
          .update(operationTasksTable)
          .set({
            vehicleId: null,
            updatedAt: new Date(),
          })
          .where(eq(operationTasksTable.vehicleId, vehicleId));

        // 3. Unassign vehicle from pending release tasks
        await db
          .update(releaseTasksTable)
          .set({
            vehicleId: null,
            updatedAt: new Date(),
          })
          .where(eq(releaseTasksTable.vehicleId, vehicleId));

        console.log(`Vehicle ${vehicleId} archived and all related assignments cleaned up`);

        return { success: true, vehicle: updatedVehicle[0] };
      } catch (error) {
        console.error("Error archiving vehicle:", error);
        return { success: false, error: "Failed to archive vehicle" };
      }
    }),
});
