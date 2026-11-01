import { and, eq, isNull, sql } from "drizzle-orm";
import { pathKey, splitName, uniqueName } from "@repo/sync-core";
import type { ChangeOp, ChangePayload, NodeKind } from "@repo/sync-protocol";
import { db } from "../index";
import {
  FilesTable,
  FolderTable,
  accountSyncState,
  changes,
  fileRevisions,
  uploadSessions,
} from "../models";
import { accessibleFiles, folderColumns, type FolderListItem } from "./query";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type FileRow = typeof FilesTable.$inferSelect;
export type WriteFile = Omit<FileRow, "storage_url">;
export type Collision = "rename" | "reject";
export type FileWriteError =
  | "file-not-found"
  | "folder-not-found"
  | "name_collision"
  | "revision_conflict";
export type FileWriteResult = { file: WriteFile; cursor: number } | { error: FileWriteError };

/** One writer per account at a time: keeps seq gapless and ordered for readers. */
async function lockAccount(tx: Tx, userId: string): Promise<void> {
  await tx
    .insert(accountSyncState)
    .values({ account_id: userId })
    .onConflictDoNothing();

  await tx
    .select({ id: accountSyncState.account_id })
    .from(accountSyncState)
    .where(eq(accountSyncState.account_id, userId))
    .for("update");
}

async function currentSeq(tx: Tx, userId: string): Promise<number> {
  const [state] = await tx
    .select({ seq: accountSyncState.last_seq })
    .from(accountSyncState)
    .where(eq(accountSyncState.account_id, userId));

  return state?.seq ?? 0;
}

type ChangeInput = {
  userId: string;
  nodeId: string;
  kind: NodeKind;
  op: ChangeOp;
  revision: number;
  payload: ChangePayload | null;
};

async function recordChange(tx: Tx, change: ChangeInput): Promise<number> {
  const [state] = await tx
    .update(accountSyncState)
    .set({ last_seq: sql`${accountSyncState.last_seq} + 1` })
    .where(eq(accountSyncState.account_id, change.userId))
    .returning({ seq: accountSyncState.last_seq });

  if (!state) throw new Error("Sync state row missing for account");

  await tx.insert(changes).values({
    account_id: change.userId,
    seq: state.seq,
    node_id: change.nodeId,
    node_kind: change.kind,
    op: change.op,
    revision: change.revision,
    payload: change.payload,
  });

  return state.seq;
}

const filePayload = (file: FileRow): ChangePayload => ({
  parentId: file.folder_id,
  name: file.originalName,
  size: file.size,
  hash: file.content_hash,
});

/** Pathkeys of live personal siblings under a folder (null = root). */
async function takenKeys(
  tx: Tx,
  userId: string,
  folderId: string | null,
  exceptId?: string,
): Promise<Set<string>> {
  const files = await tx
    .select({ id: FilesTable.id, name: FilesTable.originalName })
    .from(FilesTable)
    .where(
      and(
        eq(FilesTable.user_id, userId),
        isNull(FilesTable.organization_id),
        eq(FilesTable.isDeleted, false),
        folderId ? eq(FilesTable.folder_id, folderId) : isNull(FilesTable.folder_id),
      ),
    );
  const folders = await tx
    .select({ id: FolderTable.id, name: FolderTable.name })
    .from(FolderTable)
    .where(
      and(
        eq(FolderTable.user_id, userId),
        isNull(FolderTable.organization_id),
        eq(FolderTable.isDeleted, false),
        folderId ? eq(FolderTable.parent_id, folderId) : isNull(FolderTable.parent_id),
      ),
    );

  return new Set(
    [...files, ...folders]
      .filter((row) => row.id !== exceptId)
      .map((row) => pathKey(row.name)),
  );
}

/** Returns the chosen name, or null when rejecting a collision. Adds it to `taken`. */
function claimName(
  name: string,
  taken: Set<string>,
  onCollision: Collision,
): string | null {
  const chosen =
    onCollision === "reject"
      ? taken.has(pathKey(name))
        ? null
        : name
      : uniqueName(name, taken);

  if (chosen) taken.add(pathKey(chosen));

  return chosen;
}

