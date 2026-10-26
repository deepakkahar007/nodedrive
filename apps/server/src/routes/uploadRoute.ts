import type { FastifyInstance } from "fastify";
import { createFiles, listUserOrganizations } from "@repo/drizzle";
import {
  createStorageKey,
  getObjectMetadata,
  getPresignedUploadUrl,
  type ObjectMetadata,
} from "@repo/storage";

const MAX_FILES = 20;
const MAX_FILE_BYTES = 5 * 1024 * 1024 * 1024;
const DEFAULT_MIME_TYPE = "application/octet-stream";

type PresignFile = { name: string; size: number; mimeType?: string };
type PresignBody = { organizationId?: string | null; files?: PresignFile[] };
type CompleteFile = { key: string; name: string; mimeType?: string };
type CompleteBody = { organizationId?: string | null; files?: CompleteFile[] };

function splitFileName(fileName: string) {
  const safeName = fileName.trim().slice(0, 255) || "file";
  const dot = safeName.lastIndexOf(".");

  if (dot <= 0) {
    return { name: safeName, originalName: safeName, extension: "" };
  }

  return {
    name: safeName.slice(0, dot),
    originalName: safeName,
    extension: safeName.slice(dot + 1).toLowerCase(),
  };
}

async function userCanUseOrganization(
  userId: string,
  organizationId: string | null,
): Promise<boolean> {
  if (!organizationId) return true;

  const organizations = await listUserOrganizations(userId);
  return organizations.some(
    (organization) => organization.id === organizationId,
  );
}

function storageScope(userId: string, organizationId: string | null): string {
  return organizationId
    ? `organizations/${organizationId}/`
    : `users/${userId}/`;
}

function isValidKey(key: unknown): key is string {
  return (
    typeof key === "string" &&
    key.length > 0 &&
    key.length <= 255 &&
    !key.includes("..")
  );
}

export default async function uploadRoute(fastify: FastifyInstance) {
  fastify.post("/uploads/presign", async (request, reply) => {
    const userId = request.user?.id;

    if (!userId) {
      return reply.code(401).send({ message: "Unauthorized" });
    }

    const body = request.body as PresignBody | null;
    const rawOrganizationId = body?.organizationId ?? null;
    const files = body?.files;

    if (rawOrganizationId !== null && typeof rawOrganizationId !== "string") {
      return reply.code(400).send({ message: "Invalid organization" });
    }

    const organizationId = rawOrganizationId?.trim() || null;

    if (!Array.isArray(files) || files.length === 0) {
      return reply.code(400).send({ message: "No files provided" });
    }

    if (files.length > MAX_FILES) {
      return reply
        .code(400)
        .send({ message: `Upload at most ${MAX_FILES} files at a time` });
    }

    for (const file of files) {
      if (
        typeof file?.name !== "string" ||
        file.name.trim().length === 0 ||
        !Number.isInteger(file.size) ||
        file.size <= 0 ||
        file.size > MAX_FILE_BYTES ||
        (file.mimeType !== undefined && typeof file.mimeType !== "string")
      ) {
        return reply.code(400).send({ message: "Invalid file metadata" });
      }
    }

    if (!(await userCanUseOrganization(userId, organizationId))) {
      return reply.code(403).send({ message: "Organization access denied" });
    }

    const presigned = await Promise.all(
      files.map(async (file) => {
        const contentType = file.mimeType || DEFAULT_MIME_TYPE;
        const key = createStorageKey({
          userId,
          organizationId,
          fileName: file.name,
        });
        const result = await getPresignedUploadUrl({ key, contentType });

        return {
          key,
          url: result.url,
          headers: result.headers ?? { "Content-Type": contentType },
        };
      }),
    );

    return { files: presigned };
  });

  fastify.post("/uploads/complete", async (request, reply) => {
    const userId = request.user?.id;

    if (!userId) {
      return reply.code(401).send({ message: "Unauthorized" });
    }

    const body = request.body as CompleteBody | null;
    const rawOrganizationId = body?.organizationId ?? null;
    const files = body?.files;

    if (rawOrganizationId !== null && typeof rawOrganizationId !== "string") {
      return reply.code(400).send({ message: "Invalid organization" });
    }

    const organizationId = rawOrganizationId?.trim() || null;

    if (!Array.isArray(files) || files.length === 0) {
      return reply.code(400).send({ message: "No files provided" });
    }

    if (files.length > MAX_FILES) {
      return reply
        .code(400)
        .send({ message: `Complete at most ${MAX_FILES} files at a time` });
    }

    if (!(await userCanUseOrganization(userId, organizationId))) {
      return reply.code(403).send({ message: "Organization access denied" });
    }

    const scope = storageScope(userId, organizationId);
    const keys = new Set<string>();

    for (const file of files) {
      if (
        !isValidKey(file?.key) ||
        !file.key.startsWith(scope) ||
        keys.has(file.key) ||
        typeof file.name !== "string" ||
        file.name.trim().length === 0 ||
        (file.mimeType !== undefined && typeof file.mimeType !== "string")
      ) {
        return reply.code(400).send({ message: "Invalid upload key" });
      }

      keys.add(file.key);
    }

    const rows = [];

    for (const file of files) {
      let metadata: ObjectMetadata;

      try {
        metadata = await getObjectMetadata(file.key);
      } catch {
        return reply
          .code(400)
          .send({ message: `${file.name} was not uploaded` });
      }

      if (metadata.size <= 0 || metadata.size > MAX_FILE_BYTES) {
        return reply.code(400).send({ message: `${file.name} is invalid` });
      }

      const { name, originalName, extension } = splitFileName(file.name);

      rows.push({
        userId,
        organizationId,
        storageKey: file.key,
        name,
        originalName,
        extension,
        size: metadata.size,
        mimeType: metadata.contentType || file.mimeType || DEFAULT_MIME_TYPE,
      });
    }

    return { files: await createFiles(rows) };
  });
}
