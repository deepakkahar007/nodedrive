import type { FastifyInstance } from "fastify";
import {
  getFileForUser,
  moveFileToFolder,
  searchFilesByName,
  shareFileWithEmail,
  updateFileForUser,
} from "@repo/drizzle";
import { redis, shareChannel } from "@repo/node-redis";
import { getPresignedDownloadUrl } from "@repo/storage";
import { isUuid } from "../lib/uuid";

type FileParams = { id: string };
type SearchQuery = { q?: string };
type UpdateFileBody = {
  starred?: boolean;
  trashed?: boolean;
  folderId?: string | null;
};
type ShareFileBody = { email?: string };

const isInvalidId = (id: string) => !isUuid(id);

export default async function fileRoute(fastify: FastifyInstance) {
  fastify.get<{ Querystring: SearchQuery }>(
    "/files/search",
    async (request, reply) => {
      const userId = request.user?.id;

      if (!userId) {
        return reply.code(401).send({ message: "Unauthorized" });
      }

      const query =
        typeof request.query.q === "string" ? request.query.q.trim() : "";

      if (query.length > 100) {
        return reply.code(400).send({ message: "Search is too long" });
      }

      if (!query) return { files: [] };

      return { files: await searchFilesByName({ userId, query }) };
    },
  );

  fastify.get<{ Params: FileParams }>(
    "/files/:id/download",
    async (request, reply) => {
      const userId = request.user?.id;

      if (!userId) {
        return reply.code(401).send({ message: "Unauthorized" });
      }

      if (isInvalidId(request.params.id)) {
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

  fastify.post<{ Params: FileParams; Body: ShareFileBody }>(
    "/files/:id/share",
    async (request, reply) => {
      const userId = request.user?.id;

      if (!userId) {
        return reply.code(401).send({ message: "Unauthorized" });
      }

      if (isInvalidId(request.params.id)) {
        return reply.code(400).send({ message: "Invalid file id" });
      }

      const email =
        typeof request.body?.email === "string"
          ? request.body.email.trim()
          : "";

      if (
        !email ||
        email.length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      ) {
        return reply.code(400).send({ message: "Enter a valid email address" });
      }

      const result = await shareFileWithEmail({
        fileId: request.params.id,
        userId,
        email,
      });

      if ("error" in result) {
        switch (result.error) {
          case "file-not-found":
            return reply.code(404).send({ message: "File not found" });
          case "user-not-found":
            return reply
              .code(404)
              .send({ message: "No user found with that email" });
          case "self":
            return reply
              .code(400)
              .send({ message: "You cannot share a file with yourself" });
          case "already-shared":
            return reply
              .code(409)
              .send({ message: "This file is already shared with that user" });
        }
      }

      // The DB is the source of truth; a missed publish is caught on the next connect.
      redis
        .publish(shareChannel(result.sharedWith.id), request.params.id)
        .catch((error) => request.log.error(error));

      return { sharedWith: result.sharedWith };
    },
  );

  fastify.patch<{ Params: FileParams; Body: UpdateFileBody }>(
    "/files/:id",
    async (request, reply) => {
      const userId = request.user?.id;

      if (!userId) {
        return reply.code(401).send({ message: "Unauthorized" });
      }

      if (isInvalidId(request.params.id)) {
        return reply.code(400).send({ message: "Invalid file id" });
      }

      const body = (request.body ?? {}) as UpdateFileBody;
      const hasFolder = "folderId" in body;
      const hasFlags = body.starred !== undefined || body.trashed !== undefined;

      if (hasFolder && hasFlags) {
        return reply.code(400).send({ message: "Send one change at a time" });
      }

      if (hasFolder) {
        const folderId = body.folderId ?? null;

        if (
          folderId !== null &&
          (typeof folderId !== "string" || !isUuid(folderId))
        ) {
          return reply.code(400).send({ message: "Invalid folder id" });
        }

        const result = await moveFileToFolder({
          fileId: request.params.id,
          userId,
          folderId,
        });

        if ("error" in result) {
          return reply
            .code(404)
            .send({
              message:
                result.error === "folder-not-found"
                  ? "Folder not found"
                  : "File not found",
            });
        }

        return { file: result.file };
      }

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
