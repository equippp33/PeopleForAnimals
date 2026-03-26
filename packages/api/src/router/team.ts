import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import { db } from "@acme/db";
import { teamsTable } from "@acme/db/schema";

import { createTRPCRouter, publicProcedure } from "../trpc";

const TeamMemberInput = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string(),
  category: z.string(),
});

const TeamInput = z.object({
  name: z.string(),
  category: z.string(),
  members: z.array(TeamMemberInput),
});

export const teamRouter = createTRPCRouter({
  getAllTeams: publicProcedure.query(async () => {
    try {
      const teams = await db
        .select()
        .from(teamsTable)
        .where(eq(teamsTable.active, true));
      return teams;
    } catch (error) {
      console.error("Error fetching teams:", error);
      throw error;
    }
  }),

  getUnassignedTeams: publicProcedure.query(async () => {
    try {
      const teams = await db
        .select()
        .from(teamsTable)
        .where(and(isNull(teamsTable.vehicleId), eq(teamsTable.active, true)));
      return teams;
    } catch (error) {
      console.error("Error fetching unassigned teams:", error);
      throw error;
    }
  }),

  createTeam: publicProcedure.input(TeamInput).mutation(async ({ input }) => {
    try {
      const team = await db
        .insert(teamsTable)
        .values({
          name: input.name,
          category: input.category,
          members: input.members,
        })
        .returning();

      return { success: true, team: team[0] };
    } catch (error) {
      console.error("Error creating team:", error);
      return { success: false, error: "Failed to create team" };
    }
  }),

  assignTeamToVehicle: publicProcedure
    .input(z.object({ teamId: z.string(), vehicleId: z.string() }))
    .mutation(async ({ input }) => {
      try {
        const team = await db
          .update(teamsTable)
          .set({
            vehicleId: input.vehicleId,
            updatedAt: new Date(),
          })
          .where(eq(teamsTable.id, input.teamId))
          .returning();

        return { success: true, team: team[0] };
      } catch (error) {
        console.error("Error assigning team to vehicle:", error);
        return { success: false, error: "Failed to assign team to vehicle" };
      }
    }),

  removeTeamFromVehicle: publicProcedure
    .input(z.object({ teamId: z.string() }))
    .mutation(async ({ input }) => {
      try {
        const team = await db
          .update(teamsTable)
          .set({
            vehicleId: null,
            updatedAt: new Date(),
          })
          .where(eq(teamsTable.id, input.teamId))
          .returning();

        return { success: true, team: team[0] };
      } catch (error) {
        console.error("Error removing team from vehicle:", error);
        return { success: false, error: "Failed to remove team from vehicle" };
      }
    }),
});
