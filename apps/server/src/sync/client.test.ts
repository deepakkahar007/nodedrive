import "fake-indexeddb/auto";
import { beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import Fastify, { type FastifyInstance } from "fastify";
import { createTestUser, db, pruneChanges } from "@repo/drizzle";
import { serverEnv } from "@repo/env";
import { bucketName, ensureBucket } from "@repo/storage";
import { connectRedis } from "@repo/node-redis";
import {
  createMemoryFs,
  createSyncDb,
  createSyncEngine,
  createSyncLoop,
  type CycleResult,
  type LocalFs,
} from "@repo/sync-client";
import syncRoute from "../routes/syncRoute";

const API = "http://sync.test";
let app: FastifyInstance;
let account: string;

// Routes /sync calls to the in-process server; everything else (presigned S3 URLs) goes to MinIO.
const routedFetch = (async (input, init) => {
  const url = new URL(String(input));

  if (url.origin !== API) return fetch(input, init);

  const response = await app.inject({
    method: (init?.method ?? "GET") as "GET",
    url: `${url.pathname}${url.search}`,
    headers: Object.fromEntries(new Headers(init?.headers).entries()),
    payload: typeof init?.body === "string" ? init.body : undefined,
  });

  return new Response(response.rawPayload, {
    status: response.statusCode,
    headers: response.headers as Record<string, string>,
  });
}) as typeof fetch;

const IDLE = { uploaded: 0, downloaded: 0, deleted: 0, moved: 0, adopted: 0, conflicts: 0, errors: 0, bytesUp: 0, bytesDown: 0 };

type Device = {
  fs: LocalFs;
  sync: () => Promise<CycleResult>;
  engine: ReturnType<typeof createSyncEngine>;
  db: ReturnType<typeof createSyncDb>;
};

function createDevice(label: string): Device {
  const fs = createMemoryFs();
  const db = createSyncDb(`device-${randomUUID()}`);
  const engine = createSyncEngine({
    baseUrl: API,
    fs,
    db,
    deviceLabel: label,
    fetch: routedFetch,
    sleep: async () => undefined,
  });

  return { fs, db, engine, sync: () => engine.cycle("manual") };
}

async function write(fs: LocalFs, path: string, text: string) {
  const sink = await fs.openWrite(path);

  await sink.write(new TextEncoder().encode(text));
  await sink.close();
}

async function read(fs: LocalFs, path: string) {
  return (await fs.read(path)).text();
}

async function listedPaths(fs: LocalFs) {
  return (await fs.list()).map((entry) => entry.path).sort();
}

async function remotePaths(): Promise<string[]> {
  const response = await routedFetch(`${API}/sync/tree`, {
    headers: { "Content-Type": "application/json" },
  });
  const tree = (await response.json()) as { entries: { name: string; parentId: string | null }[] };

  return tree.entries.map((entry) => entry.name).sort();
}

beforeAll(async () => {
  if (!serverEnv.DATABASE_URL.endsWith("/nodedrive_test") || !bucketName.endsWith("-test")) {
    throw new Error("Client integration tests only run against nodedrive_test and a *-test bucket");
  }

  await ensureBucket();
  await connectRedis();
  app = Fastify();
  app.addHook("onRequest", async (request) => {
    (request as { user: unknown }).user = { id: account };
  });
  await app.register(syncRoute);
});

beforeEach(async () => {
  account = await createTestUser();
});

describe("two devices, one account", () => {
  test("first sync uploads folders and files; a second device downloads them", async () => {
    const laptop = createDevice("laptop");
    const phone = createDevice("phone");

    await write(laptop.fs, "a.txt", "alpha");
    await write(laptop.fs, "docs/readme.md", "# readme");
    await write(laptop.fs, "docs/deep/x.bin", "deep bytes");

    const first = await laptop.sync();
    expect(first.status).toBe("ok");
    expect(first.counts.uploaded).toBe(3);
    expect(await remotePaths()).toEqual(["a.txt", "deep", "docs", "readme.md", "x.bin"]);

    const second = await phone.sync();
    expect(second.status).toBe("ok");
    expect(await read(phone.fs, "docs/deep/x.bin")).toBe("deep bytes");
    expect(await listedPaths(phone.fs)).toEqual(await listedPaths(laptop.fs));

    expect((await phone.sync()).counts).toEqual(IDLE);
    expect((await laptop.sync()).counts).toEqual(IDLE);

    const logs = await routedFetch(`${API}/sync/logs`);
    const body = (await logs.json()) as { runs: unknown[] };
    expect(body.runs.length).toBeGreaterThanOrEqual(4);
  });

  test("edits and deletes propagate through the change feed", async () => {
    const laptop = createDevice("laptop");
    const phone = createDevice("phone");

    await write(laptop.fs, "notes.txt", "v1");
    await write(laptop.fs, "gone.txt", "bye");
    await laptop.sync();
    await phone.sync();

    await write(laptop.fs, "notes.txt", "v2 longer");
    await laptop.fs.remove("gone.txt");
    await laptop.sync();

    const pulled = await phone.sync();

    expect(pulled.status).toBe("ok");
    expect(await read(phone.fs, "notes.txt")).toBe("v2 longer");
    expect(await listedPaths(phone.fs)).toEqual(["notes.txt"]);
  });

  test("conflicting edits keep both versions", async () => {
    const laptop = createDevice("laptop");
    const phone = createDevice("phone");

    await write(laptop.fs, "plan.md", "original");
    await laptop.sync();
    await phone.sync();

    await write(laptop.fs, "plan.md", "laptop edit");
    await laptop.sync();

    await write(phone.fs, "plan.md", "phone edit");
    const result = await phone.sync();

    expect(result.counts.conflicts).toBe(1);
    expect(await read(phone.fs, "plan.md")).toBe("laptop edit");
    expect((await phone.db.conflicts.toArray()).map((item) => item.path)).toEqual(["plan.md"]);

    const copy = (await listedPaths(phone.fs)).find((path) => path.includes("conflicted copy"));

    expect(copy).toBeDefined();
    expect(await read(phone.fs, copy ?? "")).toBe("phone edit");
    expect(await remotePaths()).toContain(copy?.split("/").pop() ?? "");
  });

  test("a crash mid multipart upload resumes from the saved parts", async () => {
    const laptop = createDevice("laptop");
    const bytes = new Uint8Array(65 * 1024 * 1024).fill(9);
    const sink = await laptop.fs.openWrite("big.bin");

    await sink.write(bytes);
    await sink.close();

    let failPart3 = true;
    let partPuts = 0;
    const flaky = (async (input, init) => {
      const url = String(input);

      if (url.includes("partNumber=")) {
        partPuts += 1;
        if (failPart3 && url.includes("partNumber=3&")) {
          return new Response("boom", { status: 500 });
        }
      }

      return routedFetch(input, init);
    }) as typeof fetch;
    const engine = createSyncEngine({
      baseUrl: API,
      fs: laptop.fs,
      db: createSyncDb(`crash-${randomUUID()}`),
      deviceLabel: "laptop",
      fetch: flaky,
      sleep: async () => undefined,
    });

    const crashed = await engine.cycle();
    expect(crashed.status).toBe("partial");
    expect(crashed.counts.uploaded).toBe(0);

    failPart3 = false;
    partPuts = 0;
    const resumed = await engine.cycle();

    expect(resumed.status).toBe("ok");
    expect(resumed.counts.uploaded).toBe(1);
    expect(partPuts).toBe(3);
    expect(await remotePaths()).toContain("big.bin");
  });

  test("a local rename is one server move, with no bytes moved on either device", async () => {
    const laptop = createDevice("laptop");
    const phone = createDevice("phone");

    await write(laptop.fs, "draft.txt", "same bytes");
    await laptop.sync();
    await phone.sync();

    await write(laptop.fs, "final.txt", await read(laptop.fs, "draft.txt"));
    await laptop.fs.remove("draft.txt");

    const renamed = await laptop.sync();

    expect(renamed.counts).toEqual({ ...IDLE, moved: 1 });
    expect(await remotePaths()).toEqual(["final.txt"]);

    const pulled = await phone.sync();

    expect(pulled.counts).toEqual({ ...IDLE, moved: 1 });
    expect(await listedPaths(phone.fs)).toEqual(["final.txt"]);
    expect(await read(phone.fs, "final.txt")).toBe("same bytes");
    expect((await phone.sync()).counts).toEqual(IDLE);
  });

  test("a device behind the pruned change log resets to a full tree", async () => {
    const laptop = createDevice("laptop");
    const phone = createDevice("phone");

    await write(laptop.fs, "one.txt", "1");
    await laptop.sync();
    await phone.sync();

    await write(laptop.fs, "two.txt", "2");
    await laptop.sync();

    const tree = (await (await routedFetch(`${API}/sync/tree`)).json()) as { cursor: number };

    await pruneChanges({ userId: account, beforeSeq: tree.cursor });

    const reset = await phone.sync();

    expect(reset.status).toBe("ok");
    expect(reset.counts.downloaded).toBe(1);
    expect(await listedPaths(phone.fs)).toEqual(["one.txt", "two.txt"]);
  });

  test("a change reaches a waiting device without a manual sync", async () => {
    const laptop = createDevice("laptop");
    const phone = createDevice("phone");

    await write(laptop.fs, "seed.txt", "seed");
    await laptop.sync();
    await phone.sync();

    const loop = createSyncLoop({ engine: phone.engine, pollWaitSeconds: 2, intervalMs: 60_000 });

    loop.start();
    await new Promise((resolve) => setTimeout(resolve, 300));

    await write(laptop.fs, "live.txt", "live");

    const started = Date.now();

    await laptop.sync();

    while (!(await listedPaths(phone.fs)).includes("live.txt") && Date.now() - started < 8000) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    loop.stop();

    expect(await listedPaths(phone.fs)).toContain("live.txt");
    expect(Date.now() - started).toBeLessThan(6000);
  });

  test("a shared lock keeps cycles from overlapping across tabs", async () => {
    const memory = createMemoryFs();
    const db = createSyncDb(`tabs-${randomUUID()}`);
    let active = 0;
    let peak = 0;
    const slow: LocalFs = {
      ...memory,
      list: async () => {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 30));
        active -= 1;

        return memory.list();
      },
    };
    let chain: Promise<unknown> = Promise.resolve();
    const lock = <T,>(task: () => Promise<T>): Promise<T> => {
      const run = chain.then(task);

      chain = run.catch(() => undefined);

      return run;
    };
    const tab = () =>
      createSyncEngine({
        baseUrl: API,
        fs: slow,
        db,
        deviceLabel: "tab",
        fetch: routedFetch,
        sleep: async () => undefined,
        lock,
      });

    const results = await Promise.all([tab().cycle(), tab().cycle(), tab().cycle()]);

    expect(results.map((result) => result.status)).toEqual(["ok", "ok", "ok"]);
    expect(peak).toBe(1);
  });

  test("emptying the synced folder is blocked by the delete guard", async () => {
    const laptop = createDevice("laptop");

    await write(laptop.fs, "one.txt", "1");
    await write(laptop.fs, "two.txt", "2");
    await write(laptop.fs, "three.txt", "3");
    await laptop.sync();

    await laptop.fs.remove("one.txt");
    await laptop.fs.remove("two.txt");
    await laptop.fs.remove("three.txt");

    const result = await laptop.sync();

    expect(result.status).toBe("paused");
    expect(result.counts.deleted).toBe(0);
    expect(await remotePaths()).toEqual(["one.txt", "three.txt", "two.txt"]);

    laptop.engine.confirmDeletes();
    const confirmed = await laptop.sync();

    expect(confirmed.status).toBe("ok");
    expect(confirmed.counts.deleted).toBe(3);
    expect(await remotePaths()).toEqual([]);
  });
});
