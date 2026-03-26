/**
 * YOU PROBABLY DON'T NEED TO EDIT THIS FILE, UNLESS:
 * 1. You want to modify request context (see Part 1).
 * 2. You want to create a new middleware or type of procedure (see Part 3).
 *
 * TL;DR - This is where all the tRPC server stuff is created and plugged in. The pieces you will
 * need to use are documented accordingly near the end.
 */
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import type { Session, User } from "lucia";
import { cookies } from "next/headers";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";

import { db } from "@acme/db";

import { lucia } from "./lucia";

/**
 * Context type
 */
export interface TRPCContext {
  db: typeof db;
  session: Session | null;
  user: User | null;
  host: string | null;
  headers: Headers;
}

const getBearerToken = (headers: Headers): string | null => {
  const raw = headers.get("authorization") ?? headers.get("Authorization");
  if (!raw) return null;
  const match = /^Bearer\s+(.+)$/i.exec(raw);
  return match?.[1]?.trim() ? match[1].trim() : null;
};

export const uncachedValidateRequest = async (): Promise<
  { user: User; session: Session } | { user: null; session: null }
> => {
  const sessionId =
    (await cookies()).get(lucia.sessionCookieName)?.value ?? null;

  if (!sessionId) {
    return { user: null, session: null };
  }

  // Validate session manually to prevent Lucia's automatic session renewal.
  // lucia.validateSession() extends expires_at when the session is past its
  // halfway point, which defeats short expiry windows.
  const existingSession = await db.query.sessionsTable.findFirst({
    where: (sessions, { eq }) => eq(sessions.id, sessionId),
  });

  if (!existingSession || existingSession.expiresAt < new Date()) {
    if (existingSession) {
      console.log('Cookie session expired at', existingSession.expiresAt, 'current time', new Date());
    }
    try {
      const sessionCookie = lucia.createBlankSessionCookie();
      (await cookies()).set(
        sessionCookie.name,
        sessionCookie.value,
        sessionCookie.attributes,
      );
    } catch {
      console.error("Failed to clear session cookie");
    }
    return { user: null, session: null };
  }

  const existingUser = await db.query.usersTable.findFirst({
    where: (users, { eq }) => eq(users.id, existingSession.userId),
  });

  if (!existingUser) {
    return { user: null, session: null };
  }

  return {
    session: {
      id: existingSession.id,
      userId: existingSession.userId,
      expiresAt: existingSession.expiresAt,
      fresh: false,
    } as Session,
    user: {
      id: existingUser.id,
      phoneNumber: existingUser.phoneNumber ?? "",
      email: existingUser.email ?? "",
      category: existingUser.category ?? "",
    } as User,
  };
};

/**
 * 1. CONTEXT
 *
 * This section defines the "contexts" that are available in the backend API.
 *
 * These allow you to access things when processing a request, like the database, the session, etc.
 *
 * This helper generates the "internals" for a tRPC context. The API handler and RSC clients each
 * wrap this and provides the required context.
 *
 * @see https://trpc.io/docs/server/context
 */
export const createTRPCContext = async (opts: {
  headers: Headers;
}): Promise<TRPCContext> => {
  const bearer = getBearerToken(opts.headers);
  const { session, user } = bearer
    ? await (async () => {
        // Validate manually to prevent Lucia's automatic session renewal
        const existingSession = await db.query.sessionsTable.findFirst({
          where: (sessions, { eq }) => eq(sessions.id, bearer),
        });

        if (!existingSession || existingSession.expiresAt < new Date()) {
          if (existingSession) {
            console.log('Bearer session expired at', existingSession.expiresAt, 'current time', new Date());
          }
          return { session: null as null, user: null as null };
        }

        const existingUser = await db.query.usersTable.findFirst({
          where: (users, { eq }) => eq(users.id, existingSession.userId),
        });

        if (!existingUser) {
          return { session: null as null, user: null as null };
        }

        return {
          session: {
            id: existingSession.id,
            userId: existingSession.userId,
            expiresAt: existingSession.expiresAt,
            fresh: false,
          } as Session,
          user: {
            id: existingUser.id,
            phoneNumber: existingUser.phoneNumber ?? "",
            email: existingUser.email ?? "",
            category: existingUser.category ?? "",
          } as User,
        };
      })()
    : await uncachedValidateRequest();

  const host = opts.headers.get("host");

  return {
    db,
    session,
    user,
    host,
    headers: opts.headers,
  };
};

/**
 * 2. INITIALIZATION
 *
 * This is where the tRPC API is initialized, connecting the context and transformer. We also parse
 * ZodErrors so that you get typesafety on the frontend if your procedure fails due to validation
 * errors on the backend.
 */
const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export type CallerType = ReturnType<(typeof t)["createCallerFactory"]>;
export const createCallerFactory = t.createCallerFactory;

/**
 * 3. ROUTER & PROCEDURE (THE IMPORTANT BIT)
 *
 * These are the pieces you use to build your tRPC API. You should import these a lot in the
 * "/src/server/api/routers" directory.
 */

/**
 * This is how you create new routers and sub-routers in your tRPC API.
 *
 * @see https://trpc.io/docs/router
 */
export const createTRPCRouter = t.router;

/**
 * Middleware for timing procedure execution and adding an artificial delay in development.
 *
 * You can remove this if you don't like it, but it can help catch unwanted waterfalls by simulating
 * network latency that would occur in production but not in local development.
 */
const timingMiddleware = t.middleware(async ({ next, path }) => {
  const start = Date.now();

  if (t._config.isDev) {
    // artificial delay in dev
    const waitMs = Math.floor(Math.random() * 400) + 100;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  const result = await next();

  const end = Date.now();
  console.log(`[TRPC] ${path} took ${end - start}ms to execute`);

  return result;
});

/**
 * Public (unauthenticated) procedure
 *
 * This is the base piece you use to build new queries and mutations on your tRPC API. It does not
 * guarantee that a user querying is authorized, but you can still access user session data if they
 * are logged in.
 */
export const publicProcedure = t.procedure.use(timingMiddleware);

export const protectedProcedure = t.procedure
  .use(timingMiddleware)
  .use(({ ctx, next }) => {
    if (!ctx.session || !ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }

    return next({
      ctx: {
        session: { ...ctx.session },
        user: { ...ctx.user },
      },
    });
  });
