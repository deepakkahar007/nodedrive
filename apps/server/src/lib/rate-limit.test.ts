import { beforeAll, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import Fastify from "fastify";
import { connectRedis } from "@repo/node-redis";
import { rateLimit } from "./rate-limit";

beforeAll(connectRedis);

test("requests over the per-account limit get 429 with Retry-After", async () => {
  const userId = randomUUID();
  const app = Fastify();

  app.addHook("onRequest", async (request) => {
    (request as { user: unknown }).user = { id: userId };
  });
  app.addHook("onRequest", rateLimit({ limit: 2, windowSeconds: 60 }));
  app.get("/ping", async () => ({ ok: true }));

  const statuses = [];

  for (let index = 0; index < 3; index += 1) {
    statuses.push((await app.inject({ method: "GET", url: "/ping" })).statusCode);
  }

  const last = await app.inject({ method: "GET", url: "/ping" });

  expect(statuses).toEqual([200, 200, 429]);
  expect(last.statusCode).toBe(429);
  expect(last.headers["retry-after"]).toBe("60");
  await app.close();
});