async function ownedFolder(tx: Tx, userId: string, folderId: string) {
  const [folder] = await tx
    .select({ id: FolderTable.id })
    .from(FolderTable)
    .where(
      and(
        eq(FolderTable.id, folderId),
        eq(FolderTable.user_id, userId),
        eq(FolderTable.isDeleted, false),
      ),
    )
    .limit(1);

  return folder ?? null;
}

async function accessibleFile(tx: Tx, userId: string, fileId: string): Promise<FileRow | null> {
  const access = accessibleFiles(userId);
  const [file] = await tx
    .select()
    .from(FilesTable)
    .where(and(eq(FilesTable.id, fileId), access))
    .limit(1);

  return file ?? null;
}

const isPersonal = (file: FileRow, userId: string) =>
  file.organization_id === null && file.user_id === userId;

const publicFile = ({ storage_url: _storageUrl, ...file }: FileRow): WriteFile => file;

type NewFileInput = {
  userId: string;
  organizationId: string | null;
  folderId: string | null;
  originalName: string;
  storageKey: string;
  size: number;
  mimeType: string;
  contentHash: string | null;
  mtime: Date | null;
};

async function insertFile(tx: Tx, input: NewFileInput, name: string): Promise<FileRow> {
  const { stem, ext } = splitName(name);
  const [file] = await tx
    .insert(FilesTable)
    .values({
      user_id: input.userId,
      organization_id: input.organizationId,
      folder_id: input.folderId,
      storage_url: input.storageKey,
      name: stem,
      originalName: name,
      extension: ext.slice(1).toLowerCase(),
      size: input.size,
      mime_type: input.mimeType,
      content_hash: input.contentHash,
      mtime: input.mtime,
    })
    .returning();

  if (!file) throw new Error("File insert returned no row");

  return file;
}

export type CreateFileInput = {
  userId: string;
  organizationId?: string | null;
  folderId?: string | null;
  storageKey: string;
  originalName: string;
  size: number;
  mimeType: string;
};

/** Web uploads. Personal duplicates get " (2)" suffixes; org files are not tracked. */
export async function createFiles(inputs: CreateFileInput[]) {
  if (inputs.length === 0) return [];

  return db.transaction(async (tx) => {
    const rows: FileRow[] = [];
    const takenByFolder = new Map<string, Set<string>>();

    for (const input of inputs) {
      const organizationId = input.organizationId ?? null;
      const folderId = input.folderId ?? null;
      const base = {
        ...input,
        organizationId,
        folderId,
        contentHash: null,
        mtime: null,
      };

      if (organizationId) {
        rows.push(await insertFile(tx, base, input.originalName));
        continue;
      }

      await lockAccount(tx, input.userId);
      const key = folderId ?? "";
      let taken = takenByFolder.get(key);

      if (!taken) {
        taken = await takenKeys(tx, input.userId, folderId);
        takenByFolder.set(key, taken);
      }

      const name = claimName(input.originalName, taken, "rename");
      if (!name) throw new Error("Rename mode cannot reject");

      const file = await insertFile(tx, base, name);
      await recordChange(tx, {
        userId: input.userId,
        nodeId: file.id,
        kind: "file",
        op: "create",
        revision: file.revision,
        payload: filePayload(file),
      });
      rows.push(file);
    }

    return rows;
  });
}

type CreateFolderInput = {
  userId: string;
  name: string;
  parentId?: string | null;
  onCollision?: Collision;
};

/** Personal folder. Web uses rename; sync mkdir uses reject. */
export async function createFolder({
  userId,
  name,
  parentId,
  onCollision = "rename",
}: CreateFolderInput): Promise<{ folder: FolderListItem; cursor: number } | { error: "name_collision" }> {
  return db.transaction(async (tx) => {
    await lockAccount(tx, userId);
    const parent = parentId ?? null;
    const taken = await takenKeys(tx, userId, parent);
    const finalName = claimName(name, taken, onCollision);

    if (!finalName) return { error: "name_collision" as const };

    const [folder] = await tx
      .insert(FolderTable)
      .values({ user_id: userId, name: finalName, parent_id: parent })
      .returning(folderColumns);

    if (!folder) throw new Error("Folder insert returned no row");

    const cursor = await recordChange(tx, {
      userId,
      nodeId: folder.id,
      kind: "folder",
      op: "create",
      revision: 1,
      payload: { parentId: parent, name: folder.name, size: 0, hash: null },
    });

    return { folder, cursor };
  });
}

