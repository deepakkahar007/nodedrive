import { createSHA256 } from "hash-wasm";
import {
  backoffMs,
  checkName,
  conflictName,
  guardDeletes,
  pathKey,
  reconcile,
  uniqueName,
  type Action,
  type Side,
} from "@repo/sync-core";
import {
  CHANGES_PAGE_SIZE,
  type ChangeEntry,
  type RunLogBody,
  type TreeEntry,
  type UploadBody,
} from "@repo/sync-protocol";
import { createSyncApi, SyncApiError, type UploadSession } from "./api";
import { type FileRecord, type SyncDb } from "./db";
import type { LocalEntry, LocalFs } from "./fs";

export type CycleStatus = "ok" | "partial" | "needs-permission" | "paused" | "needs-confirmation" | "error";
export type Counts = {
  uploaded: number;
  downloaded: number;
  deleted: number;
  moved: number;
  adopted: number;
  conflicts: number;
  errors: number;
  bytesUp: number;
  bytesDown: number;
};
export type CycleError = { path: string; message: string };
export type CycleResult = { status: CycleStatus; runId: string; counts: Counts; errors: CycleError[] };

export type EngineOptions = {
  baseUrl: string;
  fs: LocalFs;
  db: SyncDb;
  deviceLabel: string;
  fetch?: typeof fetch;
  now?: () => Date;
  sleep?: (ms: number) => Promise<void>;
  parallel?: number;
  /** Serializes cycles across tabs. Defaults to a per-instance queue. */
  lock?: Lock;
  onCycle?: (result: CycleResult) => void;
};

type Lock = <T>(task: () => Promise<T>) => Promise<T>;

type LocksApi = { request<T>(name: string, task: () => Promise<T>): Promise<T> };

/** Cross-tab lock via navigator.locks. Browser only. */
export function navigatorLock(name: string): Lock {
  const locks = (globalThis as unknown as { navigator: { locks: LocksApi } }).navigator.locks;

  return <T>(task: () => Promise<T>) => locks.request(name, task);
}

type Planned = {
  path: string;
  action: Action | "touch";
  local: LocalEntry | undefined;
  rec: FileRecord | undefined;
  rn: TreeEntry | undefined;
  localHash: string | null;
};

type RunTrigger = RunLogBody["trigger"];

const TRANSFER_ATTEMPTS = 3;
const IGNORED_NAME = /\.(crdownload|tmp|part)$|^~\$|^\.DS_Store$|^Thumbs\.db$/i;
const DELETE_ACTIONS = new Set<string>(["delete-local", "delete-remote"]);

const basename = (path: string) => path.split("/").pop() ?? path;
const dirname = (path: string) => path.split("/").slice(0, -1).join("/");
const depth = (path: string) => path.split("/").length;
const kindOf = (p: Planned) => p.local?.kind ?? p.rn?.kind ?? p.rec?.kind ?? "file";

async function hashBytes(parts: AsyncIterable<Uint8Array>): Promise<string> {
  const hasher = await createSHA256();

  for await (const chunk of parts) hasher.update(chunk);

  return hasher.digest("hex");
}

async function* chunksOf(blob: Blob): AsyncIterable<Uint8Array> {
  const reader = blob.stream().getReader();

  for (;;) {
    const { done, value } = await reader.read();

    if (done) return;

    yield value;
  }
}

const hashBlob = (blob: Blob) => hashBytes(chunksOf(blob));

/** Remote snapshot keyed by full path. Nodes whose parent chain is broken are dropped. */
function buildRemote(nodes: TreeEntry[]): Map<string, TreeEntry> {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const out = new Map<string, TreeEntry>();

  for (const node of nodes) {
    const parts = [node.name.normalize("NFC")];
    let parent = node.parentId;
    let hops = 0;

    while (parent && hops++ < 64) {
      const next = byId.get(parent);

      if (!next) break;

      parts.unshift(next.name.normalize("NFC"));
      parent = next.parentId;
    }

    if (!parent) out.set(parts.join("/"), node);
  }

  return out;
}

