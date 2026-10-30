import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

// This package owns the .env. Consumers (server, drizzle-kit, better-auth CLI)
// run from other directories where Bun/Node won't auto-load it, so load it here.
// import.meta.dirname avoids `new URL(..., import.meta.url)`, which bundlers
// (Turbopack) rewrite into a foreign-realm URL that fileURLToPath rejects.
const here = import.meta.dirname ?? dirname(fileURLToPath(import.meta.url));
for (const file of [".env.local", ".env"]) {
  const path = resolve(here, "..", file);
  if (existsSync(/* turbopackIgnore: true */ path)) process.loadEnvFile(path);
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
    CLIENT_URL: z.string(),
    REDIS_URL: z.string(),
    GOOGLE_CLIENT_ID: z.string(),
    GOOGLE_CLIENT_SECRET: z.string(),
    S3_ENDPOINT: z.string().url().optional(),
    S3_BUCKET: z.string(),
    AWS_REGION: z.string().default("us-east-1"),
    AWS_ACCESS_KEY_ID: z.string().optional(),
    AWS_SECRET_ACCESS_KEY: z.string().optional(),
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
