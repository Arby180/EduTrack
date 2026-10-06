import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";

import { env } from "~/env";
import * as schema from "./schema";

/**
 * Cache the database connection in development. This avoids creating a new connection on every HMR
 * update.
 */
const globalForDb = globalThis as unknown as {
  postgresClient: ReturnType<typeof postgres> | undefined;
};

export const client =
  globalForDb.postgresClient ??
  postgres(env.DATABASE_URL, {
    prepare: false,
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
    ssl: "require",
  });
if (env.NODE_ENV !== "production") globalForDb.postgresClient = client;

export const db = drizzle(client, { schema });
