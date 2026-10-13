import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

// This package owns the .env. Consumers (server, drizzle-kit, better-auth CLI)
// run from other directories where Bun/Node won't auto-load it, so load it here.
for (const file of [".env.local", ".env"]) {
  const path = fileURLToPath(new URL(`../${file}`, import.meta.url));
  if (existsSync(path)) process.loadEnvFile(path);
}

export const serverEnv = createEnv({
  server: {
    POSTGRES_USER: z.string(),
    POSTGRES_PASSWORD: z.string(),
    POSTGRES_HOST: z.string(),
    POSTGRES_PORT: z.coerce.number(),
    POSTGRES_NAME: z.string(),
    BETTER_AUTH_SECRET: z.string(),
    BETTER_AUTH_URL: z.string(),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
  createFinalSchema: (schema) =>
    z.object(schema).transform((val) => {
      const {
        POSTGRES_USER,
        POSTGRES_PASSWORD,
        POSTGRES_HOST,
        POSTGRES_PORT,
        POSTGRES_NAME,
        ...rest
      } = val;

      return {
        ...rest,
        DATABASE_URL: `postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_NAME}`,
      };
    }),
});
