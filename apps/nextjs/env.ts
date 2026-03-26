import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

const isDockerBuild = process.env.NEXT_BUILD === "1";

export const env = createEnv({
  shared: {},

  server: {
    DATABASE_URL: isDockerBuild ? z.string().optional() : z.string().url(),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

    MTALKZ_API_KEY: isDockerBuild ? z.string().optional() : z.string(),
    CLOUDFLARE_R2_ACCESS_KEY_ID: isDockerBuild ? z.string().optional() : z.string(),
    CLOUDFLARE_R2_SECRET_ACCESS_KEY: isDockerBuild ? z.string().optional() : z.string(),
    CLOUDFLARE_R2_ENDPOINT: isDockerBuild ? z.string().optional() : z.string(),
    CLOUDFLARE_R2_PUBLIC_URL: isDockerBuild ? z.string().optional() : z.string(),

    GOOGLE_MAPS_API_KEY: z.string().min(1).optional(),
    EXPO_PUBLIC_GOOGLE_MAPS_API_KEY: z.string().min(1).optional(),
  },

  client: {
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: z.string().min(1),
  },

  experimental__runtimeEnv: {
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
  },

  emptyStringAsUndefined: true,
  skipValidation: !!process.env.CI || !!process.env.SKIP_ENV_VALIDATION,
});
