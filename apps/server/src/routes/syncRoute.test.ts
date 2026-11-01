import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createHash, randomUUID } from "node:crypto";
import Fastify, { type FastifyInstance } from "fastify";
import { createTestUser, db } from "@repo/drizzle";
import { serverEnv } from "@repo/env";
import { bucketName, ensureBucket } from "@repo/storage";
import { connectRedis } from "@repo/node-redis";
import syncRoute from "./syncRoute";

const sha256 = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

let app: FastifyInstance;
let userId: string;

async function call(
  method: "GET" | "POST" | "DELETE",
  url: string,
  payload?: unknown,
  headers: Record<string, string> = {},
) {
  const response = await app.inject({ method, url, payload: payload as object, headers });

  return { status: response.statusCode, body: response.json() as Record<string, any> };
}

beforeAll(async () => {
  if (!serverEnv.DATABASE_URL.endsWith("/nodedrive_test") || !bucketName.endsWith("-test")) {
    throw new Error("Sync route tests only run against nodedrive_test and a *-test bucket");
  }

  await ensureBucket();
  await connectRedis();

  userId = await createTestUser();
  app = Fastify();
  app.addHook("onRequest", async (request) => {
    (request as { user: unknown }).user = { id: userId };
  });
  await app.register(syncRoute);
});

afterAll(async () => {
  await app.close();
  await db.$client.end();
});

describe("sync HTTP round trip", () => {
  test("folder, single upload, commit replay, tree, changes and download", async () => {
    const folder = await call("POST", "/sync/folders", { name: "Docs" });
    expect(folder.status).toBe(201);

    const bytes = Buffer.from("hello phase one\n");
    const created = await call("POST", "/sync/uploads", {
      parentId: folder.body.folder.id,
      name: "hello.txt",
      size: bytes.length,
      hash: sha256(bytes),
      mimeType: "text/plain",
      idempotencyKey: "hello-upload-1",
    });
    expect(created.body.mode).toBe("single");

    const put = await fetch(created.body.url, {
      method: "PUT",
      headers: created.body.headers,
      body: bytes,
    });
    expect(put.status).toBe(200);

    const committed = await call("POST", `/sync/uploads/${created.body.sessionId}/commit`, {});
    expect(committed.status).toBe(200);
    expect(committed.body.file.revision).toBe(1);

    const replay = await call("POST", `/sync/uploads/${created.body.sessionId}/commit`, {});
    expect(replay.body).toEqual(committed.body);

    const tree = await call("GET", "/sync/tree");
    expect(tree.body.entries.map((entry: { name: string }) => entry.name).sort()).toEqual([
      "Docs",
      "hello.txt",
    ]);

    const changes = await call("GET", "/sync/changes?cursor=0");
    expect(changes.body.changes.map((change: { op: string }) => change.op)).toEqual([
      "create",
      "create",
    ]);

    const links = await call("POST", "/sync/download-urls", {
      fileIds: [committed.body.file.id],
    });
    const download = await fetch(links.body.files[0].url);
    expect(Buffer.from(await download.arrayBuffer()).equals(bytes)).toBe(true);
  });

  test("update checks base revision; move and delete check If-Match", async () => {
    const tree = await call("GET", "/sync/tree");
    const file = tree.body.entries.find((entry: { name: string }) => entry.name === "hello.txt");

    const bytes = Buffer.from("second version\n");
    const update = await call("POST", "/sync/uploads", {
      fileId: file.id,
      baseRevision: 1,
      name: "hello.txt",
      size: bytes.length,
      hash: sha256(bytes),
      idempotencyKey: "hello-update-1",
    });
    await fetch(update.body.url, { method: "PUT", headers: update.body.headers, body: bytes });
    const updated = await call("POST", `/sync/uploads/${update.body.sessionId}/commit`, {});
    expect(updated.body.file.revision).toBe(2);

    const stale = await call("POST", "/sync/uploads", {
      fileId: file.id,
      baseRevision: 1,
      name: "hello.txt",
      size: bytes.length,
      hash: sha256(bytes),
      idempotencyKey: "hello-update-stale",
    });
    expect(stale.status).toBe(409);

    const staleMove = await call(
      "POST",
      `/sync/files/${file.id}/move`,
      { newParentId: null, newName: "renamed.txt" },
      { "if-match": "1" },
    );
    expect(staleMove.status).toBe(409);

    const moved = await call(
      "POST",
      `/sync/files/${file.id}/move`,
      { newParentId: null, newName: "renamed.txt" },
      { "if-match": "2" },
    );
    expect(moved.body.file.name).toBe("renamed.txt");

    const deleted = await call("DELETE", `/sync/files/${file.id}`, undefined, { "if-match": "3" });
    expect(deleted.status).toBe(200);

    const after = await call("GET", "/sync/tree");
    expect(after.body.entries.some((entry: { id: string }) => entry.id === file.id)).toBe(false);
  });

  test("bad bytes are rejected at commit as integrity_failed", async () => {
    const declared = Buffer.from("declared bytes\n");
    const created = await call("POST", "/sync/uploads", {
      name: "bad.txt",
      size: declared.length,
      hash: sha256(declared),
      idempotencyKey: "bad-upload-1",
    });

    const put = await fetch(created.body.url, {
      method: "PUT",
      headers: created.body.headers,
      body: Buffer.from("other bytes!!\n"),
    });
    expect(put.status).toBe(400);

    const committed = await call("POST", `/sync/uploads/${created.body.sessionId}/commit`, {});
    expect(committed.status).toBe(422);
    expect(committed.body.code).toBe("integrity_failed");
  });

  test("multipart upload commits 65 MiB in parts", async () => {
    const bytes = Buffer.alloc(65 * 1024 * 1024, 7);
    const created = await call("POST", "/sync/uploads", {
      name: "big.bin",
      size: bytes.length,
      hash: sha256(bytes),
      mimeType: "application/octet-stream",
      idempotencyKey: "big-upload-1",
    });
    expect(created.body.mode).toBe("multipart");

    const partSize = created.body.partSize as number;
    const count = Math.ceil(bytes.length / partSize);
    const urls = await call("POST", `/sync/uploads/${created.body.sessionId}/parts`, {
      partNumbers: Array.from({ length: count }, (_, index) => index + 1),
    });

    const parts = await Promise.all(
      urls.body.parts.map(async (part: { partNumber: number; url: string }) => {
        const start = (part.partNumber - 1) * partSize;
        const put = await fetch(part.url, {
          method: "PUT",
          body: bytes.subarray(start, start + partSize),
        });

        return { partNumber: part.partNumber, etag: put.headers.get("etag") ?? "" };
      }),
    );

    const committed = await call(
      "POST",
      `/sync/uploads/${created.body.sessionId}/commit`,
      { parts },
    );
    expect(committed.status).toBe(200);
    expect(committed.body.file.size).toBe(bytes.length);
  });

  test("run logs are idempotent per run id", async () => {
    const run = {
      runId: "run-1",
      trigger: "open",
      startedAt: new Date(Date.now() - 1000).toISOString(),
      finishedAt: new Date().toISOString(),
      status: "ok",
      counts: { uploaded: 1 },
      bytesUp: 10,
      bytesDown: 0,
    };

    expect((await call("POST", "/sync/logs", run)).status).toBe(201);
    expect((await call("POST", "/sync/logs", run)).status).toBe(201);

    const logs = await call("GET", "/sync/logs");
    expect(logs.body.runs.filter((item: { runId: string }) => item.runId === "run-1")).toHaveLength(1);
  });
});

