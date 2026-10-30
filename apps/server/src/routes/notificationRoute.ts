import type { FastifyInstance } from "fastify";
import { listSharesSince } from "@repo/drizzle";
import { serverEnv } from "@repo/env";
import { shareChannel, subscriber } from "@repo/node-redis";

type StreamQuery = { since?: string };

const HEARTBEAT_MS = 25_000;
const CURSOR = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}$/;

export default async function notificationRoute(fastify: FastifyInstance) {
  fastify.get<{ Querystring: StreamQuery }>(
    "/notifications/stream",
    async (request, reply) => {
      const userId = request.user?.id;

      if (!userId) {
        return reply.code(401).send({ message: "Unauthorized" });
      }

      // EventSource sends Last-Event-ID on reconnect, so it wins over `since`.
      const since =
        [request.headers["last-event-id"], request.query.since].find(
          (value): value is string =>
            typeof value === "string" && CURSOR.test(value),
        ) ?? null;

      reply.hijack();
      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": serverEnv.CLIENT_URL,
        "Access-Control-Allow-Credentials": "true",
      });

      let cursor = since;
      let queue = Promise.resolve();

      // Every event carries the cursor as its id, so the client can resume.
      const drain = async () => {
        let more = true;
        while (more) {
          const page = await listSharesSince({ userId, since: cursor });
          cursor = page.cursor;
          reply.raw.write(
            `event: shares\nid: ${cursor}\ndata: ${JSON.stringify(page.shares)}\n\n`,
          );
          more = page.more;
        }
      };

      // Serialized, so two wake-ups can't send the same rows twice.
      const wake = () => {
        if (request.raw.destroyed) return;
        queue = queue.then(drain).catch((error) => request.log.error(error));
      };

      const channel = shareChannel(userId);
      await subscriber.subscribe(channel, wake);
      wake();

      const heartbeat = setInterval(
        () => reply.raw.write(": ping\n\n"),
        HEARTBEAT_MS,
      );

      request.raw.on("close", () => {
        clearInterval(heartbeat);
        subscriber
          .unsubscribe(channel, wake)
          .catch((error) => request.log.error(error));
      });
    },
  );
}
