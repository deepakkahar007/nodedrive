import type { FastifyReply, FastifyRequest } from "fastify";
import { redis } from "@repo/node-redis";

/** Fixed-window cap per account. Counters live in Redis, so all instances share them. */
export function rateLimit({ limit, windowSeconds }: { limit: number; windowSeconds: number }) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user?.id;

    if (!userId) return;

    const window = Math.floor(Date.now() / 1000 / windowSeconds);
    const key = `rate:${userId}:${window}`;
    const count = await redis.incr(key);

    if (count === 1) await redis.expire(key, windowSeconds);

    if (count > limit) {
      reply.header("Retry-After", String(windowSeconds));

      return reply.code(429).send({ code: "rate_limited", message: "Too many requests" });
    }
  };
}
