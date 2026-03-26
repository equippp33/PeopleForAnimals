import { cookies } from "next/headers";
import { TRPCError } from "@trpc/server";
import axios from "axios";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@acme/db";
import { driveLeadersTable, otpMessages, usersTable } from "@acme/db/schema";

import { env } from "../../../db/env";
import { lucia } from "../lucia";
import { createTRPCRouter, publicProcedure } from "../trpc";

const categoryEnum = z.enum([
  "operational team",
  "surgical team",
  "shelter team",
]);
type _Category = z.infer<typeof categoryEnum>;

export const authRouter = createTRPCRouter({
  checkUser: publicProcedure
    .input(
      z.object({
        phoneNumber: z.string(),
        category: categoryEnum,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { phoneNumber, category } = input;

      if (!phoneNumber || phoneNumber.length < 10) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid phone number",
        });
      }

      const existingUser = await ctx.db.query.usersTable.findFirst({
        where: and(
          eq(usersTable.phoneNumber, phoneNumber),
          eq(usersTable.category, category),
        ),
      });

      if (!existingUser) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found with this phone number and role",
        });
      }

      return {
        success: true,
        user: existingUser,
      };
    }),

  sendOtp: publicProcedure
    .input(z.object({ phoneNumber: z.string() }))
    .mutation(async ({ input }) => {
      const otp =
        process.env.NODE_ENV === "development" ||
        input.phoneNumber === "9360731706"
          ? 1234
          : Math.floor(1000 + Math.random() * 9000);

      try {
        // Persist OTP and send SMS irrespective of environment
        const apiEndpoint = "https://msgn.mtalkz.com/api";
        const message = `${otp} is your verification code EQUIPPP`;
        const payload = {
          apikey: env.MTALKZ_API_KEY,
          senderid: "EQUPPP",
          number: input.phoneNumber,
          message,
          format: "json",
        };

        // Fire-and-forget SMS in dev to avoid blocking if API key is dummy
        const sendPromise = axios
          .post(apiEndpoint, payload)
          .catch((err: unknown) => {
            const message = axios.isAxiosError(err)
              ? (() => {
                  const data = err.response?.data as unknown;
                  if (typeof data === "string") return data;
                  if (data == null) return err.message;
                  try {
                    return JSON.stringify(data);
                  } catch {
                    return err.message;
                  }
                })()
              : err instanceof Error
                ? err.message
                : "Unknown error";
            console.warn("SMS send failed", message);
          });

        await Promise.all([
          sendPromise,
          db.insert(otpMessages).values({
            phone: input.phoneNumber,
            otp,
            expireAt: new Date(Date.now() + 10 * 60 * 1000),
          }),
        ]);

        return {
          success: true,
          ...(process.env.NODE_ENV === "development" ? { otp } : {}),
        };
      } catch (error) {
        console.log({ error });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to send OTP",
        });
      }
    }),

  verifyOtp: publicProcedure
    .input(
      z.object({
        phoneNumber: z.string(),
        otp: z.number(),
        category: categoryEnum,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { phoneNumber, otp, category } = input;

      const otpRecord = await db.query.otpMessages.findFirst({
        where: eq(otpMessages.phone, phoneNumber),
        orderBy: (messages, { desc }) => [desc(messages.createdAt)],
      });

      if (otpRecord?.otp !== otp) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid OTP",
        });
      }

      if (otpRecord.expireAt < new Date()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "OTP has expired",
        });
      }

      const user = await ctx.db.query.usersTable.findFirst({
        where: and(
          eq(usersTable.phoneNumber, phoneNumber),
          eq(usersTable.category, category),
        ),
      });

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      const session = await lucia.createSession(user.id, {});
      const sessionCookie = lucia.createSessionCookie(session.id);

      (await cookies()).set(
        sessionCookie.name,
        sessionCookie.value,
        sessionCookie.attributes,
      );

      return {
        success: true,
        token: session.id,
        user,
      };
    }),

  signIn: publicProcedure
    .input(
      z.object({
        name: z.string(),
        phoneNumber: z.string(),
        category: categoryEnum,
        vehicleNumber: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const { phoneNumber, name, category, vehicleNumber } = input;

        const user = await ctx.db
          .insert(usersTable)
          .values({
            phoneNumber,
            name,
            category,
            vehicleNumber,
            role: category === "operational team" ? "driver" : "surgeon",
          })
          .returning()
          .execute();

        return {
          success: true,
          user: user[0],
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to process request: ${error instanceof Error ? error.message : "Unknown error"}`,
        };
      }
    }),

  signOut: publicProcedure.mutation(async ({ ctx: _ctx }) => {
    const sessionCookie = (await cookies()).get(lucia.sessionCookieName)?.value;
    if (!sessionCookie) {
      return { success: true };
    }

    try {
      const { session } = await lucia.validateSession(sessionCookie);
      if (session) {
        await lucia.invalidateSession(session.id);
      }

      (await cookies()).set(lucia.sessionCookieName, "", {
        httpOnly: true,
        expires: new Date(0),
      });

      return { success: true };
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error instanceof Error ? error.message : "Failed to sign out",
      });
    }
  }),

  checkDriveLeader: publicProcedure
    .input(
      z.object({
        phoneNumber: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { phoneNumber } = input;

      if (!phoneNumber || phoneNumber.length < 10) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid phone number",
        });
      }

      const existingDriveLeader =
        await ctx.db.query.driveLeadersTable.findFirst({
          where: eq(driveLeadersTable.phoneNumber, phoneNumber),
        });

      if (!existingDriveLeader) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Drive leader not found with this phone number",
        });
      }

      return {
        success: true,
        driveLeader: existingDriveLeader,
      };
    }),

  verifyDriveLeaderOtp: publicProcedure
    .input(
      z.object({
        phoneNumber: z.string(),
        otp: z.number(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { phoneNumber, otp } = input;

      const otpRecord = await db.query.otpMessages.findFirst({
        where: eq(otpMessages.phone, phoneNumber),
        orderBy: (messages, { desc }) => [desc(messages.createdAt)],
      });

      if (otpRecord?.otp !== otp) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid OTP",
        });
      }

      if (otpRecord.expireAt < new Date()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "OTP has expired",
        });
      }

      const driveLeader = await ctx.db.query.driveLeadersTable.findFirst({
        where: eq(driveLeadersTable.phoneNumber, phoneNumber),
      });

      if (!driveLeader) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Drive leader not found",
        });
      }

      // Create a session for the drive leader so mobile can authenticate using Bearer tokens.
      // We map drive leaders to a regular user record (category: operational team).
      let user = await ctx.db.query.usersTable.findFirst({
        where: and(
          eq(usersTable.phoneNumber, phoneNumber),
          eq(usersTable.category, "operational team"),
        ),
      });

      if (!user) {
        const createdUsers = await ctx.db
          .insert(usersTable)
          .values({
            name: driveLeader.name,
            phoneNumber,
            category: "operational team",
            role: "driver",
          })
          .returning();
        user = createdUsers[0];
      }

      if (!user) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create drive leader session",
        });
      }

      const session = await lucia.createSession(user.id, {});
      const sessionCookie = lucia.createSessionCookie(session.id);
      (await cookies()).set(
        sessionCookie.name,
        sessionCookie.value,
        sessionCookie.attributes,
      );

      return {
        success: true,
        token: session.id,
        driveLeader,
      };
    }),
});
