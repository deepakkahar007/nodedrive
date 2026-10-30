import Fastify, { type FastifyServerOptions } from "fastify";
import { randomUUID } from "node:crypto";
import { checkDatabaseConnection } from "@repo/drizzle";
import { checkRedisConnection } from "@repo/node-redis";
import { checkStorageConnection } from "@repo/storage";
import { getLoggerConfig } from "./config/logger";
import corsPlugin from "./plugins/cors";
import authGuard from "./plugins/authGuard";
import authPlugin from "./plugins/auth";
import fileRoute from "./routes/fileRoute";
import folderRoute from "./routes/folderRoute";
import healthRoutes from "./routes/healthRoute";
import notificationRoute from "./routes/notificationRoute";
import organizationRoute from "./routes/organizationRoute";
import uploadRoute from "./routes/uploadRoute";

export async function buildApp(options: FastifyServerOptions = {}) {
  const fastify = Fastify({
    logger: getLoggerConfig(),
    genReqId: () => randomUUID(),
    ...options,
  });

  // Register Plugins
  await fastify.register(corsPlugin);
  await fastify.register(authGuard);
  await fastify.register(authPlugin);

  // Register Routes
  await fastify.register(healthRoutes);
  await fastify.register(organizationRoute);
  await fastify.register(uploadRoute);
  await fastify.register(fileRoute);
  await fastify.register(folderRoute);
  await fastify.register(notificationRoute);

  return fastify;
}

/** postgres.js wraps multi-address connect failures in an empty AggregateError. */
function errorMessage(err: unknown): string {
  if (err instanceof AggregateError) {
    return err.errors.map(errorMessage).join("; ") || err.name;
  }
  if (err instanceof Error) {
    return err.message || err.name;
  }
  return String(err);
}

// check postgres, minio and redis connections
async function checkServices(): Promise<void> {
  const checks = {
    postgres: checkDatabaseConnection,
    minio: checkStorageConnection,
    redis: checkRedisConnection,
  };

  const results = await Promise.allSettled(
    Object.entries(checks).map(async ([name, check]) => {
      try {
        await check();
      } catch (err) {
        throw new Error(`${name}: ${errorMessage(err)}`, { cause: err });
      }
    }),
  );

  const failures = results.flatMap((result) =>
    result.status === "rejected" ? [result.reason.message] : [],
  );

  if (failures.length > 0) {
    throw new Error(`Startup checks failed -> ${failures.join("; ")}`);
  }
}

const start = async () => {
  const app = await buildApp();

  try {
    await checkServices();
    app.log.info("Postgres, MinIO and Redis connection checks passed");

    const port = Number(process.env.PORT) || 3001;
    const address = await app.listen({ port, host: "0.0.0.0" });
    app.log.info(`Server listening on ${address}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
