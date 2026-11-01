import { z } from "zod";

export const MULTIPART_THRESHOLD_BYTES = 64 * 1024 * 1024;
export const PART_SIZE_BYTES = 16 * 1024 * 1024;
export const MAX_FILE_BYTES = 5 * 1024 * 1024 * 1024;
export const UPLOAD_SESSION_TTL_MS = 24 * 60 * 60 * 1000;
export const TREE_PAGE_SIZE = 500;
export const CHANGES_PAGE_SIZE = 500;
export const LOG_PAGE_SIZE = 50;
export const DOWNLOAD_BATCH_MAX = 100;
export const LONG_POLL_MAX_SECONDS = 25;

export const ERROR_CODES = [
  "invalid_request",
  "unauthorized",
  "forbidden",
  "not_found",
  "revision_conflict",
  "name_collision",
  "cursor_expired",
  "too_large",
  "integrity_failed",
  "rate_limited",
  "quota_exceeded",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];
export type NodeKind = "file" | "folder";
export type ChangeOp = "create" | "update" | "move" | "delete";

export type ChangePayload = {
  parentId: string | null;
  name: string;
  size: number;
  hash: string | null;
};

export type TreeEntry = ChangePayload & {
  id: string;
  kind: NodeKind;
  revision: number;
  mtime: string | null;
};

export type ChangeEntry = {
  seq: number;
  nodeId: string;
  kind: NodeKind;
  op: ChangeOp;
  revision: number;
  payload: ChangePayload | null;
};

const uuid = z.uuid();
const sha256Hex = z.string().regex(/^[a-f0-9]{64}$/);
const fileName = z.string().trim().min(1).max(255);
const positiveInt = z.number().int().positive();

export const deviceBody = z.object({
  deviceId: uuid.optional(),
  label: z.string().trim().min(1).max(100),
  userAgent: z.string().max(255).optional(),
});

export const treeQuery = z.object({
  pageToken: z.string().optional(),
});

export const changesQuery = z.object({
  cursor: z.coerce.number().int().min(0),
  limit: z.coerce.number().int().min(1).max(CHANGES_PAGE_SIZE).default(CHANGES_PAGE_SIZE),
  wait: z.coerce.number().int().min(0).max(LONG_POLL_MAX_SECONDS).default(0),
  deviceId: uuid.optional(),
});

export const downloadUrlsBody = z.object({
  fileIds: z.array(uuid).min(1).max(DOWNLOAD_BATCH_MAX),
});

export const uploadBody = z
  .object({
    parentId: uuid.nullable().default(null),
    name: fileName,
    size: positiveInt.max(MAX_FILE_BYTES),
    hash: sha256Hex,
    mtime: z.iso.datetime().nullable().optional(),
    mimeType: z.string().max(255).default("application/octet-stream"),
    fileId: uuid.optional(),
    baseRevision: z.number().int().min(0).optional(),
    idempotencyKey: z.string().min(8).max(100),
    deviceId: uuid.optional(),
  })
  .refine((body) => (body.fileId === undefined) === (body.baseRevision === undefined), {
    message: "fileId and baseRevision go together",
  });

export const partsBody = z.object({
  partNumbers: z.array(positiveInt).min(1).max(100),
});

export const commitBody = z.object({
  parts: z
    .array(z.object({ partNumber: positiveInt, etag: z.string().min(1).max(255) }))
    .optional(),
});

export const folderBody = z.object({
  parentId: uuid.nullable().default(null),
  name: fileName,
});

export const moveBody = z.object({
  newParentId: uuid.nullable(),
  newName: fileName.optional(),
});

export const runLogBody = z.object({
  runId: z.string().min(1).max(100),
  deviceId: uuid.optional(),
  trigger: z.enum(["open", "focus", "online", "poll", "manual", "interval"]),
  startedAt: z.iso.datetime(),
  finishedAt: z.iso.datetime(),
  status: z.enum(["ok", "partial", "failed"]),
  counts: z.record(z.string(), z.number().int().nonnegative()),
  bytesUp: z.number().int().nonnegative(),
  bytesDown: z.number().int().nonnegative(),
  errorSummary: z.string().max(2000).nullable().optional(),
});

export const logsQuery = z.object({
  pageToken: z.string().optional(),
});

export type DeviceBody = z.infer<typeof deviceBody>;
export type UploadBody = z.infer<typeof uploadBody>;
export type PartsBody = z.infer<typeof partsBody>;
export type CommitBody = z.infer<typeof commitBody>;
export type FolderBody = z.infer<typeof folderBody>;
export type MoveBody = z.infer<typeof moveBody>;
export type RunLogBody = z.infer<typeof runLogBody>;
