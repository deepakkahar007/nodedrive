import { serverEnv } from "@repo/env";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { relations } from "./models/relations";

const client = postgres(serverEnv.DATABASE_URL);

export const db = drizzle({ client, relations });
