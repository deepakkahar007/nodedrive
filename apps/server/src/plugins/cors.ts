import fp from "fastify-plugin";
import cors from "@fastify/cors";
import { serverEnv } from "@repo/env";

export default fp(async (fastify) => {
  await fastify.register(cors, {
    origin: serverEnv.CLIENT_URL,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });
});
