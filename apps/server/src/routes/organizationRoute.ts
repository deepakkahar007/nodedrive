import type { FastifyInstance } from "fastify";
import { listUserOrganizations } from "@repo/drizzle";

/** Organizations the current user belongs to, with their access level. */
export default async function organizationRoute(fastify: FastifyInstance) {
  fastify.get("/organizations", async (request, reply) => {
    const userId = request.user?.id;

    if (!userId) {
      return reply.code(401).send({ message: "Unauthorized" });
    }

    return { organizations: await listUserOrganizations(userId) };
  });
}
