import { serverEnv } from "@repo/env";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { relations } from "./models/relations";

const client = postgres(serverEnv.DATABASE_URL);

export const db = drizzle({ client, relations });

export * from "./db/query";

// database health check
export async function checkDatabaseConnection(): Promise<void> {
  await client`select 1`;
}
