import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { serverEnv } from "@repo/env";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import {
  commitUploadSession,
  createFiles,
  createFolder,
  createTestUser,
  createUploadSession,
  db,
  expireUploadSessions,
  listChangesSince,
  listSyncTree,
  minValidSeq,
  pruneChangesOlderThan,
  moveFileToFolder,
  updateFileForUser,
} from "../index";

beforeAll(async () => {
  if (!serverEnv.DATABASE_URL.endsWith("/nodedrive_test")) {
    throw new Error("Sync tests only run against nodedrive_test");
  }

  await migrate(db, { migrationsFolder: "./migrations" });
});

afterAll(async () => {
  await db.$client.end();
});

async function makeFile(userId: string, name: string) {
  const [file] = await createFiles([
    {
      userId,
      storageKey: `users/${userId}/${randomUUID()}-${name}`,
      originalName: name,
      size: 10,
      mimeType: "text/plain",
    },
  ]);

  if (!file) throw new Error("createFiles returned no row");

  return file;
}

function openSession(
  userId: string,
  options: { name?: string; fileId?: string; baseRevision?: number; key?: string } = {},
) {
  return createUploadSession({
    userId,
    deviceId: null,
    fileId: options.fileId ?? null,
    parentId: null,
    name: options.name ?? "doc.txt",
    mimeType: "text/plain",
    baseRevision: options.baseRevision ?? null,
    size: 10,
    hash: "a".repeat(64),
    mtime: null,
    storageKey: `users/${userId}/${randomUUID()}-doc.txt`,
    partSize: null,
    idempotencyKey: options.key ?? randomUUID(),
    expiresAt: new Date(Date.now() + 60_000),
  });
}

describe("change log", () => {
  test("concurrent writes get gapless, ordered seq", async () => {
    const userId = await createTestUser();

    await Promise.all(
      Array.from({ length: 25 }, (_, index) => makeFile(userId, `file-${index}.txt`)),
    );

    const { changes } = await listChangesSince({ userId, cursor: 0, limit: 500 });

    expect(changes.map((change) => change.seq)).toEqual(
      Array.from({ length: 25 }, (_, index) => index + 1),
    );
    expect(new Set(changes.map((change) => change.payload?.name)).size).toBe(25);
  });

  test("same-name uploads get suffixes instead of colliding", async () => {
    const userId = await createTestUser();

    const rows = await Promise.all(
      Array.from({ length: 4 }, () => makeFile(userId, "report.pdf")),
    );

    expect(rows.map((row) => row.originalName).sort()).toEqual([
      "report (2).pdf",
      "report (3).pdf",
      "report (4).pdf",
      "report.pdf",
    ]);
  });

  test("trash and restore bump revision and log delete then create", async () => {
    const userId = await createTestUser();
    const file = await makeFile(userId, "notes.txt");

    await updateFileForUser({ fileId: file.id, userId, trashed: true });
    await updateFileForUser({ fileId: file.id, userId, trashed: false });

    const { changes } = await listChangesSince({ userId, cursor: 0, limit: 500 });

    expect(changes.map((change) => change.op)).toEqual(["create", "delete", "create"]);
    expect(changes.at(-1)?.revision).toBe(3);
  });
});

describe("tree paging", () => {
  test("pages cover files and folders exactly once, in id order", async () => {
    const userId = await createTestUser();

    await makeFile(userId, "a.txt");
    await makeFile(userId, "b.txt");
    await makeFile(userId, "c.txt");
    await createFolder({ userId, name: "F1" });
    await createFolder({ userId, name: "F2" });

    const seen: string[] = [];
    let after: string | null = null;
    let hasMore = true;

    while (hasMore) {
      const page = await listSyncTree({ userId, after, limit: 2 });
      seen.push(...page.entries.map((entry) => entry.id));
      after = page.entries.at(-1)?.id ?? null;
      hasMore = page.hasMore;
    }

    expect(seen).toHaveLength(5);
    expect(new Set(seen).size).toBe(5);
    expect(seen).toEqual([...seen].sort());
  });
});

describe("sync writes", () => {
  test("move rejects a stale revision", async () => {
    const userId = await createTestUser();
    const file = await makeFile(userId, "a.txt");

    const stale = await moveFileToFolder({
      fileId: file.id,
      userId,
      folderId: null,
      name: "b.txt",
      expectedRevision: 9,
    });
    const fresh = await moveFileToFolder({
      fileId: file.id,
      userId,
      folderId: null,
      name: "b.txt",
      expectedRevision: 1,
    });

    expect(stale).toEqual({ error: "revision_conflict" });
    expect("file" in fresh && fresh.file.revision).toBe(2);
  });

  test("move rejects a name collision", async () => {
    const userId = await createTestUser();

    await makeFile(userId, "a.txt");
    const other = await makeFile(userId, "b.txt");

    const result = await moveFileToFolder({
      fileId: other.id,
      userId,
      folderId: null,
      name: "A.txt",
    });

    expect(result).toEqual({ error: "name_collision" });
  });

  test("commit is idempotent: replays return the same file and seq", async () => {
    const userId = await createTestUser();
    const session = await openSession(userId, { name: "once.txt" });

    const first = await commitUploadSession({ userId, sessionId: session.id });
    const replay = await commitUploadSession({ userId, sessionId: session.id });
    const again = await openSession(userId, { name: "once.txt", key: session.idempotency_key });

    expect(first).toEqual(replay);
    expect(again.id).toBe(session.id);

    const { changes } = await listChangesSince({ userId, cursor: 0, limit: 500 });
    expect(changes.filter((change) => change.op === "create")).toHaveLength(1);
  });

  test("update commit rejects a base revision that moved on", async () => {
    const userId = await createTestUser();
    const file = await makeFile(userId, "doc.txt");

    const winner = await openSession(userId, { fileId: file.id, baseRevision: 1 });
    const loser = await openSession(userId, { fileId: file.id, baseRevision: 1 });

    expect("file" in (await commitUploadSession({ userId, sessionId: winner.id }))).toBe(true);
    expect(await commitUploadSession({ userId, sessionId: loser.id })).toEqual({
      error: "revision_conflict",
    });
  });
});

describe("retention", () => {
  test("expired sessions can no longer commit", async () => {
    const userId = await createTestUser();
    const session = await createUploadSession({
      userId,
      deviceId: null,
      fileId: null,
      parentId: null,
      name: "stale.txt",
      mimeType: "text/plain",
      baseRevision: null,
      size: 10,
      hash: "b".repeat(64),
      mtime: null,
      storageKey: `users/${userId}/stale.txt`,
      partSize: null,
      idempotencyKey: randomUUID(),
      expiresAt: new Date(Date.now() - 1000),
    });

    const expired = await expireUploadSessions(new Date());

    expect(expired.map((row) => row.storageKey)).toContain(session.storage_key);
    expect(await commitUploadSession({ userId, sessionId: session.id })).toEqual({
      error: "session-closed",
    });
  });

  test("pruning the change log raises min_valid_seq and drops old changes", async () => {
    const userId = await createTestUser();

    await makeFile(userId, "old.txt");
    await pruneChangesOlderThan(new Date(Date.now() + 60_000));

    expect(await minValidSeq(userId)).toBe(2);
    expect((await listChangesSince({ userId, cursor: 0, limit: 500 })).changes).toEqual([]);
  });
});
