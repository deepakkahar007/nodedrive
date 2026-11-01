import Dexie, { type DexieOptions, type Table } from "dexie";
import type { TreeEntry } from "@repo/sync-protocol";
import type { LocalKind } from "./fs";

export type FileRecord = {
  path: string;
  kind: LocalKind;
  remoteId: string;
  baseRevision: number;
  baseHash: string | null;
  localSize: number;
  localMtime: number;
  localHash: string | null;
};

export type UploadRecord = {
  path: string;
  sessionId: string;
  parts: { partNumber: number; etag: string }[];
};

export type RunRecord = {
  runId: string;
  startedAt: string;
  finishedAt: string;
  status: string;
  counts: Record<string, number>;
  errorSummary: string | null;
};

export type MetaRecord = { key: "deviceId" | "cursor"; value: string | number | null };

export type ConflictRecord = {
  id?: number;
  path: string;
  copyPath: string;
  detectedAt: string;
  resolved: boolean;
};

type IndexedDbGlobals = {
  indexedDB: NonNullable<DexieOptions["indexedDB"]>;
  IDBKeyRange: NonNullable<DexieOptions["IDBKeyRange"]>;
};

export class SyncDb extends Dexie {
  meta!: Table<MetaRecord, MetaRecord["key"]>;
  files!: Table<FileRecord, string>;
  remote!: Table<TreeEntry, string>;
  uploads!: Table<UploadRecord, string>;
  runs!: Table<RunRecord, string>;
  handles!: Table<{ id: string; handle: unknown }, string>;
  conflicts!: Table<ConflictRecord, number>;

  constructor(name: string) {
    const globals = globalThis as unknown as IndexedDbGlobals;

    super(name, { indexedDB: globals.indexedDB, IDBKeyRange: globals.IDBKeyRange });
    this.version(1).stores({
      meta: "key",
      files: "path",
      remote: "id",
      uploads: "path",
      runs: "runId",
      handles: "id",
    });
    this.version(2).stores({
      meta: "key",
      files: "path",
      remote: "id",
      uploads: "path",
      runs: "runId",
      handles: "id",
      conflicts: "++id",
    });
  }
}

export function createSyncDb(name: string): SyncDb {
  return new SyncDb(name);
}

/** Stores the picked folder handle so the next session can reuse it after a permission prompt. */
export async function saveRootHandle(db: SyncDb, handle: unknown): Promise<void> {
  await db.handles.put({ id: "root", handle });
}

export async function loadRootHandle(db: SyncDb): Promise<unknown | undefined> {
  return (await db.handles.get("root"))?.handle;
}
