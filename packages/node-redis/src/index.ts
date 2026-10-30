import { serverEnv } from "@repo/env";
import { createClient } from "redis";

export const redis = createClient({ url: serverEnv.REDIS_URL });
// A subscribing connection can't run other commands, so it gets its own client.
export const subscriber = redis.duplicate();

redis.on("error", (error) => console.error("[redis]", error.message));
subscriber.on("error", (error) =>
  console.error("[redis:subscriber]", error.message),
);

export const shareChannel = (userId: string) => `shares:${userId}`;

export async function connectRedis(): Promise<void> {
  if (!redis.isOpen) await redis.connect();
  if (!subscriber.isOpen) await subscriber.connect();
}

export async function checkRedisConnection(): Promise<void> {
  await connectRedis();
  await redis.ping();
}
