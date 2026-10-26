import type { FastifyInstance } from "fastify";
import { getFileForUser, updateFileForUser } from "@repo/drizzle";
import { getPresignedDownloadUrl } from "@repo/storage";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type FileParams = { id: string };
type UpdateFileBody = { starred?: boolean; trashed?: boolean };

export default async function fileRoute(fastify: FastifyInstance) {
  fastify.get<{ Params: FileParams }>(
    "/files/:id/download",
    async (request, reply) => {
      const userId = request.user?.id;

      if (!userId) {
        return reply.code(401).send({ message: "Unauthorized" });
      }

      if (!UUID_PATTERN.test(request.params.id)) {
        return reply.code(400).send({ message: "Invalid file id" });
      }

      const file = await getFileForUser({
        fileId: request.params.id,
        userId,
      });

      if (!file) {
        return reply.code(404).send({ message: "File not found" });
      }

      const result = await getPresignedDownloadUrl({
        key: file.storageKey,
        fileName: file.originalName,
      });

      return { url: result.url, name: file.originalName };
    },
  );

  fastify.patch<{ Params: FileParams; Body: UpdateFileBody }>(
    "/files/:id",
    async (request, reply) => {
      const userId = request.user?.id;

      if (!userId) {
        return reply.code(401).send({ message: "Unauthorized" });
      }

      if (!UUID_PATTERN.test(request.params.id)) {
        return reply.code(400).send({ message: "Invalid file id" });
      }

      const body = (request.body ?? {}) as UpdateFileBody;

      if (
        (body.starred !== undefined && typeof body.starred !== "boolean") ||
        (body.trashed !== undefined && typeof body.trashed !== "boolean") ||
        (body.starred === undefined && body.trashed === undefined)
      ) {
        return reply.code(400).send({ message: "Invalid update" });
      }

      const file = await updateFileForUser({
        fileId: request.params.id,
        userId,
        starred: body.starred,
        trashed: body.trashed,
      });

      if (!file) {
        return reply.code(404).send({ message: "File not found" });
      }

      return { file };
    },
  );
}
