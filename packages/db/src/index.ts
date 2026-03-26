import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "../env";
import * as relations from "./relation";
import * as schema from "./schema";

/**
 * Cache the database connection in development. This avoids creating
 * a new connection on every HMR update.
 */
const globalForDb = globalThis as unknown as {
  conn: postgres.Sql | undefined;
};

// ⭐ Safe fallback for Docker build / Turbo build
// Avoids TS error (string | undefined)
const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://placeholder:placeholder@localhost:5432/placeholder";

export const connection = globalForDb.conn ?? postgres(databaseUrl);

if (env.NODE_ENV !== "production") globalForDb.conn = connection;

export const db = drizzle(connection, {
  schema: {
    ...schema,
    ...relations,
  },
});
