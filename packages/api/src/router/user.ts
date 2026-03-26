import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { TRPCError } from "@trpc/server";
import { and, eq, ne } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";

import {
  driveLeadersTable,
  operationTasksTable,
  releaseTasksTable,
  sessionsTable,
  teamsTable,
  usersTable,
  vehicleTable,
} from "@acme/db/schema";

import type { GroupedMembers } from "../types";
import { env } from "../../../db/env";
import { db } from "../../../db/src/client";
import { lucia } from "../lucia";
import { createTRPCRouter, publicProcedure } from "../trpc";

export interface TeamResponse {
  operational: {
    teams: {
      id: string;
      name: string;
      members: {
        id: string;
        name: string;
        role: string;
        category: string;
      }[];
      createdAt: Date;
    }[];
  };
  surgical: {
    teams: {
      id: string;
      name: string;
      members: {
        id: string;
        name: string;
        role: string;
        category: string;
      }[];
      createdAt: Date;
    }[];
  };
  shelter: {
    teams: {
      id: string;
      name: string;
      members: {
        id: string;
        name: string;
        role: string;
        category: string;
      }[];
      createdAt: Date;
    }[];
  };
}

export const userRouter = createTRPCRouter({
  getAllMembers: publicProcedure.query(
    async ({ ctx }): Promise<GroupedMembers> => {
      try {
        // Only fetch active users
        const allUsers = await ctx.db.query.usersTable.findMany({
          where: eq(usersTable.active, true),
        });

        const groupedMembers: GroupedMembers = {
          "operational team": {
            driver: [],
            catcher: [],
          },
          "surgical team": {
            surgeon: [],
            "medical assistant": [],
          },
          "shelter team": {
            "ward boy": [],
          },
        };

        // Group users by their role and category
        for (const user of allUsers) {
          const memberWithActive = {
            ...user,
            active: user.active ?? true,
          };

          const role: string = user.role ?? "";
          const category = user.category ?? "";

          if (category === "operational team") {
            if (role === "driver") {
              groupedMembers["operational team"].driver.push(memberWithActive);
            } else if (role === "catcher") {
              groupedMembers["operational team"].catcher.push(memberWithActive);
            }
          } else if (category === "surgical team") {
            if (role === "surgeon") {
              groupedMembers["surgical team"].surgeon.push(memberWithActive);
            } else if (role === "medical assistant") {
              groupedMembers["surgical team"]["medical assistant"].push(
                memberWithActive,
              );
            }
          } else if (category === "shelter team") {
            if (role === "ward boy") {
              groupedMembers["shelter team"]["ward boy"].push(memberWithActive);
            }
          }
        }

        return groupedMembers;
      } catch (error) {
        console.error("Error fetching members:", error);
        throw new Error("Failed to fetch members");
      }
    },
  ),

  addMember: publicProcedure
    .input(
      z.object({
        name: z.string().min(1, "Name is required"),
        phone: z.string().min(10, "Phone number must be at least 10 digits"),
        teamType: z.enum(["operational team", "surgical team", "shelter team"]),
        roleType: z.enum([
          "driver",
          "catcher",
          "surgeon",
          "medical assistant",
          "ward boy",
        ]),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const { name, phone, teamType, roleType } = input;

        // Validate role matches team type
        const isValidRole = ((): boolean => {
          switch (teamType) {
            case "operational team":
              return ["driver", "catcher"].includes(roleType);
            case "surgical team":
              return ["surgeon", "medical assistant"].includes(roleType);
            case "shelter team":
              return roleType === "ward boy";
            default:
              return false;
          }
        })();

        if (!isValidRole) {
          throw new Error(
            `Invalid role "${roleType}" for team type "${teamType}"`,
          );
        }

        // Check if ACTIVE user already exists with same phone
        const existingActiveUser = await ctx.db.query.usersTable.findFirst({
          where: and(
            eq(usersTable.phoneNumber, phone),
            eq(usersTable.active, true),
          ),
        });

        console.log(`🔍 Checking phone: ${phone}`);
        console.log(
          `📱 Active user found:`,
          existingActiveUser
            ? `${existingActiveUser.name} (active: ${existingActiveUser.active})`
            : "None",
        );

        if (existingActiveUser) {
          throw new Error("User with this phone number already exists");
        }

        // Check if ARCHIVED user exists - if so, reactivate them
        const existingArchivedUser = await ctx.db.query.usersTable.findFirst({
          where: and(
            eq(usersTable.phoneNumber, phone),
            eq(usersTable.active, false),
          ),
        });

        console.log(
          `📦 Archived user found:`,
          existingArchivedUser
            ? `${existingArchivedUser.name} (active: ${existingArchivedUser.active})`
            : "None",
        );

        if (existingArchivedUser) {
          // Reactivate the archived user instead of creating duplicate
          const generateHindiName = (name: string): string => {
            return name
              .replace(/Supervisor/gi, "सुपरवाइजर")
              .replace(/Manager/gi, "मैनेजर")
              .replace(/Officer/gi, "ऑफिसर")
              .replace(/Admin/gi, "एडमिन")
              .replace(/Dr\./gi, "डॉ.")
              .replace(/Mr\./gi, "श्री")
              .replace(/Mrs\./gi, "श्रीमती")
              .replace(/Ms\./gi, "सुश्री")
              .replace(/Driver/gi, "ड्राइवर")
              .replace(/Catcher/gi, "कैचर")
              .replace(/Surgeon/gi, "सर्जन")
              .replace(/Medical Assistant/gi, "मेडिकल असिस्टेंट")
              .replace(/Ward Boy/gi, "वार्ड बॉय");
          };

          const generateTeluguName = (name: string): string => {
            return name
              .replace(/Supervisor/gi, "సూపర్‌వైజర్")
              .replace(/Manager/gi, "మేనేజర్")
              .replace(/Officer/gi, "ఆఫీసర్")
              .replace(/Admin/gi, "అడ్మిన్")
              .replace(/Dr\./gi, "డాక్టర్")
              .replace(/Mr\./gi, "శ్రీ")
              .replace(/Mrs\./gi, "శ్రీమతి")
              .replace(/Ms\./gi, "కుమారి")
              .replace(/Driver/gi, "డ్రైవర్")
              .replace(/Catcher/gi, "క్యాచర్")
              .replace(/Surgeon/gi, "సర్జన్")
              .replace(/Medical Assistant/gi, "మెడికల్ అసిస్టెంట్")
              .replace(/Ward Boy/gi, "వార్డ్ బాయ్");
          };

          const reactivatedUser = await ctx.db
            .update(usersTable)
            .set({
              active: true,
              updatedAt: new Date(),
              category: teamType,
              role: roleType as any,
              // Update other fields if needed
              name: name,
              hi_name: generateHindiName(name),
              te_name: generateTeluguName(name),
              phoneNumber: phone,
            })
            .where(eq(usersTable.id, existingArchivedUser.id))
            .returning()
            .execute();

          console.log(`Reactivated user ${existingArchivedUser.id} (${name})`);

          return {
            success: true,
            user: reactivatedUser[0],
            reactivated: true, // Flag to indicate reactivation
          };
        }

        // Only create new user if no archived version exists
        // Generate transliterated names
        const generateHindiName = (name: string): string => {
          return name
            .replace(/Supervisor/gi, "सुपरवाइजर")
            .replace(/Manager/gi, "मैनेजर")
            .replace(/Officer/gi, "ऑफिसर")
            .replace(/Admin/gi, "एडमिन")
            .replace(/Dr\./gi, "डॉ.")
            .replace(/Mr\./gi, "श्री")
            .replace(/Mrs\./gi, "श्रीमती")
            .replace(/Ms\./gi, "सुश्री")
            .replace(/Driver/gi, "ड्राइवर")
            .replace(/Catcher/gi, "कैचर")
            .replace(/Surgeon/gi, "सर्जन")
            .replace(/Medical Assistant/gi, "मेडिकल असिस्टेंट")
            .replace(/Ward Boy/gi, "वार्ड बॉय");
        };

        const generateTeluguName = (name: string): string => {
          return name
            .replace(/Supervisor/gi, "సూపర్‌వైజర్")
            .replace(/Manager/gi, "మేనేజర్")
            .replace(/Officer/gi, "ఆఫీసర్")
            .replace(/Admin/gi, "అడ్మిన్")
            .replace(/Dr\./gi, "డాక్టర్")
            .replace(/Mr\./gi, "శ్రీ")
            .replace(/Mrs\./gi, "శ్రీమతి")
            .replace(/Ms\./gi, "కుమారి")
            .replace(/Driver/gi, "డ్రైవర్")
            .replace(/Catcher/gi, "క్యాచర్")
            .replace(/Surgeon/gi, "సర్జన్")
            .replace(/Medical Assistant/gi, "మెడికల్ అసిస్టెంట్")
            .replace(/Ward Boy/gi, "వార్డ్ బాయ్");
        };

        // Insert new user with transliterated names
        const newUser = await ctx.db
          .insert(usersTable)
          .values({
            name,
            hi_name: generateHindiName(name),
            te_name: generateTeluguName(name),
            phoneNumber: phone,
            category: teamType,
            // Cast roleType to any to bypass TypeScript error if schema is not updated
            role: roleType as any,
            active: true,
          })
          .returning()
          .execute();

        return {
          success: true,
          user: newUser[0],
          reactivated: false, // Flag to indicate new user creation
        };
      } catch (error) {
        console.error("Error adding member:", error);
        return {
          success: false,
          error:
            error instanceof Error ? error.message : "Failed to add member",
        };
      }
    }),

  toggleMemberStatus: publicProcedure
    .input(
      z.object({
        memberId: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const member = await ctx.db.query.usersTable.findFirst({
          where: eq(usersTable.id, input.memberId),
        });

        if (!member) {
          throw new Error("Member not found");
        }

        const updatedMember = await ctx.db
          .update(usersTable)
          .set({
            active: !(member.active ?? true),
          })
          .where(eq(usersTable.id, input.memberId))
          .returning()
          .execute();

        return {
          success: true,
          member: updatedMember[0],
        };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to toggle member status",
        };
      }
    }),

  deleteMember: publicProcedure
    .input(
      z.object({
        memberId: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        console.log(`🗑️ Attempting to archive member: ${input.memberId}`);

        // First check if user exists and their current status
        const existingUser = await ctx.db.query.usersTable.findFirst({
          where: eq(usersTable.id, input.memberId),
        });

        if (!existingUser) {
          console.log(`❌ Member not found: ${input.memberId}`);
          throw new Error("Member not found");
        }

        console.log(
          `👤 Found user: ${existingUser?.name} (active: ${existingUser?.active})`,
        );

        // Soft delete: set active to false instead of deleting
        // This preserves user data for historical reports
        const updatedMember = await ctx.db
          .update(usersTable)
          .set({
            active: false,
            updatedAt: new Date(),
          })
          .where(eq(usersTable.id, input.memberId))
          .returning()
          .execute();

        if (!updatedMember.length) {
          console.log(`❌ Failed to update member: ${input.memberId}`);
          throw new Error("Member not found");
        }

        console.log(
          `✅ Successfully archived member: ${updatedMember[0]?.name} (active: ${updatedMember[0]?.active})`,
        );

        // Remove the user from all teams where they are a member
        const allTeams = await ctx.db.select().from(teamsTable);

        for (const team of allTeams) {
          const members = team.members as {
            id: string;
            name: string;
            role: string;
            category: string;
          }[];

          // Check if this user is in the team
          const userInTeam = members.some(
            (member) => member.id === input.memberId,
          );

          if (userInTeam) {
            // Remove the user from this team's members array
            const updatedMembers = members.filter(
              (member) => member.id !== input.memberId,
            );

            // Update the team with the new members array
            await ctx.db
              .update(teamsTable)
              .set({ members: updatedMembers })
              .where(eq(teamsTable.id, team.id))
              .execute();

            console.log(
              `Removed user ${input.memberId} from team ${team.name}`,
            );
          }
        }

        // Remove any active sessions for this user
        await ctx.db
          .delete(sessionsTable)
          .where(eq(sessionsTable.userId, input.memberId))
          .execute();

        console.log(`🧹 Cleaned up sessions for user: ${input.memberId}`);

        return {
          success: true,
          member: updatedMember[0],
        };
      } catch (error) {
        console.error(`❌ Error archiving member ${input.memberId}:`, error);
        throw new Error(
          error instanceof Error ? error.message : "Failed to archive member",
        );
      }
    }),

  updateMember: publicProcedure
    .input(
      z.object({
        memberId: z.string(),
        name: z.string().min(1, "Name is required"),
        phone: z.string().min(10, "Phone number must be at least 10 digits"),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        // Generate transliterated names
        const generateHindiName = (name: string): string => {
          return name
            .replace(/Supervisor/gi, "सुपरवाइजर")
            .replace(/Manager/gi, "मैनेजर")
            .replace(/Officer/gi, "ऑफिसर")
            .replace(/Admin/gi, "एडमिन")
            .replace(/Dr\./gi, "डॉ.")
            .replace(/Mr\./gi, "श्री")
            .replace(/Mrs\./gi, "श्रीमती")
            .replace(/Ms\./gi, "सुश्री")
            .replace(/Driver/gi, "ड्राइवर")
            .replace(/Catcher/gi, "कैचर")
            .replace(/Surgeon/gi, "सर्जन")
            .replace(/Medical Assistant/gi, "मेडिकल असिस्टेंट")
            .replace(/Ward Boy/gi, "वार्ड बॉय");
        };

        const generateTeluguName = (name: string): string => {
          return name
            .replace(/Supervisor/gi, "సూపర్‌వైజర్")
            .replace(/Manager/gi, "మేనేజర్")
            .replace(/Officer/gi, "ఆఫీసర్")
            .replace(/Admin/gi, "అడ్మిన్")
            .replace(/Dr\./gi, "డాక్టర్")
            .replace(/Mr\./gi, "శ్రీ")
            .replace(/Mrs\./gi, "శ్రీమతి")
            .replace(/Ms\./gi, "కుమారి")
            .replace(/Driver/gi, "డ్రైవర్")
            .replace(/Catcher/gi, "క్యాచర్")
            .replace(/Surgeon/gi, "సర్జన్")
            .replace(/Medical Assistant/gi, "మెడికల్ అసిస్టెంట్")
            .replace(/Ward Boy/gi, "వార్డ్ బాయ్");
        };

        const updated = await ctx.db
          .update(usersTable)
          .set({
            name: input.name,
            hi_name: generateHindiName(input.name),
            te_name: generateTeluguName(input.name),
            phoneNumber: input.phone,
          })
          .where(eq(usersTable.id, input.memberId))
          .returning()
          .execute();

        if (!updated.length) {
          throw new Error("Member not found");
        }

        return {
          success: true,
          member: updated[0],
        };
      } catch (error) {
        throw new Error(
          error instanceof Error ? error.message : "Failed to update member",
        );
      }
    }),

  createTeam: publicProcedure
    .input(
      z.object({
        name: z.string(),
        category: z.enum(["operational team", "surgical team"]),
        members: z.array(
          z.object({
            id: z.string(),
            name: z.string(),
            role: z.string(),
            category: z.string(),
          }),
        ),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        // Check if team name already exists (only check active teams)
        const existingTeam = await ctx.db.query.teamsTable.findFirst({
          where: and(
            eq(teamsTable.name, input.name),
            eq(teamsTable.active, true),
          ),
        });

        if (existingTeam) {
          throw new Error("Team with this name already exists");
        }

        // Validate all members are active users
        for (const member of input.members) {
          const activeUser = await ctx.db.query.usersTable.findFirst({
            where: and(
              eq(usersTable.id, member.id),
              eq(usersTable.active, true),
            ),
          });
          if (!activeUser) {
            throw new Error(`Member "${member.name}" is not an active user`);
          }
        }

        // Create new team
        const newTeam = await ctx.db
          .insert(teamsTable)
          .values({
            name: input.name,
            category: input.category,
            members: input.members,
          })
          .returning();

        return {
          success: true,
          team: newTeam[0],
        };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error ? error.message : "Failed to create team",
        };
      }
    }),

  updateTeam: publicProcedure
    .input(
      z.object({
        teamId: z.string(),
        name: z.string(),
        members: z.array(
          z.object({
            id: z.string(),
            name: z.string(),
            role: z.string(),
            category: z.string(),
          }),
        ),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        // ensure unique name (exclude current team, only check active teams)
        const existing = await ctx.db.query.teamsTable.findFirst({
          where: and(
            eq(teamsTable.name, input.name),
            ne(teamsTable.id, input.teamId),
            eq(teamsTable.active, true),
          ),
        });
        if (existing) {
          throw new Error("Another team with this name already exists");
        }

        // Validate all members are active users
        for (const member of input.members) {
          const activeUser = await ctx.db.query.usersTable.findFirst({
            where: and(
              eq(usersTable.id, member.id),
              eq(usersTable.active, true),
            ),
          });
          if (!activeUser) {
            throw new Error(`Member "${member.name}" is not an active user`);
          }
        }

        const updated = await ctx.db
          .update(teamsTable)
          .set({
            name: input.name,
            members: input.members,
          })
          .where(eq(teamsTable.id, input.teamId))
          .returning()
          .execute();

        if (!updated.length) {
          throw new Error("Team not found");
        }

        return { success: true, team: updated[0] };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error ? error.message : "Failed to update team",
        };
      }
    }),
  getAllTeams: publicProcedure.query(async ({ ctx }): Promise<TeamResponse> => {
    try {
      const allTeams = await ctx.db.query.teamsTable.findMany({
        where: eq(teamsTable.active, true),
        orderBy: (teams, { desc }) => [desc(teams.createdAt)],
      });

      const groupedTeams: TeamResponse = {
        operational: { teams: [] },
        surgical: { teams: [] },
        shelter: { teams: [] },
      };

      // Group teams by their category
      for (const team of allTeams) {
        if (team.category === "operational team") {
          groupedTeams.operational.teams.push({
            id: team.id,
            name: team.name,
            members: team.members as {
              id: string;
              name: string;
              role: string;
              category: string;
            }[],
            createdAt: team.createdAt ?? new Date(),
          });
        } else if (team.category === "surgical team") {
          groupedTeams.surgical.teams.push({
            id: team.id,
            name: team.name,
            members: team.members as {
              id: string;
              name: string;
              role: string;
              category: string;
            }[],
            createdAt: team.createdAt ?? new Date(),
          });
        } else if (team.category === "shelter team") {
          groupedTeams.shelter.teams.push({
            id: team.id,
            name: team.name,
            members: team.members as {
              id: string;
              name: string;
              role: string;
              category: string;
            }[],
            createdAt: team.createdAt ?? new Date(),
          });
        }
      }

      return groupedTeams;
    } catch (error) {
      console.error("Error fetching teams:", error);
      throw new Error("Failed to fetch teams");
    }
  }),
  deleteTeam: publicProcedure
    .input(
      z.object({
        teamId: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        // Soft delete: set active to false instead of deleting
        const updatedTeam = await ctx.db
          .update(teamsTable)
          .set({ active: false, updatedAt: new Date() })
          .where(eq(teamsTable.id, input.teamId))
          .returning();

        if (!updatedTeam.length) {
          throw new Error("Team not found");
        }

        // Clean up related assignments to prevent orphaned records

        // 1. Unassign team from pending/active operation tasks
        await ctx.db
          .update(operationTasksTable)
          .set({
            teamId: null,
            updatedAt: new Date(),
          })
          .where(eq(operationTasksTable.teamId, input.teamId));

        // 2. Unassign team from pending release tasks and reset to pending
        await ctx.db
          .update(releaseTasksTable)
          .set({
            teamId: null,
            status: "pending",
            updatedAt: new Date(),
          })
          .where(eq(releaseTasksTable.teamId, input.teamId));

        // 3. Remove vehicle assignment from the deleted team
        await ctx.db
          .update(teamsTable)
          .set({
            vehicleId: null,
            updatedAt: new Date(),
          })
          .where(eq(teamsTable.id, input.teamId));

        console.log(
          `Team ${input.teamId} archived and all related assignments cleaned up`,
        );

        return {
          success: true,
          team: updatedTeam[0],
        };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error ? error.message : "Failed to delete team",
        };
      }
    }),

  getCurrentUser: publicProcedure.query(async ({ ctx }) => {
    const userId = ctx.user?.id;

    if (!userId) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Please login again - your session has expired" });
    }

    const user = await ctx.db.query.usersTable.findFirst({
      where: eq(usersTable.id, userId),
    });

    if (!user) {
      throw new Error("User not found");
    }

    return user;
  }),

  updateCurrentUser: publicProcedure
    .input(
      z.object({
        name: z.string().min(1, "Name is required").optional(),
        email: z.string().email("Invalid email address").optional(),
        phoneNumber: z
          .string()
          .min(10, "Phone number must be at least 10 digits"),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user?.id;
      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Please login again - your session has expired" });
      }
      // Check for duplicate phone or email (other than self)
      const existingPhone = await ctx.db.query.usersTable.findFirst({
        where: and(
          eq(usersTable.phoneNumber, input.phoneNumber),
          ne(usersTable.id, userId),
        ),
      });
      if (existingPhone) {
        throw new Error("Phone number already in use by another user");
      }
      // Only check for duplicate email if it's being updated
      if (input.email) {
        const existingEmail = await ctx.db.query.usersTable.findFirst({
          where: and(
            eq(usersTable.email, input.email),
            ne(usersTable.id, userId),
          ),
        });
        if (existingEmail) {
          throw new Error("Email already in use by another user");
        }
      }

      // Build update object with only provided and defined fields
      const updateData: Record<string, string> = {
        phoneNumber: input.phoneNumber,
      };

      if (input.name) {
        updateData.name = input.name;
      }

      if (input.email) {
        updateData.email = input.email;
      }

      // Update user
      const updated = await ctx.db
        .update(usersTable)
        .set(updateData)
        .where(eq(usersTable.id, userId))
        .returning()
        .execute();
      if (!updated.length) {
        throw new Error("User not found");
      }
      return { success: true, user: updated[0] };
    }),

  getCurrentDriveLeader: publicProcedure
    .input(z.object({ phoneNumber: z.string() }))
    .query(async ({ input, ctx }) => {
      const driveLeader = await ctx.db.query.driveLeadersTable.findFirst({
        where: eq(driveLeadersTable.phoneNumber, input.phoneNumber),
      });

      if (!driveLeader) {
        throw new Error("Drive leader not found");
      }

      return driveLeader;
    }),

  getUserByPhone: publicProcedure
    .input(z.object({ phoneNumber: z.string() }))
    .query(async ({ input, ctx }) => {
      const user = await ctx.db.query.usersTable.findFirst({
        where: eq(usersTable.phoneNumber, input.phoneNumber),
      });

      if (!user) {
        throw new Error("User not found");
      }

      return user;
    }),
});
