import { cookies } from "next/headers";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@acme/db";
import {
  batchesTable,
  circlesTable,
  locationsTable,
  operationTasksTable,
} from "@acme/db/schema";

import { createTRPCRouter, publicProcedure } from "../trpc";

// Google Maps API key from environment
// Prioritize GOOGLE_MAPS_API_KEY (backend/server key) over EXPO_PUBLIC_GOOGLE_MAPS_API_KEY (mobile app key)
const GOOGLE_MAPS_API_KEY =
  process.env.GOOGLE_MAPS_API_KEY ||
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

// Define the volunteer schema
const volunteerSchema = z.object({
  name: z.string(),
  phoneNumber: z.string(),
});

const circleSchema = z.object({
  name: z.string(),
  coordinates: z.object({
    lat: z.number(),
    lng: z.number(),
  }),
  volunteers: z.array(volunteerSchema).default([]),
});

const coordinatesSchema = z.object({
  lat: z.number(),
  lng: z.number(),
});

const locationInputSchema = z.object({
  name: z.string(),
  type: z.string(),
  area: z.string(),
  notes: z.string().optional(),
  coordinates: coordinatesSchema,
  circles: z.array(circleSchema),
});

const UpdateLocationInput = z.object({
  id: z.string(),
  data: locationInputSchema,
});

// helper for extracting locality from address components
function extractLocality(components: any[]) {
  // Try to find the most relevant name in this order:
  const types = [
    "neighborhood",
    "sublocality_level_1",
    "sublocality",
    "locality",
    "administrative_area_level_3",
    "administrative_area_level_2",
  ];

  for (const type of types) {
    const component = components.find((comp) => comp.types.includes(type));
    if (component) {
      // Return the first available localized name in this order:
      // 1. The component's localized name (if available in the requested language)
      // 2. The component's long name
      return component.long_name;
    }
  }

  // Fallback to the first component if nothing else matches
  return components[0]?.long_name || "";
}

// --- Helper to transliterate English name into target Indic script using Google Input Tools
async function transliterateName(
  text: string,
  targetLang: "hi" | "te",
): Promise<string> {
  try {
    // Google Input Tools transliteration endpoint
    const itc = targetLang === "hi" ? "hi-t-i0-und" : "te-t-i0-und";
    const url = `https://inputtools.google.com/request?text=${encodeURIComponent(text)}&itc=${itc}&num=1`;
    const res = await fetch(url);
    const json = (await res.json()) as any;
    // Expected structure: ["SUCCESS", [[original, [translit1, …], …]]]
    const candidate = json?.[1]?.[0]?.[1]?.[0];
    if (typeof candidate === "string" && candidate.length > 0) {
      return candidate;
    }
    return text;
  } catch (e) {
    console.error("Transliteration failed", e);
    return text;
  }
}

// Helper to translate arbitrary text into Hindi / Telugu using Google Translate unofficial endpoint
async function translateText(
  text: string | undefined,
  targetLang: "hi" | "te",
): Promise<string | undefined> {
  if (!text) return undefined;
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetch(url);
    const json = (await res.json()) as any;
    return json?.[0]?.[0]?.[0] ?? text;
  } catch (e) {
    console.error("Translation failed", e);
    return text;
  }
}

// -- end helpers --

