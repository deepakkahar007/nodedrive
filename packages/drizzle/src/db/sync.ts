import { and, asc, desc, eq, gt, inArray, isNull, lt, sql } from "drizzle-orm";
import type {
  ChangeEntry,
  ChangeOp,
  ChangePayload,
  NodeKind,
  TreeEntry,
} from "@repo/sync-protocol";
import { db } from "../index";
import {
  FilesTable,
  FolderTable,
  accountSyncState,
  changes,
  devices,
  fileRevisions,
  syncLogs,
  uploadSessions,
} from "../models";

export async function currentCursor(userId: string): Promise<number> {
  const [state] = await db
    .select({ seq: accountSyncState.last_seq })
    .from(accountSyncState)
    .where(eq(accountSyncState.account_id, userId));

  return state?.seq ?? 0;
}

export async function minValidSeq(userId: string): Promise<number> {
  const [state] = await db
    .select({ min: accountSyncState.min_valid_seq })
    .from(accountSyncState)
    .where(eq(accountSyncState.account_id, userId));

  return state?.min ?? 0;
}

type TreeInput = { userId: string; after: string | null; limit: number };

/** Keyset page over live personal nodes, ordered by id across files and folders. */
export async function listSyncTree({
  userId,
  after,
  limit,
}: TreeInput): Promise<{ entries: TreeEntry[]; hasMore: boolean }> {
  const afterFile = after ? gt(FilesTable.id, after) : undefined;
  const afterFolder = after ? gt(FolderTable.id, after) : undefined;

  const files = await db
    .select()
    .from(FilesTable)
    .where(
      and(
        eq(FilesTable.user_id, userId),
        isNull(FilesTable.organization_id),
        eq(FilesTable.isDeleted, false),
        afterFile,
      ),
    )
    .orderBy(asc(FilesTable.id))
    .limit(limit + 1);
  const folders = await db
    .select()
    .from(FolderTable)
    .where(
      and(
        eq(FolderTable.user_id, userId),
        isNull(FolderTable.organization_id),
        eq(FolderTable.isDeleted, false),
        afterFolder,
      ),
    )
    .orderBy(asc(FolderTable.id))
    .limit(limit + 1);

  const merged: TreeEntry[] = [
    ...files.map((file) => ({
      id: file.id,
      parentId: file.folder_id,
      name: file.originalName,
      kind: "file" as const,
      size: file.size,
      hash: file.content_hash,
      revision: file.revision,
      mtime: file.mtime?.toISOString() ?? null,
    })),
    ...folders.map((folder) => ({
      id: folder.id,
      parentId: folder.parent_id,
      name: folder.name,
      kind: "folder" as const,
      size: 0,
      hash: null,
      revision: folder.revision,
      mtime: null,
    })),
  ].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  return {
    entries: merged.slice(0, limit),
    hasMore: merged.length > limit,
  };
}

type ChangesInput = { userId: string; cursor: number; limit: number };

/** Changes after a cursor, oldest first. Gapless because writers hold the account lock. */
export async function listChangesSince({
  userId,
  cursor,
  limit,
}: ChangesInput): Promise<{ changes: ChangeEntry[]; hasMore: boolean }> {
  const rows = await db
    .select()
    .from(changes)
    .where(and(eq(changes.account_id, userId), gt(changes.seq, cursor)))
    .orderBy(asc(changes.seq))
    .limit(limit + 1);

  return {
    changes: rows.slice(0, limit).map((row) => ({
      seq: row.seq,
      nodeId: row.node_id,
      kind: row.node_kind as NodeKind,
      op: row.op as ChangeOp,
      revision: row.revision,
      payload: row.payload as ChangePayload | null,
    })),
    hasMore: rows.length > limit,
  };
}

/** Drops changes below `beforeSeq`. Cursors older than that get cursor_expired. */
export async function pruneChanges({ userId, beforeSeq }: { userId: string; beforeSeq: number }): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .delete(changes)
      .where(and(eq(changes.account_id, userId), lt(changes.seq, beforeSeq)));
    await tx
      .update(accountSyncState)
      .set({ min_valid_seq: beforeSeq })
      .where(eq(accountSyncState.account_id, userId));
  });
}

