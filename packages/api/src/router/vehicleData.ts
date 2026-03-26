import { z } from "zod";
import { db } from "@acme/db";
import { vehicleDataTable, teamsTable } from "@acme/db/schema";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { and, gte, lt } from "drizzle-orm";

const VehicleDataInput = z.object({
  vehicleReading: z.string(),
  imageId: z.string(),
  date: z.date().optional(),
});

export const vehicleDataRouter = createTRPCRouter({
  // Create a new vehicle data entry
  create: protectedProcedure
    .input(VehicleDataInput)
    .mutation(async ({ input, ctx }) => {
      try {
        console.log('Creating vehicle data with input:', JSON.stringify(input, null, 2));
        
        // First, check if the table exists and is accessible
        try {
          const tableInfo = await db.select().from(vehicleDataTable).limit(1);
          console.log('Table access check successful', { tableInfo: tableInfo.length > 0 ? 'has data' : 'empty' });
        } catch (tableError) {
          console.error('Table access error:', JSON.stringify(tableError, Object.getOwnPropertyNames(tableError)));
          throw new Error(`Table access error: ${tableError instanceof Error ? tableError.message : 'Unknown error'}`);
        }
        
        // Try to insert the record
        try {
          const [record] = await db
            .insert(vehicleDataTable)
            .values({
              vehicleReading: input.vehicleReading,
              imageId: input.imageId,
              userId: ctx.user.id,
              date: input.date ?? new Date(),
              updatedAt: new Date(),
            })
            .returning();

          if (!record) {
            throw new Error('No record was returned after insert');
          }

          console.log('Successfully created vehicle data:', JSON.stringify(record, null, 2));
          return { success: true, data: record };
        } catch (dbError) {
          console.error('Database operation failed:', JSON.stringify(dbError, Object.getOwnPropertyNames(dbError)));
          throw dbError;
        }
      } catch (error) {
        const errorDetails = error instanceof Error 
          ? {
              message: error.message,
              name: error.name,
              stack: error.stack,
              ...(error as any).code && { code: (error as any).code },
              ...(error as any).detail && { detail: (error as any).detail },
              ...(error as any).hint && { hint: (error as any).hint },
            }
          : { rawError: error };

        console.error("Error creating vehicle data:", JSON.stringify(errorDetails, null, 2));
        
        return { 
          success: false, 
          error: "Failed to create vehicle data",
          details: errorDetails,
        };
      }
    }),

  // Get all vehicle data entries
  getAll: protectedProcedure.query(async () => {
    try {
      const records = await db
        .select()
        .from(vehicleDataTable)
        .orderBy(vehicleDataTable.date);
      
      return { success: true, data: records };
    } catch (error) {
      console.error("Error fetching vehicle data:", error);
      return { 
        success: false, 
        error: "Failed to fetch vehicle data" 
      };
    }
  }),

  // Check if any team member has vehicle reading for today
  checkTeamVehicleReading: protectedProcedure.mutation(async ({ ctx }) => {
    try {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

      // Get all teams and find which team the current user belongs to
      const teams = await db.select().from(teamsTable);
      
      let userTeam = null;
      for (const team of teams) {
        const members = team.members as { id: string; name: string }[];
        if (members.some(member => member.id === ctx.user.id)) {
          userTeam = team;
          break;
        }
      }

      if (!userTeam) {
        return { success: true, hasReading: false, message: "User not in any team" };
      }

      // Get all team member IDs
      const teamMembers = userTeam.members as { id: string; name: string }[];
      const teamUserIds = teamMembers.map(member => member.id);

      // Check if any team member has vehicle reading for today
      const vehicleReadings = await db
        .select()
        .from(vehicleDataTable)
        .where(
          and(
            gte(vehicleDataTable.date, startOfDay),
            lt(vehicleDataTable.date, endOfDay)
          )
        );

      const hasTeamReading = vehicleReadings.some(reading => 
        reading.userId !== null && teamUserIds.includes(reading.userId)
      );

      return { 
        success: true, 
        hasReading: hasTeamReading,
        message: hasTeamReading ? "Team member has already added vehicle reading" : "No team member has added vehicle reading today"
      };
    } catch (error) {
      console.error("Error checking team vehicle reading:", error);
      return { 
        success: false, 
        hasReading: false,
        error: "Failed to check team vehicle reading" 
      };
    }
  }),
});
