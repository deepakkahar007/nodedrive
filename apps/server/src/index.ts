import Fastify from "fastify";
import { envToLogger } from "./middleware/pinoLogger";
import { randomUUID } from "node:crypto";
import cors from "@fastify/cors";

const fastify = Fastify({
  logger: envToLogger["development"] ?? true,
  genReqId: () => randomUUID(),
});

await fastify.register(cors, {});

fastify.get("/", (request, reply) => {
  reply.send({ message: "nodedrive server running" });
});

fastify.get("/health", (request, reply) => {
  reply.send({ status: "OK" });
});

fastify.listen({ port: 3001 }, (err, address) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  // Server is now listening on ${address}
});