// Fallback distance calculation using Haversine formula and simple duration estimate
function buildFallbackDistanceResult(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const R = 6371e3; // meters
  const φ1 = toRad(origin.lat);
  const φ2 = toRad(destination.lat);
  const Δφ = toRad(destination.lat - origin.lat);
  const Δλ = toRad(destination.lng - origin.lng);

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distanceInMeters = Math.round(R * c);
  const distanceInKm = distanceInMeters / 1000;

  // Assume avg city speed 30 km/h for duration estimate
  const avgSpeedMetersPerSecond = (30 * 1000) / 3600;
  const rawSeconds = distanceInMeters / avgSpeedMetersPerSecond;
  const durationSeconds = Math.max(60, Math.round(rawSeconds)); // at least 1 minute

  const distanceText = `${distanceInKm.toFixed(1)} km`;

  const totalMinutes = Math.round(durationSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  let durationText: string;
  if (hours > 0 && minutes > 0) {
    durationText = `${hours} hr ${minutes} min`;
  } else if (hours > 0) {
    durationText = `${hours} hr`;
  } else {
    durationText = `${minutes} min`;
  }

  return {
    distance: {
      text: distanceText,
      value: distanceInMeters,
    },
    duration: {
      text: durationText,
      value: durationSeconds,
    },
  } as const;
}

export const locationRouter = createTRPCRouter({
  getAllLocations: publicProcedure.query(async ({ ctx }) => {
    // Aggregate capture/release statistics by location across automatic operation tasks
    const aggregateStats = await ctx.db
      .select({
        locationId: operationTasksTable.locationId,
        lastCapture: sql`MAX(${batchesTable.endTime})`,
        totalCaptured: sql<number>`COALESCE(SUM(${batchesTable.totalDogs}),0)`,
        lastRelease: sql`MAX(${batchesTable.release_date})`,
        totalReleased: sql<number>`COALESCE(SUM(${batchesTable.released_dogs}),0)`,
      })
      .from(batchesTable)
      .innerJoin(
        operationTasksTable,
        eq(batchesTable.operationTaskId, operationTasksTable.id),
      )
      .where(eq(operationTasksTable.isAutomatic, true))
      .groupBy(operationTasksTable.locationId);

    const statsMap = new Map<string, (typeof aggregateStats)[number]>();
    aggregateStats.forEach((s) => {
      if (s.locationId) statsMap.set(s.locationId, s);
    });
    const locations = await ctx.db.query.locationsTable.findMany({
      with: {
        circles: {
          with: {
            operationTasks: {
              where: eq(operationTasksTable.isAutomatic, true),
            },
          },
        },
      },
      orderBy: (locations, { desc }) => [desc(locations.createdAt)],
    });

    // Separate locations by type and attach aggregated stats
    const enhance = (location: (typeof locations)[number]) => {
      const stat = statsMap.get(location.id);
      return {
        ...location,
        lastCaptureDate: stat?.lastCapture ?? null,
        dogsCaptured: stat?.totalCaptured ?? 0,
        lastReleaseDate: stat?.lastRelease ?? null,
        dogsReleased: stat?.totalReleased ?? 0,
        circles: location.circles.map((circle) => ({
          name: circle.name,
          coordinates: circle.coordinates,
          volunteers: circle.volunteers as {
            name: string;
            phoneNumber: string;
          }[],
          operationTask: circle.operationTasks[0],
        })),
      };
    };

    return {
      capture: locations.filter((loc) => loc.type === "capture").map(enhance),
      release: locations.filter((loc) => loc.type === "release").map(enhance),
    };
  }),

  createLocation: publicProcedure
    .input(locationInputSchema)
    .mutation(async ({ ctx, input }) => {
      const locHi = await transliterateName(input.name, "hi");
      const locTe = await transliterateName(input.name, "te");

      const location = await ctx.db
        .insert(locationsTable)
        .values({
          name: input.name,
          hi_name: locHi,
          te_name: locTe,
          hi_notes: await translateText(input.notes, "hi"),
          te_notes: await translateText(input.notes, "te"),
          type: input.type,
          area: input.area,
          notes: input.notes,
          coordinates: input.coordinates,
        })
        .returning();

      if (!location[0]) {
        throw new Error("Failed to create location");
      }

      for (const circleData of input.circles) {
        const hiName = await transliterateName(circleData.name, "hi");
        const teName = await transliterateName(circleData.name, "te");

        const circle = await ctx.db
          .insert(circlesTable)
          .values({
            locationId: location[0].id,
            name: circleData.name,
            hiCircleName: hiName,
            teCircleName: teName,
            coordinates: circleData.coordinates,
            volunteers: await Promise.all(
              circleData.volunteers.map(async (vol) => ({
                ...vol,
                hiName: await transliterateName(vol.name, "hi"),
                teName: await transliterateName(vol.name, "te"),
              })),
            ),
          })
          .returning();

        if (!circle[0]) continue;

        await ctx.db.insert(operationTasksTable).values({
          taskType: input.type,
          locationId: location[0].id,
          circleId: circle[0].id,
          isAutomatic: true,
          status: "pending",
        });
      }

      return location[0];
    }),

  updateLocation: publicProcedure
    .input(UpdateLocationInput)
    .mutation(async ({ ctx, input }) => {
      const location = await ctx.db
        .update(locationsTable)
        .set({
          name: input.data.name,
          hi_name: await transliterateName(input.data.name, "hi"),
          te_name: await transliterateName(input.data.name, "te"),
          hi_notes: await translateText(input.data.notes, "hi"),
          te_notes: await translateText(input.data.notes, "te"),
          type: input.data.type,
          area: input.data.area,
          notes: input.data.notes,
          coordinates: input.data.coordinates,
        })
        .where(eq(locationsTable.id, input.id))
        .returning();

      if (!location[0]) {
        throw new Error("Failed to update location");
      }

      const existingCircles = await ctx.db.query.circlesTable.findMany({
        where: eq(circlesTable.locationId, location[0].id),
      });

      for (const circle of existingCircles) {
        await ctx.db
          .delete(operationTasksTable)
          .where(
            and(
              eq(operationTasksTable.locationId, location[0].id),
              eq(operationTasksTable.circleId, circle.id),
            ),
          );
      }

      await ctx.db
        .delete(circlesTable)
        .where(eq(circlesTable.locationId, location[0].id));

      for (const circleData of input.data.circles) {
        const hiName = await transliterateName(circleData.name, "hi");
        const teName = await transliterateName(circleData.name, "te");

        const circle = await ctx.db
          .insert(circlesTable)
          .values({
            locationId: location[0].id,
            name: circleData.name,
            hiCircleName: hiName,
            teCircleName: teName,
            coordinates: circleData.coordinates,
            volunteers: await Promise.all(
              circleData.volunteers.map(async (vol) => ({
                ...vol,
                hiName: await transliterateName(vol.name, "hi"),
                teName: await transliterateName(vol.name, "te"),
              })),
            ),
          })
          .returning();

        if (!circle[0]) continue;

        await ctx.db.insert(operationTasksTable).values({
          taskType: input.data.type,
          locationId: location[0].id,
          circleId: circle[0].id,
          isAutomatic: true,
          status: "pending",
        });
      }

      return location[0];
    }),

  getLocationById: publicProcedure
    .input(z.string())
    .query(async ({ ctx, input }) => {
      const location = await ctx.db.query.locationsTable.findFirst({
        where: eq(locationsTable.id, input),
        with: {
          circles: {
            with: {
              operationTasks: {
                where: eq(operationTasksTable.isAutomatic, true),
              },
            },
          },
        },
      });

      if (!location) return null;

      return {
        ...location,
        circles: location.circles.map((circle) => ({
          name: circle.name,
          hiCircleName: circle.hiCircleName,
          teCircleName: circle.teCircleName,
          coordinates: circle.coordinates,
          volunteers: circle.volunteers as {
            name: string;
            phoneNumber: string;
          }[],
          operationTask: circle.operationTasks[0],
        })),
      };
    }),

  deleteLocation: publicProcedure
    .input(z.string())
    .mutation(async ({ ctx, input }) => {
      const circles = await ctx.db.query.circlesTable.findMany({
        where: eq(circlesTable.locationId, input),
      });

      for (const circle of circles) {
        await ctx.db
          .delete(operationTasksTable)
          .where(
            and(
              eq(operationTasksTable.locationId, input),
              eq(operationTasksTable.circleId, circle.id),
            ),
          );
      }

      await ctx.db
        .delete(circlesTable)
        .where(eq(circlesTable.locationId, input));

      return await ctx.db
        .delete(locationsTable)
        .where(eq(locationsTable.id, input));
    }),

  reverseGeocode: publicProcedure
    .input(
      z.object({
        lat: z.number(),
        lng: z.number(),
      }),
    )
    .mutation(async ({ input }) => {
      const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_BACKEND_KEY;

      if (!GOOGLE_MAPS_API_KEY) {
        throw new Error("Google Maps API key is not configured");
      }

      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${input.lat},${input.lng}&key=${GOOGLE_MAPS_API_KEY}`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = (await response.json()) as {
        status: string;
        error_message?: string;
        results?: { formatted_address?: string }[];
      };

      if (data.status !== "OK") {
        const errorMsg = data.error_message || data.status;
        throw new Error(`Google Maps API error: ${errorMsg}`);
      }

      const formattedAddress = data.results?.[0]?.formatted_address;

      if (!formattedAddress) {
        throw new Error("No address found for coordinates");
      }

      return { formattedAddress };
    }),

  // Calculate distance and duration using Google Maps Distance Matrix API
  calculateDistance: publicProcedure
    .input(
      z.object({
        origin: z.object({ lat: z.number(), lng: z.number() }),
        destination: z.object({ lat: z.number(), lng: z.number() }),
      }),
    )
    .mutation(async ({ input }) => {
      // FIXED: Use backend key from env
      const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_BACKEND_KEY;

      if (!GOOGLE_MAPS_API_KEY) {
        throw new Error("Google Maps API key is not configured");
      }

      const { origin, destination } = input;

      try {
        const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin.lat},${origin.lng}&destinations=${destination.lat},${destination.lng}&key=${GOOGLE_MAPS_API_KEY}`;

        const response = await fetch(url, {
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = (await response.json()) as {
          status: string;
          error_message?: string;
          rows?: {
            elements?: {
              status: string;
              distance: { text: string; value: number };
              duration: { text: string; value: number };
            }[];
          }[];
        };

        console.log("Google Maps API Response:", JSON.stringify(data, null, 2));

        const element = data.rows?.[0]?.elements?.[0];

        if (data.status === "OK" && element?.status === "OK") {
          return {
            distance: {
              text: element.distance.text,
              value: element.distance.value,
            },
            duration: {
              text: element.duration.text,
              value: element.duration.value,
            },
          } as const;
        }

        const googleError =
          data.error_message ||
          element?.status ||
          data.status ||
          "UNKNOWN_ERROR";
        console.warn(
          "Google Maps Distance Matrix did not return OK status, using fallback.",
          googleError,
        );

        // Fallback to approximate haversine-based result instead of throwing
        return buildFallbackDistanceResult(origin, destination);
      } catch (error) {
        console.error("Distance calculation error, using fallback:", error);
        // As a safety net, always return a reasonable fallback instead of 500
        return buildFallbackDistanceResult(origin, destination);
      }
    }),
});
