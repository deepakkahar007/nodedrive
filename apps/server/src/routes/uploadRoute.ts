import type { FastifyInstance } from "fastify";
import {
  createFiles,
  getFolderForUser,
  listUserOrganizations,
} from "@repo/drizzle";
import {
  createStorageKey,
  getObjectMetadata,
  getPresignedUploadUrl,
  type ObjectMetadata,
} from "@repo/storage";
import { isUuid } from "../lib/uuid";

const MAX_FILES = 20;
const MAX_FILE_BYTES = 5 * 1024 * 1024 * 1024;
const DEFAULT_MIME_TYPE = "application/octet-stream";

type PresignFile = { name: string; size: number; mimeType?: string };
type PresignBody = {
  organizationId?: string | null;
  folderId?: string | null;
  files?: PresignFile[];
};
type CompleteFile = { key: string; name: string; mimeType?: string };
type CompleteBody = {
  organizationId?: string | null;
  folderId?: string | null;
  files?: CompleteFile[];
};
type TargetBody = { organizationId?: unknown; folderId?: unknown } | null;
type UploadTarget = { organizationId: string | null; folderId: string | null };
type TargetFailure = { status: 400 | 403; message: string };

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

type FolderResolution = { folderId: string | null } | { error: string };

async function resolveFolderId(input: {
  userId: string;
  rawFolderId: unknown;
  organizationId: string | null;
}): Promise<FolderResolution> {
  const raw = input.rawFolderId ?? null;

  if (raw === null) return { folderId: null };

  if (typeof raw !== "string" || !isUuid(raw)) {
    return { error: "Invalid folder" };
  }

  if (input.organizationId) {
    return { error: "Folders are personal only" };
  }

  const folder = await getFolderForUser({
    folderId: raw,
    userId: input.userId,
  });

  return folder ? { folderId: raw } : { error: "Folder not found" };
}

/** Validates the org and folder target shared by presign and complete. */
async function resolveTarget(
  userId: string,
  body: TargetBody,
): Promise<UploadTarget | TargetFailure> {
  const rawOrganizationId = body?.organizationId ?? null;

  if (rawOrganizationId !== null && typeof rawOrganizationId !== "string") {
    return { status: 400, message: "Invalid organization" };
  }

  const organizationId = rawOrganizationId?.trim() || null;

  if (!(await userCanUseOrganization(userId, organizationId))) {
    return { status: 403, message: "Organization access denied" };
  }

  const folder = await resolveFolderId({
    userId,
    rawFolderId: body?.folderId,
    organizationId,
  });

  if ("error" in folder) return { status: 400, message: folder.error };

  return { organizationId, folderId: folder.folderId };
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
    const files = body?.files;

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

    const target = await resolveTarget(userId, body);

    if ("message" in target) {
      return reply.code(target.status).send({ message: target.message });
    }

    const { organizationId, folderId } = target;
    const presigned = await Promise.all(
      files.map(async (file) => {
        const contentType = file.mimeType || DEFAULT_MIME_TYPE;
        const key = createStorageKey({
          userId,
          organizationId,
          folderId,
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
    const files = body?.files;

    if (!Array.isArray(files) || files.length === 0) {
      return reply.code(400).send({ message: "No files provided" });
    }

    if (files.length > MAX_FILES) {
      return reply
        .code(400)
        .send({ message: `Complete at most ${MAX_FILES} files at a time` });
    }

    const target = await resolveTarget(userId, body);

    if ("message" in target) {
      return reply.code(target.status).send({ message: target.message });
    }

    const { organizationId, folderId } = target;
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

      rows.push({
        userId,
        organizationId,
        folderId,
        storageKey: file.key,
        originalName: file.name.trim().slice(0, 255) || "file",
        size: metadata.size,
        mimeType: metadata.contentType || file.mimeType || DEFAULT_MIME_TYPE,
      });
    }

    return { files: await createFiles(rows) };
  });
}
