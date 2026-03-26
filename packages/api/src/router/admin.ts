import { cookies } from "next/headers";
import { hash, verify } from "@node-rs/argon2";
import axios from "axios";
import { eq, ilike } from "drizzle-orm";
import { z } from "zod";

import { db } from "@acme/db";
import { passwordResetOtps, usersTable } from "@acme/db/schema";

import { env } from "../../../db/env";
import { lucia } from "../lucia";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";

export const adminRouter = createTRPCRouter({
  login: publicProcedure
    .input(
      z.object({
        email: z.string(),
        password: z.string().min(1),
      }),
    )
    .mutation(async ({ input: { email, password } }) => {
      const response = await db
        .select({
          passwordHash: usersTable.password,
          id: usersTable.id,
          category: usersTable.category,
        })
        .from(usersTable)
        .where(ilike(usersTable.email, email))
        .execute();

      const user = response[0];

      console.log(user);

      if (!user) {
        throw new Error("User not found");
      }

      if (!user.passwordHash) {
        throw new Error("Invalid Credentials");
      }

      const validPassword = await verify(user.passwordHash, password);
      if (!validPassword) {
        throw new Error("Incorrect username or password");
      }

      if (user.category !== "admin") {
        throw new Error("Invalid Credentials");
      }

      const session = await lucia.createSession(user.id, {});

      const sessionCookie = lucia.createSessionCookie(session.id);

      (await cookies()).set(
        sessionCookie.name,
        sessionCookie.value,
        sessionCookie.attributes,
      );

      return { user };
    }),

  getResetInfo: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .query(async ({ input: { email } }) => {
      const user = await db.query.usersTable.findFirst({
        where: ilike(usersTable.email, email),
      });
      if (!user) throw new Error("User not found");
      const phone = user.phoneNumber ?? "";
      const masked = phone.replace(/.(?=.{4})/g, "*");
      return { phoneMasked: masked };
    }),

  requestPasswordOtp: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
      }),
    )
    .mutation(async ({ input: { email } }) => {
      // Find admin user
      const user = await db.query.usersTable.findFirst({
        where: ilike(usersTable.email, email),
      });
      if (user?.category !== "admin") {
        throw new Error("Admin user not found");
      }

      const phoneNumber = user.phoneNumber;
      if (!phoneNumber) {
        throw new Error("Admin phone number missing");
      }

      // 4-digit in dev / 6-digit in prod
      const otp =
        process.env.NODE_ENV === "development" || phoneNumber === "9360731706"
          ? 123456
          : Math.floor(100000 + Math.random() * 900000);

      // Save OTP (reuse passwordResetOtps)
      await db
        .insert(passwordResetOtps)
        .values({ email, otp, expireAt: new Date(Date.now() + 10 * 60 * 1000) })
        .onConflictDoUpdate({
          target: passwordResetOtps.email,
          set: { otp, expireAt: new Date(Date.now() + 10 * 60 * 1000) },
        })
        .execute();

      // Send SMS irrespective of environment (fire-and-forget in dev)
      try {
        const apiEndpoint = "https://msgn.mtalkz.com/api";
        const message = `${otp} is your verification code EQUIPPP`;
        const payload = {
          apikey: env.MTALKZ_API_KEY,
          senderid: "EQUPPP",
          number: phoneNumber,
          message,
          format: "json",
        };
        axios.post(apiEndpoint, payload).catch((err) => {
          console.warn("SMS send failed", err?.response?.data ?? err.message);
        });
      } catch (err) {
        console.error("SMS logic error", err);
      }

      return {
        success: true,
        ...(process.env.NODE_ENV === "development" ? { otp } : {}),
      };
    }),

  resetPassword: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        otp: z.number(),
        newPassword: z.string().min(6),
      }),
    )
    .mutation(async ({ input: { email, otp, newPassword } }) => {
      const otpRecord = await db.query.passwordResetOtps.findFirst({
        where: ilike(passwordResetOtps.email, email),
      });
      if (otpRecord?.otp !== otp) {
        throw new Error("Invalid OTP");
      }
      if (otpRecord.expireAt && otpRecord.expireAt < new Date()) {
        throw new Error("OTP expired");
      }
      // Hash new password
      const passwordHash = await hash(newPassword);
      await db
        .update(usersTable)
        .set({ password: passwordHash })
        .where(ilike(usersTable.email, email))
        .execute();
      // delete otp
      await db
        .delete(passwordResetOtps)
        .where(ilike(passwordResetOtps.email, email))
        .execute();
      return {
        success: true,
        ...(process.env.NODE_ENV === "development" ? { otp } : {}),
      };
    }),

  getUser: protectedProcedure.query(async ({ ctx }) => {
    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.id, ctx.user.id),
    });

    return user;
  }),
});
