import type { FastifyInstance } from "fastify";

export default async function healthRoutes(fastify: FastifyInstance) {
  fastify.get("/", async (request, reply) => {
    return { message: "nodedrive server running" };
  });

  fastify.get("/health", async (request, reply) => {
    return { status: "OK" };
  });
}
