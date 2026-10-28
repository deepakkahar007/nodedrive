import type { FastifyInstance } from "fastify";
import { createFolder, getFolderForUser } from "@repo/drizzle";
import { isUuid } from "../lib/uuid";

type CreateFolderBody = { name?: unknown; parentId?: unknown };

export default async function folderRoute(fastify: FastifyInstance) {
  fastify.post<{ Body: CreateFolderBody }>(
    "/folders",
    async (request, reply) => {
      const userId = request.user?.id;

      if (!userId) {
        return reply.code(401).send({ message: "Unauthorized" });
      }

      const body = request.body ?? {};
      const name = typeof body.name === "string" ? body.name.trim() : "";
      const rawParentId = body.parentId ?? null;

      if (!name || name.length > 100) {
        return reply
          .code(400)
          .send({ message: "Enter a folder name (100 characters max)" });
      }

      if (
        rawParentId !== null &&
        (typeof rawParentId !== "string" || !isUuid(rawParentId))
      ) {
        return reply.code(400).send({ message: "Invalid parent folder" });
      }

      const parentId = rawParentId || null;

      if (parentId) {
        const parent = await getFolderForUser({ folderId: parentId, userId });

        if (!parent) {
          return reply.code(404).send({ message: "Parent folder not found" });
        }
      }

      const folder = await createFolder({ userId, name, parentId });

      return reply.code(201).send({ folder });
    },
  );
}