type MoveFileInput = {
  fileId: string;
  userId: string;
  folderId: string | null;
  name?: string;
  expectedRevision?: number;
};

/** Move and/or rename. Web passes folderId only; sync passes revision too. */
export async function moveFileToFolder({
  fileId,
  userId,
  folderId,
  name,
  expectedRevision,
}: MoveFileInput): Promise<FileWriteResult> {
  return db.transaction(async (tx) => {
    await lockAccount(tx, userId);
    const current = await accessibleFile(tx, userId, fileId);

    if (!current || current.isDeleted) return { error: "file-not-found" as const };
    if (expectedRevision !== undefined && current.revision !== expectedRevision) {
      return { error: "revision_conflict" as const };
    }
    if (folderId && !(await ownedFolder(tx, userId, folderId))) {
      return { error: "folder-not-found" as const };
    }

    const nextName = name ?? current.originalName;

    if (!isPersonal(current, userId)) {
      const [file] = await tx
        .update(FilesTable)
        .set({ folder_id: folderId, updatedAt: new Date() })
        .where(eq(FilesTable.id, fileId))
        .returning();

      if (!file) return { error: "file-not-found" as const };

      return { file: publicFile(file), cursor: await currentSeq(tx, userId) };
    }

    const taken = await takenKeys(tx, userId, folderId, current.id);

    if (taken.has(pathKey(nextName))) return { error: "name_collision" as const };

    const { stem, ext } = splitName(nextName);
    const [file] = await tx
      .update(FilesTable)
      .set({
        folder_id: folderId,
        originalName: nextName,
        name: stem,
        extension: ext.slice(1).toLowerCase(),
        revision: sql`${FilesTable.revision} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(FilesTable.id, fileId))
      .returning();

    if (!file) return { error: "file-not-found" as const };

    const cursor = await recordChange(tx, {
      userId,
      nodeId: file.id,
      kind: "file",
      op: "move",
      revision: file.revision,
      payload: filePayload(file),
    });

    return { file: publicFile(file), cursor };
  });
}

type UpdateFileInput = {
  fileId: string;
  userId: string;
  starred?: boolean;
  trashed?: boolean;
  expectedRevision?: number;
};

/** Star, trash, or restore. Trash and restore are sync delete and create. */
export async function updateFileForUser({
  fileId,
  userId,
  starred,
  trashed,
  expectedRevision,
}: UpdateFileInput): Promise<FileWriteResult> {
  return db.transaction(async (tx) => {
    await lockAccount(tx, userId);
    const current = await accessibleFile(tx, userId, fileId);

    if (!current) return { error: "file-not-found" as const };
    if (expectedRevision !== undefined && current.revision !== expectedRevision) {
      return { error: "revision_conflict" as const };
    }

    const flipsTrash = trashed !== undefined && trashed !== current.isDeleted;

    if (flipsTrash && !trashed && isPersonal(current, userId)) {
      const taken = await takenKeys(tx, userId, current.folder_id, current.id);

      if (taken.has(pathKey(current.originalName))) {
        return { error: "name_collision" as const };
      }
    }

    const personal = isPersonal(current, userId);
    const bump = flipsTrash && personal;

    const [file] = await tx
      .update(FilesTable)
      .set({
        ...(starred !== undefined ? { is_starred: starred } : {}),
        ...(flipsTrash ? { isDeleted: trashed, deletedAt: trashed ? new Date() : null } : {}),
        ...(bump ? { revision: sql`${FilesTable.revision} + 1` } : {}),
        ...(flipsTrash ? { updatedAt: new Date() } : {}),
      })
      .where(eq(FilesTable.id, fileId))
      .returning();

    if (!file) return { error: "file-not-found" as const };

    const cursor = bump
      ? await recordChange(tx, {
          userId,
          nodeId: file.id,
          kind: "file",
          op: trashed ? "delete" : "create",
          revision: file.revision,
          payload: trashed ? null : filePayload(file),
        })
      : await currentSeq(tx, userId);

    return { file: publicFile(file), cursor };
  });
}

export type CommitInput = { userId: string; sessionId: string };
export type CommitError =
  | "session-not-found"
  | "session-closed"
  | "session-expired"
  | "file-not-found"
  | "folder-not-found"
  | "name_collision"
  | "revision_conflict";

/** Atomically publishes an upload session. Replays of committed sessions return the same result. */
export async function commitUploadSession({
  userId,
  sessionId,
}: CommitInput): Promise<{ file: WriteFile; cursor: number } | { error: CommitError }> {
  return db.transaction(async (tx) => {
    await lockAccount(tx, userId);

    const [session] = await tx
      .select()
      .from(uploadSessions)
      .where(and(eq(uploadSessions.id, sessionId), eq(uploadSessions.user_id, userId)))
      .for("update")
      .limit(1);

    if (!session) return { error: "session-not-found" as const };

    if (session.status === "committed") {
      const [file] = session.result_file_id
        ? await tx
            .select()
            .from(FilesTable)
            .where(eq(FilesTable.id, session.result_file_id))
            .limit(1)
        : [];

      if (!file || session.result_seq === null) return { error: "file-not-found" as const };

      return { file: publicFile(file), cursor: session.result_seq };
    }

    if (session.status !== "open") return { error: "session-closed" as const };
    if (session.expires_at.getTime() < Date.now()) return { error: "session-expired" as const };

    if (session.file_id) {
      const [current] = await tx
        .select()
        .from(FilesTable)
        .where(
          and(
            eq(FilesTable.id, session.file_id),
            eq(FilesTable.user_id, userId),
            isNull(FilesTable.organization_id),
            eq(FilesTable.isDeleted, false),
          ),
        )
        .limit(1);

      if (!current) return { error: "file-not-found" as const };
      if (current.revision !== session.base_revision) {
        return { error: "revision_conflict" as const };
      }

      await tx.insert(fileRevisions).values({
        file_id: current.id,
        revision: current.revision,
        storage_key: current.storage_url,
        size: current.size,
        content_hash: current.content_hash,
      });

      const [file] = await tx
        .update(FilesTable)
        .set({
          storage_url: session.storage_key,
          size: session.expected_size,
          content_hash: session.expected_hash,
          mime_type: session.mime_type,
          mtime: session.mtime,
          revision: current.revision + 1,
          updatedAt: new Date(),
        })
        .where(eq(FilesTable.id, current.id))
        .returning();

      if (!file) throw new Error("File update returned no row");

      const cursor = await recordChange(tx, {
        userId,
        nodeId: file.id,
        kind: "file",
        op: "update",
        revision: file.revision,
        payload: filePayload(file),
      });

      await finishSession(tx, sessionId, file, cursor);

      return { file: publicFile(file), cursor };
    }

    if (session.parent_id && !(await ownedFolder(tx, userId, session.parent_id))) {
      return { error: "folder-not-found" as const };
    }

    const taken = await takenKeys(tx, userId, session.parent_id);
    const name = claimName(session.name, taken, "reject");

    if (!name) return { error: "name_collision" as const };

    const file = await insertFile(
      tx,
      {
        userId,
        organizationId: null,
        folderId: session.parent_id,
        originalName: name,
        storageKey: session.storage_key,
        size: session.expected_size,
        mimeType: session.mime_type,
        contentHash: session.expected_hash,
        mtime: session.mtime,
      },
      name,
    );
    const cursor = await recordChange(tx, {
      userId,
      nodeId: file.id,
      kind: "file",
      op: "create",
      revision: file.revision,
      payload: filePayload(file),
    });

    await finishSession(tx, sessionId, file, cursor);

    return { file: publicFile(file), cursor };
  });
}

async function finishSession(tx: Tx, sessionId: string, file: FileRow, cursor: number) {
  await tx
    .update(uploadSessions)
    .set({
      status: "committed",
      result_file_id: file.id,
      result_revision: file.revision,
      result_seq: cursor,
    })
    .where(eq(uploadSessions.id, sessionId));
}
