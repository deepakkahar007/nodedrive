import Fastify, { type FastifyServerOptions } from "fastify";
import { randomUUID } from "node:crypto";
import { getLoggerConfig } from "./config/logger";
import corsPlugin from "./plugins/cors";
import authGuard from "./plugins/authGuard";
import authPlugin from "./plugins/auth";
import healthRoutes from "./routes/healthRoute";
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
  await fastify.register(uploadRoute);

  return fastify;
}

const start = async () => {
  const app = await buildApp();

  try {
    const port = Number(process.env.PORT) || 3001;
    const address = await app.listen({ port, host: "0.0.0.0" });
    app.log.info(`Server listening on ${address}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
