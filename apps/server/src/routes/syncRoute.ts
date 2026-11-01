import type { FastifyInstance, FastifyReply } from "fastify";
import {
  abortUploadSession,
  attachMultipartUpload,
  commitUploadSession,
  createFolder,
  createUploadSession,
  currentCursor,
  getOwnedFile,
  getOwnedFiles,
  getUploadSession,
  insertRunLog,
  listChangesSince,
  listRunLogs,
  listSyncTree,
  minValidSeq,
  moveFileToFolder,
  ownedDeviceId,
  ownedFolderExists,
  registerDevice,
  updateFileForUser,
} from "@repo/drizzle";
import {
  abortMultipartUpload,
  createMultipartUpload,
  createStorageKey,
  deleteStoredObject,
  getPresignedDownloadUrl,
  getPresignedPartUrl,
} from "@repo/storage";
import {
  CHANGES_PAGE_SIZE,
  LOG_PAGE_SIZE,
  MULTIPART_THRESHOLD_BYTES,
  PART_SIZE_BYTES,
  TREE_PAGE_SIZE,
  UPLOAD_SESSION_TTL_MS,
  changesQuery,
  commitBody,
  deviceBody,
  downloadUrlsBody,
  folderBody,
  logsQuery,
  moveBody,
  partsBody,
  runLogBody,
  treeQuery,
  uploadBody,
  type ErrorCode,
} from "@repo/sync-protocol";
import { rateLimit } from "../lib/rate-limit";
import { isUuid } from "../lib/uuid";
import {
  finalizeStoredUpload,
  partCount,
  presignSingleUpload,
} from "../sync/uploads";

const DOWNLOAD_TTL_SECONDS = 300;
// ponytail: held polls live in this process; multi-instance needs Redis or LISTEN/NOTIFY (Phase 5)
const heldPolls = new Set<string>();
const POLL_TICK_MS = 1000;
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

type IdParams = { id: string };
type TreeToken = { cursor: number; after: string };

function fail(reply: FastifyReply, status: number, code: ErrorCode, message: string) {
  return reply.code(status).send({ code, message });
}

function invalid(reply: FastifyReply) {
  return fail(reply, 400, "invalid_request", "Invalid request");
}

