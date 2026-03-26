import type { TRPCClientError } from "@trpc/client";
import type {
  inferProcedureInput,
  inferProcedureOutput,
  inferRouterInputs,
  inferRouterOutputs,
} from "@trpc/server";

import type { AppRouter } from "./root";
import { appRouter } from "./root";
import { createCallerFactory, createTRPCContext } from "./trpc";

/**
 * Create a server-side caller for the tRPC API
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
type Caller = ReturnType<typeof createCallerFactory>;
const createCaller = createCallerFactory(appRouter) as Caller;

/**
 * Inference helpers for input types
 */
type RouterInputs = inferRouterInputs<AppRouter>;

/**
 * Inference helpers for output types
 */
type RouterOutputs = inferRouterOutputs<AppRouter>;

export { createTRPCContext, appRouter, createCaller };
export type { AppRouter, RouterInputs, RouterOutputs, TRPCClientError };
