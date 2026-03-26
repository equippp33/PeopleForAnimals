import { eq } from "drizzle-orm";
import { z } from "zod";

import { capturedDogsTable } from "@acme/db/schema";

import { createTRPCRouter, publicProcedure } from "../trpc";

// Mock data for testing
const MOCK_DOGS = [
  {
    id: "d290f1ee-6c54-4b01-90e6-d701748f0851",
    operationTaskId: "task-001",
    batchId: "BATCH-001",
    dogImageUrl: "https://images.unsplash.com/photo-1543466835-00a7907e9de1",
    gender: "Male",
    location: "Jubilee Hills",
    coordinates: { lat: 17.4324, lng: 78.4311 },
    fullAddress: "Road No. 36, Jubilee Hills, Hyderabad",
    status: "captured",
    createdAt: new Date("2024-03-27T08:30:00Z"),
    updatedAt: new Date("2024-03-27T08:30:00Z"),
  },
  {
    id: "d290f1ee-6c54-4b01-90e6-d701748f0852",
    operationTaskId: "task-001",
    batchId: "BATCH-001",
    dogImageUrl: "https://images.unsplash.com/photo-1587300003388-59208cc962cb",
    gender: "Female",
    location: "Jubilee Hills",
    coordinates: { lat: 17.4326, lng: 78.4315 },
    fullAddress: "Road No. 37, Jubilee Hills, Hyderabad",
    status: "in_treatment",
    createdAt: new Date("2024-03-27T09:15:00Z"),
    updatedAt: new Date("2024-03-27T09:15:00Z"),
  },
  {
    id: "d290f1ee-6c54-4b01-90e6-d701748f0853",
    operationTaskId: "task-001",
    batchId: "BATCH-001",
    dogImageUrl: "https://images.unsplash.com/photo-1561037404-61cd46aa615b",
    gender: "Male",
    location: "Jubilee Hills",
    coordinates: { lat: 17.4328, lng: 78.4318 },
    fullAddress: "Road No. 38, Jubilee Hills, Hyderabad",
    status: "captured",
    createdAt: new Date("2024-03-27T10:00:00Z"),
    updatedAt: new Date("2024-03-27T10:00:00Z"),
  },
];

export const dogsRouter = createTRPCRouter({
  getDogById: publicProcedure
    .input(z.object({ dogId: z.string() }))
    .query(async ({ ctx, input }) => {
      // For testing, return mock dog if ID matches
      const mockDog = MOCK_DOGS.find((dog) => dog.id === input.dogId);
      if (mockDog) return mockDog;

      const dog = await ctx.db
        .select()
        .from(capturedDogsTable)
        .where(eq(capturedDogsTable.id, input.dogId))
        .limit(1);

      return dog[0];
    }),

  getDogsByBatchId: publicProcedure
    .input(z.object({ batchId: z.string() }))
    .query(async ({ ctx, input }) => {
      // For testing, return mock dogs if batch ID matches
      if (input.batchId === "BATCH-001") {
        return MOCK_DOGS;
      }

      const dogs = await ctx.db
        .select()
        .from(capturedDogsTable)
        .where(eq(capturedDogsTable.batchId, input.batchId));

      return dogs;
    }),
});