function parseIfMatch(raw: string | string[] | undefined): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const revision = Number(value?.replace(/"/g, ""));

  return Number.isInteger(revision) && revision >= 0 ? revision : null;
}

function decodeToken(token: string | undefined): TreeToken | null | "none" {
  if (!token) return "none";

  try {
    const value = JSON.parse(Buffer.from(token, "base64url").toString()) as TreeToken;

    return Number.isInteger(value.cursor) && typeof value.after === "string" ? value : null;
  } catch {
    return null;
  }
}

function fileEntry(file: {
  id: string;
  folder_id: string | null;
  originalName: string;
  size: number;
  content_hash: string | null;
  revision: number;
  mtime: Date | null;
}) {
  return {
    id: file.id,
    parentId: file.folder_id,
    name: file.originalName,
    kind: "file" as const,
    size: file.size,
    hash: file.content_hash,
    revision: file.revision,
    mtime: file.mtime?.toISOString() ?? null,
  };
}

function writeError(reply: FastifyReply, error: string) {
  switch (error) {
    case "file-not-found":
    case "folder-not-found":
    case "session-not-found":
      return fail(reply, 404, "not_found", "Not found");
    case "name_collision":
      return fail(reply, 409, "name_collision", "A file or folder with that name already exists");
    case "revision_conflict":
      return fail(reply, 409, "revision_conflict", "The item changed since you last synced");
    case "session-expired":
      return fail(reply, 410, "not_found", "Upload session expired");
    default:
      return fail(reply, 409, "invalid_request", "Upload session is closed");
  }
}

export default async function syncRoute(fastify: FastifyInstance) {
  fastify.addHook("onRequest", rateLimit({ limit: 600, windowSeconds: 60 }));

  fastify.post("/sync/devices", async (request, reply) => {
    const userId = request.user?.id;

    if (!userId) return fail(reply, 401, "unauthorized", "Unauthorized");

    const parsed = deviceBody.safeParse(request.body);

    if (!parsed.success) return invalid(reply);

    const deviceId = await registerDevice({ userId, ...parsed.data });

    return { deviceId };
  });

  fastify.get("/sync/tree", async (request, reply) => {
    const userId = request.user?.id;

    if (!userId) return fail(reply, 401, "unauthorized", "Unauthorized");

    const parsed = treeQuery.safeParse(request.query);
    const token = parsed.success ? decodeToken(parsed.data.pageToken) : null;

    if (!parsed.success || token === null) return invalid(reply);

    const cursor = token === "none" ? await currentCursor(userId) : token.cursor;
    const after = token === "none" ? null : token.after;
    const page = await listSyncTree({ userId, after, limit: TREE_PAGE_SIZE });
    const last = page.entries.at(-1);

    return {
      entries: page.entries,
      cursor,
      nextPageToken:
        page.hasMore && last
          ? Buffer.from(JSON.stringify({ cursor, after: last.id } satisfies TreeToken)).toString("base64url")
          : null,
    };
  });

  fastify.get("/sync/changes", async (request, reply) => {
    const userId = request.user?.id;

    if (!userId) return fail(reply, 401, "unauthorized", "Unauthorized");

    const parsed = changesQuery.safeParse(request.query);

    if (!parsed.success) return invalid(reply);

    const { cursor, limit, wait, deviceId } = parsed.data;
    const holdKey = `${userId}:${deviceId ?? ""}`;

    if (wait > 0 && heldPolls.has(holdKey)) {
      return fail(reply, 429, "rate_limited", "Only one held poll per device");
    }

    const readPage = async () => {
      if (cursor < (await minValidSeq(userId))) return null;

      return listChangesSince({ userId, cursor, limit: Math.min(limit, CHANGES_PAGE_SIZE) });
    };

    if (wait > 0) heldPolls.add(holdKey);

    let closed = false;
    reply.raw.once("close", () => {
      closed = true;
    });

    try {
      const deadline = Date.now() + wait * 1000;
      let page = await readPage();

      while (page && page.changes.length === 0 && Date.now() < deadline && !closed) {
        await sleep(Math.min(POLL_TICK_MS, Math.max(0, deadline - Date.now())));
        page = await readPage();
      }

      if (!page) {
        return fail(reply, 410, "cursor_expired", "Cursor is too old; run a full tree sync");
      }

      return {
        changes: page.changes,
        nextCursor: page.changes.at(-1)?.seq ?? cursor,
        hasMore: page.hasMore,
      };
    } finally {
      if (wait > 0) heldPolls.delete(holdKey);
    }
  });

  fastify.post("/sync/download-urls", async (request, reply) => {
    const userId = request.user?.id;

    if (!userId) return fail(reply, 401, "unauthorized", "Unauthorized");

    const parsed = downloadUrlsBody.safeParse(request.body);

    if (!parsed.success) return invalid(reply);

    const files = await getOwnedFiles(userId, parsed.data.fileIds);
    const expiresAt = new Date(Date.now() + DOWNLOAD_TTL_SECONDS * 1000).toISOString();

    return {
      files: await Promise.all(
        files.map(async (file) => {
          const link = await getPresignedDownloadUrl({
            key: file.storageKey,
            fileName: file.name,
            expiresIn: DOWNLOAD_TTL_SECONDS,
          });

          return {
            id: file.id,
            url: link.url,
            expiresAt,
            size: file.size,
            hash: file.hash,
            revision: file.revision,
          };
        }),
      ),
    };
  });

  fastify.post("/sync/uploads", async (request, reply) => {
    const userId = request.user?.id;

    if (!userId) return fail(reply, 401, "unauthorized", "Unauthorized");

    const parsed = uploadBody.safeParse(request.body);

    if (!parsed.success) return invalid(reply);

    const body = parsed.data;
    let parentId: string | null = null;

    if (body.fileId) {
      const target = await getOwnedFile(userId, body.fileId);

      if (!target) return fail(reply, 404, "not_found", "Not found");
      if (target.revision !== body.baseRevision) {
        return fail(reply, 409, "revision_conflict", "The item changed since you last synced");
      }
    } else {
      parentId = body.parentId;

      if (parentId && !(await ownedFolderExists(userId, parentId))) {
        return fail(reply, 404, "not_found", "Folder not found");
      }
    }

    const multipart = body.size > MULTIPART_THRESHOLD_BYTES;
    const session = await createUploadSession({
      userId,
      deviceId: await ownedDeviceId(userId, body.deviceId),
      fileId: body.fileId ?? null,
      parentId,
      name: body.name,
      mimeType: body.mimeType,
      baseRevision: body.baseRevision ?? null,
      size: body.size,
      hash: body.hash,
      mtime: body.mtime ? new Date(body.mtime) : null,
      storageKey: createStorageKey({
        userId,
        organizationId: null,
        folderId: parentId,
        fileName: body.name,
      }),
      partSize: multipart ? PART_SIZE_BYTES : null,
      idempotencyKey: body.idempotencyKey,
      expiresAt: new Date(Date.now() + UPLOAD_SESSION_TTL_MS),
    });

    if (session.part_size === null) {
      const link = await presignSingleUpload(session);

      return reply.code(201).send({
        sessionId: session.id,
        mode: "single",
        partSize: null,
        expiresAt: session.expires_at,
        url: link.url,
        headers: link.headers,
      });
    }

    let uploadId = session.multipart_upload_id;

    if (!uploadId) {
      uploadId = await createMultipartUpload({
        key: session.storage_key,
        contentType: session.mime_type,
      });
      await attachMultipartUpload(session.id, uploadId);
    }

    return reply.code(201).send({
      sessionId: session.id,
      mode: "multipart",
      partSize: session.part_size,
      expiresAt: session.expires_at,
    });
  });

  fastify.post<{ Params: IdParams }>("/sync/uploads/:id/parts", async (request, reply) => {
    const userId = request.user?.id;

    if (!userId) return fail(reply, 401, "unauthorized", "Unauthorized");
    if (!isUuid(request.params.id)) return invalid(reply);

    const parsed = partsBody.safeParse(request.body);
    const session = await getUploadSession(userId, request.params.id);

    if (!parsed.success) return invalid(reply);
    if (!session) return fail(reply, 404, "not_found", "Not found");
    if (!session.multipart_upload_id || !session.part_size || session.status !== "open") {
      return fail(reply, 400, "invalid_request", "Upload is not an open multipart upload");
    }

    const total = partCount(session.expected_size, session.part_size);

    if (parsed.data.partNumbers.some((number) => number > total)) {
      return invalid(reply);
    }

    return {
      parts: await Promise.all(
        parsed.data.partNumbers.map(async (partNumber) => ({
          partNumber,
          url: await getPresignedPartUrl({
            key: session.storage_key,
            uploadId: session.multipart_upload_id ?? "",
            partNumber,
          }),
        })),
      ),
    };
  });

  fastify.post<{ Params: IdParams }>("/sync/uploads/:id/commit", async (request, reply) => {
    const userId = request.user?.id;

    if (!userId) return fail(reply, 401, "unauthorized", "Unauthorized");
    if (!isUuid(request.params.id)) return invalid(reply);

    const parsed = commitBody.safeParse(request.body ?? {});
    const session = await getUploadSession(userId, request.params.id);

    if (!parsed.success) return invalid(reply);
    if (!session) return fail(reply, 404, "not_found", "Not found");

    if (session.status === "open") {
      const stored = await finalizeStoredUpload(session, parsed.data.parts);

      if (!stored) {
        return fail(reply, 422, "integrity_failed", "Uploaded bytes do not match the session");
      }
    }

    const result = await commitUploadSession({ userId, sessionId: session.id });

    if ("error" in result) {
      if (session.status === "open" && result.error !== "session-closed") {
        await deleteStoredObject(session.storage_key).catch(() => undefined);
      }

      return writeError(reply, result.error);
    }

    return { file: fileEntry(result.file), cursor: result.cursor };
  });

  fastify.post<{ Params: IdParams }>("/sync/uploads/:id/abort", async (request, reply) => {
    const userId = request.user?.id;

    if (!userId) return fail(reply, 401, "unauthorized", "Unauthorized");
    if (!isUuid(request.params.id)) return invalid(reply);

    const session = await getUploadSession(userId, request.params.id);

    if (!session) return fail(reply, 404, "not_found", "Not found");

    if (session.status === "open" && session.multipart_upload_id) {
      await abortMultipartUpload({
        key: session.storage_key,
        uploadId: session.multipart_upload_id,
      }).catch(() => undefined);
    }

    await abortUploadSession(userId, session.id);

    return { ok: true };
  });

  fastify.post("/sync/folders", async (request, reply) => {
    const userId = request.user?.id;

    if (!userId) return fail(reply, 401, "unauthorized", "Unauthorized");

    const parsed = folderBody.safeParse(request.body);

    if (!parsed.success) return invalid(reply);
    if (parsed.data.parentId && !(await ownedFolderExists(userId, parsed.data.parentId))) {
      return fail(reply, 404, "not_found", "Folder not found");
    }

    const result = await createFolder({
      userId,
      name: parsed.data.name,
      parentId: parsed.data.parentId,
      onCollision: "reject",
    });

    if ("error" in result) return writeError(reply, result.error);

    return reply.code(201).send({ folder: result.folder, cursor: result.cursor });
  });

  fastify.post<{ Params: IdParams }>("/sync/files/:id/move", async (request, reply) => {
    const userId = request.user?.id;

    if (!userId) return fail(reply, 401, "unauthorized", "Unauthorized");
    if (!isUuid(request.params.id)) return invalid(reply);

    const parsed = moveBody.safeParse(request.body);
    const revision = parseIfMatch(request.headers["if-match"]);

    if (!parsed.success || revision === null) return invalid(reply);
    if (!(await getOwnedFile(userId, request.params.id))) {
      return fail(reply, 404, "not_found", "Not found");
    }

    const result = await moveFileToFolder({
      fileId: request.params.id,
      userId,
      folderId: parsed.data.newParentId,
      name: parsed.data.newName,
      expectedRevision: revision,
    });

    if ("error" in result) return writeError(reply, result.error);

    return { file: fileEntry(result.file), cursor: result.cursor };
  });

  fastify.delete<{ Params: IdParams }>("/sync/files/:id", async (request, reply) => {
    const userId = request.user?.id;

    if (!userId) return fail(reply, 401, "unauthorized", "Unauthorized");
    if (!isUuid(request.params.id)) return invalid(reply);

    const revision = parseIfMatch(request.headers["if-match"]);

    if (revision === null) return invalid(reply);
    if (!(await getOwnedFile(userId, request.params.id))) {
      return fail(reply, 404, "not_found", "Not found");
    }

    const result = await updateFileForUser({
      fileId: request.params.id,
      userId,
      trashed: true,
      expectedRevision: revision,
    });

    if ("error" in result) return writeError(reply, result.error);

    return { cursor: result.cursor };
  });

  fastify.post("/sync/logs", async (request, reply) => {
    const userId = request.user?.id;

    if (!userId) return fail(reply, 401, "unauthorized", "Unauthorized");

    const parsed = runLogBody.safeParse(request.body);

    if (!parsed.success) return invalid(reply);

    const body = parsed.data;

    await insertRunLog({
      userId,
      deviceId: await ownedDeviceId(userId, body.deviceId),
      runId: body.runId,
      trigger: body.trigger,
      startedAt: new Date(body.startedAt),
      finishedAt: new Date(body.finishedAt),
      status: body.status,
      counts: body.counts,
      bytesUp: body.bytesUp,
      bytesDown: body.bytesDown,
      errorSummary: body.errorSummary ?? null,
    });

    return reply.code(201).send({ ok: true });
  });

  fastify.get("/sync/logs", async (request, reply) => {
    const userId = request.user?.id;

    if (!userId) return fail(reply, 401, "unauthorized", "Unauthorized");

    const parsed = logsQuery.safeParse(request.query);
    const before = parsed.success && parsed.data.pageToken ? new Date(parsed.data.pageToken) : null;

    if (!parsed.success || (before && Number.isNaN(before.getTime()))) return invalid(reply);

    const page = await listRunLogs({ userId, before, limit: LOG_PAGE_SIZE });
    const last = page.runs.at(-1);

    return {
      runs: page.runs.map((run) => ({
        id: run.id,
        runId: run.run_id,
        trigger: run.trigger,
        startedAt: run.started_at,
        finishedAt: run.finished_at,
        status: run.status,
        counts: run.counts,
        bytesUp: run.bytes_up,
        bytesDown: run.bytes_down,
        errorSummary: run.error_summary,
      })),
      nextPageToken: page.hasMore && last ? last.createdAt.toISOString() : null,
    };
  });
}
