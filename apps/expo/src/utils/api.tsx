import { useState } from "react";
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from "@tanstack/react-query";
import { httpBatchLink, loggerLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import superjson from "superjson";
import { router } from "expo-router";

import type { AppRouter } from "@acme/api";

import { getBaseUrl } from "./base-url";
import { deleteSecurely, getToken } from "./session-store";

/**
 * A set of typesafe hooks for consuming your API.
 */
export const api = createTRPCReact<AppRouter>();
export { type RouterInputs, type RouterOutputs } from "@acme/api";

/**
 * A wrapper for your app that provides the TRPC context.
 * Use only in _app.tsx
 */
export function TRPCProvider(props: { children: React.ReactNode }) {
  const [queryClient] = useState(() => {
    const handleUnauthorized = (error: any) => {
      if (error?.data?.code === "UNAUTHORIZED") {
        console.log('Global: Session expired, clearing auth and redirecting');
        deleteSecurely("appUser").catch(console.error);
        deleteSecurely("session_token").catch(console.error);
        router.replace("/(auth)");
      }
    };

    return new QueryClient({
      queryCache: new QueryCache({
        onError: handleUnauthorized,
      }),
      mutationCache: new MutationCache({
        onError: handleUnauthorized,
      }),
    });
  });
  const [trpcClient] = useState(() =>
    api.createClient({
      links: [
        loggerLink({
          enabled: (opts) =>
            process.env.NODE_ENV === "development" ||
            (opts.direction === "down" && opts.result instanceof Error),
          colorMode: "ansi",
        }),
        httpBatchLink({
          transformer: superjson,
          url: `${getBaseUrl()}/api/trpc`,
          async headers() {
            const headers = new Map<string, string>();
            headers.set("x-trpc-source", "expo-react");

            const token = await getToken();
            if (token) headers.set("Authorization", `Bearer ${token}`);

            return Object.fromEntries(headers);
          },
        }),
      ],
    }),
  );

  console.log({ url: `${getBaseUrl()}/api/trpc` });

  return (
    <api.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {props.children}
      </QueryClientProvider>
    </api.Provider>
  );
}