/** Live personal file with its storage key. For download URLs and ownership checks. */
export async function getOwnedFiles(userId: string, fileIds: string[]) {
  return db
    .select({
      id: FilesTable.id,
      storageKey: FilesTable.storage_url,
      size: FilesTable.size,
      hash: FilesTable.content_hash,
      revision: FilesTable.revision,
      name: FilesTable.originalName,
    })
    .from(FilesTable)
    .where(
      and(
        eq(FilesTable.user_id, userId),
        isNull(FilesTable.organization_id),
        eq(FilesTable.isDeleted, false),
        inArray(FilesTable.id, fileIds),
      ),
    );
}

export async function getOwnedFile(userId: string, fileId: string) {
  const [file] = await getOwnedFiles(userId, [fileId]);

  return file ?? null;
}

export async function ownedFolderExists(userId: string, folderId: string): Promise<boolean> {
  const [folder] = await db
    .select({ id: FolderTable.id })
    .from(FolderTable)
    .where(
      and(
        eq(FolderTable.id, folderId),
        eq(FolderTable.user_id, userId),
        isNull(FolderTable.organization_id),
        eq(FolderTable.isDeleted, false),
      ),
    )
    .limit(1);

  return Boolean(folder);
}

export async function ownedDeviceId(userId: string, deviceId: string | undefined): Promise<string | null> {
  if (!deviceId) return null;

  const [device] = await db
    .select({ id: devices.id })
    .from(devices)
    .where(and(eq(devices.id, deviceId), eq(devices.user_id, userId)))
    .limit(1);

  return device?.id ?? null;
}

type RegisterDeviceInput = {
  userId: string;
  deviceId?: string;
  label: string;
  userAgent?: string;
};

/** Refreshes a known device, or registers a new one. Returns its id. */
export async function registerDevice({
  userId,
  deviceId,
  label,
  userAgent,
}: RegisterDeviceInput): Promise<string> {
  const known = await ownedDeviceId(userId, deviceId);

  if (known) {
    await db
      .update(devices)
      .set({ label, user_agent: userAgent ?? null, last_seen_at: new Date() })
      .where(eq(devices.id, known));

    return known;
  }

  const [device] = await db
    .insert(devices)
    .values({ user_id: userId, label, user_agent: userAgent ?? null })
    .returning({ id: devices.id });

  if (!device) throw new Error("Device insert returned no row");

  return device.id;
}

export type NewUploadSession = {
  userId: string;
  deviceId: string | null;
  fileId: string | null;
  parentId: string | null;
  name: string;
  mimeType: string;
  baseRevision: number | null;
  size: number;
  hash: string;
  mtime: Date | null;
  storageKey: string;
  partSize: number | null;
  idempotencyKey: string;
  expiresAt: Date;
};

/** Idempotent per (user, key): a repeated create returns the existing session. */
export async function createUploadSession(input: NewUploadSession) {
  const [inserted] = await db
    .insert(uploadSessions)
    .values({
      user_id: input.userId,
      device_id: input.deviceId,
      file_id: input.fileId,
      parent_id: input.parentId,
      name: input.name,
      mime_type: input.mimeType,
      base_revision: input.baseRevision,
      expected_size: input.size,
      expected_hash: input.hash,
      mtime: input.mtime,
      storage_key: input.storageKey,
      part_size: input.partSize,
      idempotency_key: input.idempotencyKey,
      expires_at: input.expiresAt,
    })
    .onConflictDoNothing({ target: [uploadSessions.user_id, uploadSessions.idempotency_key] })
    .returning();

  if (inserted) return inserted;

  const [existing] = await db
    .select()
    .from(uploadSessions)
    .where(
      and(
        eq(uploadSessions.user_id, input.userId),
        eq(uploadSessions.idempotency_key, input.idempotencyKey),
      ),
    )
    .limit(1);

  if (!existing) throw new Error("Upload session conflict without existing row");

  return existing;
}

export async function getUploadSession(userId: string, sessionId: string) {
  const [session] = await db
    .select()
    .from(uploadSessions)
    .where(and(eq(uploadSessions.id, sessionId), eq(uploadSessions.user_id, userId)))
    .limit(1);

  return session ?? null;
}

