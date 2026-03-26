import {
  defaultShouldDehydrateQuery,
  MutationCache,
  QueryCache,
  QueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import SuperJSON from "superjson";

let isRedirecting = false;

function handleUnauthorized(error: unknown) {
  if (isRedirecting) return;
  if (typeof window === "undefined") return;
  if (window.location.pathname === "/admin/login") return;

  const err = error as { data?: { code?: string } };
  if (err?.data?.code === "UNAUTHORIZED") {
    isRedirecting = true;
    toast.error("Session expired. Please login again.");
    window.location.href = "/admin/login";
  }
}

export const createQueryClient = () =>
  new QueryClient({
    queryCache: new QueryCache({
      onError: handleUnauthorized,
    }),
    mutationCache: new MutationCache({
      onError: handleUnauthorized,
    }),
    defaultOptions: {
      queries: {
        // With SSR, we usually want to set some default staleTime
        // above 0 to avoid refetching immediately on the client
        staleTime: 30 * 1000,
        retry: (failureCount, error) => {
          const err = error as { data?: { code?: string } };
          if (err?.data?.code === "UNAUTHORIZED") return false;
          return failureCount < 3;
        },
      },
      dehydrate: {
        serializeData: SuperJSON.serialize,
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === "pending",
        shouldRedactErrors: () => {
          // We should not catch Next.js server errors
          // as that's how Next.js detects dynamic pages
          // so we cannot redact them.
          // Next.js also automatically redacts errors for us
          // with better digests.
          return false;
        },
      },
      hydrate: {
        deserializeData: SuperJSON.deserialize,
      },
    },
  });