function isSkipped(path: string, skipped: Set<string>): boolean {
  const parts = path.split("/");

  return parts.some((_, index) => skipped.has(parts.slice(0, index + 1).join("/")));
}

export function createSyncEngine(options: EngineOptions) {
  const { db, fs } = options;
  const api = createSyncApi({ baseUrl: options.baseUrl, fetch: options.fetch });
  const doFetch = options.fetch ?? fetch;
  const now = options.now ?? (() => new Date());
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const parallel = options.parallel ?? 3;
  let queue: Promise<unknown> = Promise.resolve();
  let deletesConfirmed = false;
  const exclusive: Lock = options.lock ?? ((task) => {
    const run = queue.then(task);

    queue = run.catch(() => undefined);

    return run;
  });

  async function attempt<T>(task: () => Promise<T>): Promise<T> {
    for (let tries = 0; ; tries++) {
      try {
        return await task();
      } catch (error) {
        if (tries + 1 >= TRANSFER_ATTEMPTS || (error instanceof SyncApiError && error.status < 500)) {
          throw error;
        }

        await sleep(backoffMs(tries));
      }
    }
  }

  async function ensureDevice(): Promise<string> {
    const known = await db.meta.get("deviceId");

    if (typeof known?.value === "string") return known.value;

    const { deviceId } = await api.registerDevice({ label: options.deviceLabel });

    await db.meta.put({ key: "deviceId", value: deviceId });

    return deviceId;
  }

  /** Long poll for the next change. Resolves true when something is waiting, false on timeout. */
  async function hasRemoteChanges(signal: AbortSignal, wait: number): Promise<boolean> {
    const cursor = await db.meta.get("cursor");
    const device = await db.meta.get("deviceId");

    if (typeof cursor?.value !== "number" || typeof device?.value !== "string") {
      throw new Error("Sync has not completed its first cycle");
    }

    try {
      const page = await api.changes(cursor.value, 1, { wait, deviceId: device.value, signal });

      return page.changes.length > 0;
    } catch (error) {
      if (error instanceof SyncApiError && error.status === 410) return true;

      throw error;
    }
  }

  async function pullFullTree(): Promise<void> {
    const nodes: TreeEntry[] = [];
    let pageToken: string | undefined;
    let cursor = 0;

    do {
      const page = await api.tree(pageToken);

      nodes.push(...page.entries);
      cursor = page.cursor;
      pageToken = page.nextPageToken ?? undefined;
    } while (pageToken);

    await db.transaction("rw", db.remote, db.meta, async () => {
      await db.remote.clear();
      await db.remote.bulkPut(nodes);
      await db.meta.put({ key: "cursor", value: cursor });
    });
  }

  async function applyChanges(changes: ChangeEntry[], nextCursor: number): Promise<void> {
    await db.transaction("rw", db.remote, db.meta, async () => {
      for (const change of changes) {
        if (change.op === "delete") {
          await db.remote.delete(change.nodeId);
        } else if (change.payload) {
          await db.remote.put({ id: change.nodeId, kind: change.kind, revision: change.revision, mtime: null, ...change.payload });
        }
      }

      await db.meta.put({ key: "cursor", value: nextCursor });
    });
  }

  async function pullChanges(): Promise<void> {
    const cursor = await db.meta.get("cursor");

    if (typeof cursor?.value !== "number") return pullFullTree();

    let from = cursor.value;

    for (;;) {
      const page = await api.changes(from, CHANGES_PAGE_SIZE).catch((error: unknown) => {
        if (error instanceof SyncApiError && error.status === 410) return null;

        throw error;
      });

      if (!page) return pullFullTree();

      await applyChanges(page.changes, page.nextCursor);
      from = page.nextCursor;

      if (!page.hasMore) return;
    }
  }

  async function scanLocal(): Promise<{ scan: Map<string, LocalEntry>; skipped: Set<string> }> {
    const scan = new Map<string, LocalEntry>();
    const skipped = new Set<string>();
    const seen = new Map<string, string>();

    for (const entry of await fs.list()) {
      const path = entry.path.normalize("NFC");
      const segments = path.split("/");
      const bad = segments.some((segment) => IGNORED_NAME.test(segment) || !checkName(segment).ok);
      const key = pathKey(path);

      if (bad || seen.has(key)) {
        skipped.add(path);
        continue;
      }

      seen.set(key, path);
      scan.set(path, { ...entry, path });
    }

    return { scan, skipped };
  }

  async function localState(path: string, local: LocalEntry | undefined, rec: FileRecord | undefined) {
    if (!local) return { side: "absent" as Side, hash: null as string | null };
    if (!rec || rec.kind !== local.kind) return { side: "changed" as Side, hash: null };
    if (local.kind === "folder") return { side: "same" as Side, hash: null };
    if (local.size === rec.localSize && local.mtime === rec.localMtime) {
      return { side: "same" as Side, hash: rec.localHash };
    }

    const hash = await hashBlob(await fs.read(path));

    return { side: (hash === rec.baseHash ? "same" : "changed") as Side, hash };
  }

  function remoteState(rn: TreeEntry | undefined, rec: FileRecord | undefined): Side {
    if (!rn) return "absent";
    if (!rec) return "changed";

    return rec.remoteId === rn.id && rec.baseRevision === rn.revision && rec.kind === rn.kind ? "same" : "changed";
  }

  async function plan(scan: Map<string, LocalEntry>, skipped: Set<string>) {
    const records = new Map((await db.files.toArray()).map((rec) => [rec.path, rec]));
    const remote = buildRemote(await db.remote.toArray());
    const paths = new Set([...scan.keys(), ...records.keys(), ...remote.keys()]);
    const actions: Planned[] = [];

    for (const path of paths) {
      if (isSkipped(path, skipped)) continue;

      const local = scan.get(path);
      const rec = records.get(path);
      const rn = remote.get(path);
      const state = await localState(path, local, rec);
      let hash = state.hash;

      if (local?.kind === "file" && hash === null) {
        hash = await hashBlob(await fs.read(path));
      }

      const sameContent =
        local?.kind === "folder" && rn?.kind === "folder"
          ? true
          : Boolean(hash && rn?.hash && hash === rn.hash);
      const action = reconcile({
        base: Boolean(rec),
        local: state.side,
        remote: remoteState(rn, rec),
        sameContent,
        kindMismatch: Boolean(local && rn && local.kind !== rn.kind),
      });

      if (action !== "none") {
        actions.push({ path, action, local, rec, rn, localHash: hash });
      } else if (
        local?.kind === "file" &&
        rec &&
        state.side === "same" &&
        (rec.localSize !== local.size || rec.localMtime !== local.mtime)
      ) {
        actions.push({ path, action: "touch", local, rec, rn, localHash: hash });
      }
    }

    return actions;
  }

  async function parentRemoteId(path: string): Promise<string | null> {
    const parent = dirname(path);

    if (!parent) return null;

    const rec = await db.files.get(parent);

    if (!rec) throw new Error(`Parent folder not synced yet: ${parent}`);

    return rec.remoteId;
  }

  async function idempotencyKey(parts: string[]): Promise<string> {
    const hasher = await createSHA256();

    hasher.update(new TextEncoder().encode(parts.join("|")));

    return `sync-${hasher.digest("hex")}`;
  }

  async function putBlob(url: string, body: Blob, headers: Record<string, string> = {}) {
    const response = await doFetch(url, { method: "PUT", headers, body });

    if (!response.ok) throw new Error(`Storage rejected upload (HTTP ${response.status})`);

    return response;
  }

  async function uploadParts(
    session: Extract<UploadSession, { mode: "multipart" }>,
    path: string,
    blob: Blob,
    counts: Counts,
  ): Promise<{ partNumber: number; etag: string }[]> {
    const total = Math.ceil(blob.size / session.partSize);
    const saved = await db.uploads.get(path);
    const done = new Map(
      saved?.sessionId === session.sessionId ? saved.parts.map((part) => [part.partNumber, part]) : [],
    );
    const missing = Array.from({ length: total }, (_, index) => index + 1).filter((n) => !done.has(n));

    if (missing.length > 0) {
      const { parts: urls } = await api.uploadParts(session.sessionId, missing);

      for (const { partNumber, url } of urls) {
        const start = (partNumber - 1) * session.partSize;
        const response = await attempt(() =>
          putBlob(url, blob.slice(start, start + session.partSize)),
        );
        const etag = response.headers.get("etag");

        if (!etag) throw new Error("Storage did not return an ETag for a part");

        done.set(partNumber, { partNumber, etag });
        counts.bytesUp += Math.min(session.partSize, blob.size - start);
        await db.uploads.put({ path, sessionId: session.sessionId, parts: [...done.values()] });
      }
    }

    return [...done.values()].sort((a, b) => a.partNumber - b.partNumber);
  }

  async function pushFile(path: string, local: LocalEntry, hash: string, rec: FileRecord | undefined, counts: Counts) {
    const blob = await fs.read(path);
    const update = rec && rec.kind === "file" ? rec : undefined;
    const deviceId = await ensureDevice();
    const body: UploadBody = {
      parentId: update ? null : await parentRemoteId(path),
      name: basename(path),
      size: local.size,
      hash,
      mtime: new Date(local.mtime).toISOString(),
      mimeType: blob.type || "application/octet-stream",
      idempotencyKey: await idempotencyKey([deviceId, path, hash, update?.remoteId ?? "new", String(update?.baseRevision ?? 0)]),
      ...(update ? { fileId: update.remoteId, baseRevision: update.baseRevision } : {}),
    };
    const session = await api.createUpload(body);
    let parts: { partNumber: number; etag: string }[] | undefined;

    if (session.mode === "single") {
      await attempt(() => putBlob(session.url, blob, session.headers));
      counts.bytesUp += blob.size;
    } else {
      parts = await uploadParts(session, path, blob, counts);
    }

    const { file } = await api.commit(session.sessionId, parts);

    await db.uploads.delete(path);
    await db.files.put({
      path,
      kind: "file",
      remoteId: file.id,
      baseRevision: file.revision,
      baseHash: hash,
      localSize: local.size,
      localMtime: local.mtime,
      localHash: hash,
    });
    await db.remote.put(file);
    counts.uploaded += 1;
  }

  async function pushFolder(path: string, counts: Counts) {
    const { folder } = await api.mkdir({ parentId: await parentRemoteId(path), name: basename(path) });
    const node: TreeEntry = {
      id: folder.id,
      parentId: folder.parentId,
      name: folder.name,
      kind: "folder",
      size: 0,
      hash: null,
      revision: 1,
      mtime: null,
    };

    await db.remote.put(node);
    await db.files.put({
      path,
      kind: "folder",
      remoteId: folder.id,
      baseRevision: 1,
      baseHash: null,
      localSize: 0,
      localMtime: 0,
      localHash: null,
    });
    counts.uploaded += 0;
  }

  async function downloadNode(rn: TreeEntry, path: string, counts: Counts) {
    if (rn.kind === "folder") {
      await fs.mkdir(path);
      const stat = await fs.stat(path);

      await db.files.put({
        path,
        kind: "folder",
        remoteId: rn.id,
        baseRevision: rn.revision,
        baseHash: null,
        localSize: 0,
        localMtime: stat?.mtime ?? 0,
        localHash: null,
      });

      return;
    }

    const { files } = await api.downloadUrls([rn.id]);
    const link = files[0];

    if (!link) throw new Error("No download link returned");

    const response = await doFetch(link.url);

    if (!response.ok || !response.body) throw new Error(`Download failed (HTTP ${response.status})`);

    const sink = await fs.openWrite(path);
    const hasher = await createSHA256();
    const reader = response.body.getReader();

    try {
      for (;;) {
        const { done, value } = await reader.read();

        if (done) break;

        hasher.update(value);
        await sink.write(value);
      }

      const hash = hasher.digest("hex");

      if (link.hash && link.hash !== hash) throw new Error(`Hash mismatch for ${path}`);

      await sink.close();
      const stat = await fs.stat(path);

      await db.files.put({
        path,
        kind: "file",
        remoteId: link.id,
        baseRevision: link.revision,
        baseHash: hash,
        localSize: stat?.size ?? link.size,
        localMtime: stat?.mtime ?? 0,
        localHash: hash,
      });
      counts.downloaded += 1;
      counts.bytesDown += link.size;
    } catch (error) {
      await sink.abort();
      throw error;
    }
  }

  async function moveLocal(from: string, to: string) {
    const sink = await fs.openWrite(to);

    try {
      for await (const chunk of chunksOf(await fs.read(from))) await sink.write(chunk);

      await sink.close();
    } catch (error) {
      await sink.abort();
      throw error;
    }

    await fs.remove(from);
  }

  /** A remote move of an unchanged file: move the local copy instead of downloading again. */
  async function applyRemoteRenames(scan: Map<string, LocalEntry>, counts: Counts, errors: CycleError[]): Promise<boolean> {
    const records = await db.files.toArray();
    const known = new Set(records.map((rec) => rec.path));
    const remote = buildRemote(await db.remote.toArray());
    const pathById = new Map([...remote].map(([path, node]) => [node.id, path]));
    let moved = false;

    for (const rec of records) {
      const to = pathById.get(rec.remoteId);
      const rn = to ? remote.get(to) : undefined;

      if (!to || !rn || to === rec.path || rec.kind !== "file" || rn.kind !== "file") continue;
      if (rn.hash === null || rn.hash !== rec.baseHash || scan.has(to) || known.has(to)) continue;

      try {
        if (scan.has(rec.path)) await moveLocal(rec.path, to);

        await db.transaction("rw", db.files, async () => {
          await db.files.delete(rec.path);
          await db.files.put({ ...rec, path: to, baseRevision: rn.revision });
        });
        counts.moved += 1;
        moved = true;
      } catch (error) {
        errors.push({ path: rec.path, message: error instanceof Error ? error.message : String(error) });
      }
    }

    return moved;
  }

  /** A local rename of an unchanged file: one server move instead of delete plus upload. */
  async function applyLocalRenames(scan: Map<string, LocalEntry>, counts: Counts, errors: CycleError[]): Promise<void> {
    const records = await db.files.toArray();
    const known = new Set(records.map((rec) => rec.path));
    const remote = buildRemote(await db.remote.toArray());
    const gone = records.filter((rec) => {
      const rn = remote.get(rec.path);

      return rec.kind === "file" && rec.baseHash !== null && !scan.has(rec.path) && rn?.id === rec.remoteId && rn.revision === rec.baseRevision;
    });

    if (gone.length === 0) return;

    const fresh = [...scan.values()].filter((entry) => entry.kind === "file" && !known.has(entry.path) && !remote.has(entry.path));
    const byHash = new Map<string, { entry: LocalEntry; hash: string }[]>();

    for (const entry of fresh) {
      const hash = await hashBlob(await fs.read(entry.path));

      byHash.set(hash, [...(byHash.get(hash) ?? []), { entry, hash }]);
    }

    for (const rec of gone) {
      const candidate = byHash.get(rec.baseHash ?? "")?.shift();
      const parentPath = candidate ? dirname(candidate.entry.path) : "";

      if (!candidate || (parentPath && !known.has(parentPath))) continue;

      const parentId = parentPath ? (await db.files.get(parentPath))?.remoteId ?? null : null;

      try {
        const { file } = await api.move(rec.remoteId, rec.baseRevision, {
          newParentId: parentId,
          newName: basename(candidate.entry.path),
        });

        await db.transaction("rw", db.files, db.remote, async () => {
          await db.files.delete(rec.path);
          await db.files.put({
            path: candidate.entry.path,
            kind: "file",
            remoteId: file.id,
            baseRevision: file.revision,
            baseHash: candidate.hash,
            localSize: candidate.entry.size,
            localMtime: candidate.entry.mtime,
            localHash: candidate.hash,
          });
          await db.remote.put(file);
        });
        counts.moved += 1;
      } catch (error) {
        if (error instanceof SyncApiError && error.status === 409) continue;

        errors.push({ path: rec.path, message: error instanceof Error ? error.message : String(error) });
      }
    }
  }

  async function resolveConflict(p: Planned, scanned: Map<string, LocalEntry>, counts: Counts) {
    if (!p.local || !p.rn || p.local.kind !== "file" || p.rn.kind !== "file") {
      throw new Error("Folder conflicts need manual resolution");
    }

    const siblings = new Set(
      [...scanned.keys()].filter((path) => dirname(path) === dirname(p.path)).map((path) => pathKey(basename(path))),
    );
    const copyName = uniqueName(
      conflictName({ name: basename(p.path), device: options.deviceLabel, date: now().toISOString().slice(0, 10) }),
      siblings,
    );
    const copyPath = [dirname(p.path), copyName].filter(Boolean).join("/");
    const sink = await fs.openWrite(copyPath);

    try {
      for await (const chunk of chunksOf(await fs.read(p.path))) await sink.write(chunk);

      await sink.close();
    } catch (error) {
      await sink.abort();
      throw error;
    }

    await fs.remove(p.path);
    await db.files.delete(p.path);
    await downloadNode(p.rn, p.path, counts);

    const copy = await fs.stat(copyPath);

    if (!copy) throw new Error("Conflict copy missing after write");

    await pushFile(copyPath, copy, await hashBlob(await fs.read(copyPath)), undefined, counts);
    await db.conflicts.add({ path: p.path, copyPath, detectedAt: now().toISOString(), resolved: false });
    counts.conflicts += 1;
  }

  async function runAction(p: Planned, scanned: Map<string, LocalEntry>, counts: Counts) {
    const rec = p.rec;

    switch (p.action) {
      case "touch": {
        if (!rec || !p.local) return;
        await db.files.put({ ...rec, localSize: p.local.size, localMtime: p.local.mtime, localHash: p.localHash });
        return;
      }
      case "drop-record":
        await db.files.delete(p.path);
        return;
      case "adopt-remote": {
        if (!p.rn || !p.local) return;
        await db.files.put({
          path: p.path,
          kind: p.local.kind,
          remoteId: p.rn.id,
          baseRevision: p.rn.revision,
          baseHash: p.rn.hash,
          localSize: p.local.size,
          localMtime: p.local.mtime,
          localHash: p.localHash,
        });
        counts.adopted += 1;
        return;
      }
      case "download":
        if (p.rn) await downloadNode(p.rn, p.path, counts);
        return;
      case "upload":
      case "upload-as-new":
        if (!p.local) return;
        if (p.local.kind === "folder") {
          await pushFolder(p.path, counts);
          return;
        }
        if (!p.localHash) throw new Error(`Missing hash for ${p.path}`);
        await pushFile(p.path, p.local, p.localHash, p.action === "upload" ? rec : undefined, counts);
        return;
      case "delete-local":
        await fs.remove(p.path);
        await db.files.delete(p.path);
        counts.deleted += 1;
        return;
      case "delete-remote":
        if (!p.rn || !rec || p.rn.kind !== "file") return;
        await api.remove(p.rn.id, rec.baseRevision);
        await db.files.delete(p.path);
        await db.remote.delete(p.rn.id);
        counts.deleted += 1;
        return;
      case "conflict":
        await resolveConflict(p, scanned, counts);
        return;
      default:
        return;
    }
  }

  async function execute(actions: Planned[], scanned: Map<string, LocalEntry>, errors: CycleError[], counts: Counts) {
    const record = async (p: Planned, task: () => Promise<void>, retry = true) => {
      try {
        await (retry ? attempt(task) : task());
      } catch (error) {
        counts.errors += 1;
        errors.push({ path: p.path, message: error instanceof Error ? error.message : String(error) });
      }
    };
    const isDelete = (p: Planned) => DELETE_ACTIONS.has(p.action);
    const folders = actions
      .filter((p) => kindOf(p) === "folder" && !isDelete(p) && p.action !== "touch")
      .sort((a, b) => depth(a.path) - depth(b.path));
    const deletes = actions.filter(isDelete);
    const files = actions.filter((p) => kindOf(p) === "file" && !isDelete(p) && p.action !== "touch");
    const touches = actions.filter((p) => p.action === "touch");

    for (const p of folders) await record(p, () => runAction(p, scanned, counts));

    const verdict = deletesConfirmed
      ? "ok"
      : guardDeletes({
          deletes: deletes.length,
          known: await db.files.count(),
          scanned: scanned.size,
        });

    deletesConfirmed = false;

    if (verdict === "ok") {
      for (const p of deletes.sort((a, b) => depth(b.path) - depth(a.path))) {
        await record(p, () => runAction(p, scanned, counts));
      }
    }

    for (const p of touches) await record(p, () => runAction(p, scanned, counts));

    let next = 0;

    await Promise.all(
      Array.from({ length: Math.min(parallel, files.length) }, async () => {
        while (next < files.length) {
          const p = files[next++];

          if (p) await record(p, () => runAction(p, scanned, counts), p.action !== "conflict");
        }
      }),
    );

    return verdict;
  }

  async function saveRun(result: CycleResult, startedAt: Date, finishedAt: Date, deviceId: string | null, trigger: RunTrigger) {
    const counts = { ...result.counts };

    await db.runs.put({
      runId: result.runId,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      status: result.status,
      counts,
      errorSummary: result.errors.length > 0 ? result.errors.map((error) => error.message).join("; ") : null,
    });

    if (!deviceId) return;

    await api
      .postLog({
        runId: result.runId,
        deviceId,
        trigger,
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        status: result.status === "ok" ? "ok" : result.status === "error" ? "failed" : "partial",
        counts,
        bytesUp: result.counts.bytesUp,
        bytesDown: result.counts.bytesDown,
        errorSummary: result.errors.length > 0 ? result.errors[0]?.message ?? null : null,
      })
      .catch(() => undefined);
  }

  async function cycleUnlocked(trigger: RunTrigger): Promise<CycleResult> {
    const runId = crypto.randomUUID();
    const counts: Counts = { uploaded: 0, downloaded: 0, deleted: 0, moved: 0, adopted: 0, conflicts: 0, errors: 0, bytesUp: 0, bytesDown: 0 };
    const errors: CycleError[] = [];
    const startedAt = now();

    if ((await fs.permission()) !== "granted") {
      return { status: "needs-permission", runId, counts, errors };
    }

    let deviceId: string | null = null;
    let status: CycleStatus = "ok";

    try {
      deviceId = await ensureDevice();
      await pullChanges();

      let { scan, skipped } = await scanLocal();

      if (await applyRemoteRenames(scan, counts, errors)) ({ scan, skipped } = await scanLocal());
      await applyLocalRenames(scan, counts, errors);

      const actions = await plan(scan, skipped);
      const verdict = await execute(actions, scan, errors, counts);

      if (verdict === "block") status = "paused";
      if (verdict === "confirm") status = "needs-confirmation";
      if (errors.length > 0 && status === "ok") status = "partial";
    } catch (error) {
      status = "error";
      errors.push({ path: "", message: error instanceof Error ? error.message : String(error) });
    }

    counts.errors = errors.length;
    const result: CycleResult = { status, runId, counts, errors };

    await saveRun(result, startedAt, now(), deviceId, trigger);
    options.onCycle?.(result);

    return result;
  }

  return {
    /** One sync cycle: pull remote changes, then reconcile and transfer. Cycles never overlap. */
    cycle(trigger: RunTrigger = "manual"): Promise<CycleResult> {
      return exclusive(() => cycleUnlocked(trigger));
    },
    /** The user accepted a paused mass delete. Applies to the next cycle only. */
    confirmDeletes() {
      deletesConfirmed = true;
    },
    hasRemoteChanges,
  };
}