export async function attachMultipartUpload(sessionId: string, uploadId: string) {
  await db
    .update(uploadSessions)
    .set({ multipart_upload_id: uploadId })
    .where(eq(uploadSessions.id, sessionId));
}

/** Marks an open session aborted. Returns false if it was already closed. */
export async function abortUploadSession(userId: string, sessionId: string): Promise<boolean> {
  const aborted = await db
    .update(uploadSessions)
    .set({ status: "aborted" })
    .where(
      and(
        eq(uploadSessions.id, sessionId),
        eq(uploadSessions.user_id, userId),
        eq(uploadSessions.status, "open"),
      ),
    )
    .returning({ id: uploadSessions.id });

  return aborted.length > 0;
}

export type NewRunLog = {
  userId: string;
  deviceId: string | null;
  runId: string;
  trigger: string;
  startedAt: Date;
  finishedAt: Date;
  status: string;
  counts: Record<string, number>;
  bytesUp: number;
  bytesDown: number;
  errorSummary: string | null;
};

/** Idempotent per (user, run id). */
export async function insertRunLog(input: NewRunLog): Promise<void> {
  await db
    .insert(syncLogs)
    .values({
      user_id: input.userId,
      device_id: input.deviceId,
      run_id: input.runId,
      trigger: input.trigger,
      started_at: input.startedAt,
      finished_at: input.finishedAt,
      counts: input.counts,
      bytes_up: input.bytesUp,
      bytes_down: input.bytesDown,
      status: input.status,
      error_summary: input.errorSummary,
    })
    .onConflictDoNothing({ target: [syncLogs.user_id, syncLogs.run_id] });
}

/** Newest-first page. Pass the last `createdAt` as `before` to continue. */
export async function listRunLogs({
  userId,
  before,
  limit,
}: {
  userId: string;
  before: Date | null;
  limit: number;
}) {
  const rows = await db
    .select()
    .from(syncLogs)
    .where(and(eq(syncLogs.user_id, userId), before ? lt(syncLogs.createdAt, before) : undefined))
    .orderBy(desc(syncLogs.createdAt))
    .limit(limit + 1);

  return { runs: rows.slice(0, limit), hasMore: rows.length > limit };
}

/** Marks open sessions past expiry as expired. Returns storage to clean up. */
export async function expireUploadSessions(now: Date) {
  return db
    .update(uploadSessions)
    .set({ status: "expired" })
    .where(and(eq(uploadSessions.status, "open"), lt(uploadSessions.expires_at, now)))
    .returning({ storageKey: uploadSessions.storage_key, uploadId: uploadSessions.multipart_upload_id });
}

/** Prunes each account's change log up to its last change older than `cutoff`. Returns accounts touched. */
export async function pruneChangesOlderThan(cutoff: Date): Promise<number> {
  const stale = await db
    .select({ userId: changes.account_id, maxSeq: sql<string>`max(${changes.seq})` })
    .from(changes)
    .where(lt(changes.created_at, cutoff))
    .groupBy(changes.account_id);

  for (const row of stale) {
    await pruneChanges({ userId: row.userId, beforeSeq: Number(row.maxSeq) + 1 });
  }

  return stale.length;
}

export async function listRevisionsOlderThan(cutoff: Date, limit: number) {
  return db
    .select({ id: fileRevisions.id, storageKey: fileRevisions.storage_key })
    .from(fileRevisions)
    .where(lt(fileRevisions.createdAt, cutoff))
    .limit(limit);
}

export async function deleteRevisionRows(ids: string[]): Promise<void> {
  if (ids.length === 0) return;

  await db.delete(fileRevisions).where(inArray(fileRevisions.id, ids));
}

export async function pruneSyncLogs(cutoff: Date): Promise<number> {
  const deleted = await db
    .delete(syncLogs)
    .where(lt(syncLogs.createdAt, cutoff))
    .returning({ id: syncLogs.id });

  return deleted.length;
}

/** Random live storage keys, for spot-checking that stored bytes still exist. */
export async function sampleStorageKeys(limit: number): Promise<string[]> {
  const rows = await db
    .select({ key: FilesTable.storage_url })
    .from(FilesTable)
    .where(eq(FilesTable.isDeleted, false))
    .orderBy(sql`random()`)
    .limit(limit);

  return rows.map((row) => row.key);
}