describe("long poll", () => {
  test("returns as soon as a change lands", async () => {
    const tree = await call("GET", "/sync/tree");
    const started = Date.now();
    const held = call("GET", `/sync/changes?cursor=${tree.body.cursor}&wait=5&deviceId=${randomUUID()}`);

    await new Promise((resolve) => setTimeout(resolve, 300));
    await call("POST", "/sync/folders", { name: `Poll ${randomUUID()}` });

    const result = await held;

    expect(result.body.changes.length).toBeGreaterThan(0);
    expect(Date.now() - started).toBeLessThan(4000);
  });

  test("an idle poll returns empty after the wait", async () => {
    const tree = await call("GET", "/sync/tree");
    const started = Date.now();
    const result = await call("GET", `/sync/changes?cursor=${tree.body.cursor}&wait=1&deviceId=${randomUUID()}`);

    expect(result.body.changes).toEqual([]);
    expect(Date.now() - started).toBeGreaterThanOrEqual(900);
  });

  test("a second held poll from the same device is rejected", async () => {
    const tree = await call("GET", "/sync/tree");
    const device = randomUUID();
    const first = call("GET", `/sync/changes?cursor=${tree.body.cursor}&wait=2&deviceId=${device}`);

    await new Promise((resolve) => setTimeout(resolve, 100));

    const second = await call("GET", `/sync/changes?cursor=${tree.body.cursor}&wait=1&deviceId=${device}`);

    expect(second.status).toBe(429);
    expect(second.body.code).toBe("rate_limited");
    await first;
  });
});
