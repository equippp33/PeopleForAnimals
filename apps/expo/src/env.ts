import { z } from "zod";

const envSchema = z.object({
  EXPO_PUBLIC_GOOGLE_MAPS_API_KEY: z.string().min(1),
});

export const env = envSchema.parse({
  EXPO_PUBLIC_GOOGLE_MAPS_API_KEY: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
});
