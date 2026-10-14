import Fastify from "fastify";
import { envToLogger } from "./middleware/pinoLogger";
import { randomUUID } from "node:crypto";
import cors from "@fastify/cors";
import { auth } from "@repo/auth";
import { serverEnv } from "@repo/env";

const fastify = Fastify({
  logger: envToLogger["development"] ?? true,
  genReqId: () => randomUUID(),
});

await fastify.register(cors, {
  origin: serverEnv.CLIENT_URL,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
});

// Bridge Fastify <-> Web Request so better-auth's handler runs through
// Fastify's response pipeline and the CORS plugin can add its headers.
// The raw node handler bypasses that pipeline, which drops ACAO on real
// requests (browser then reports "Failed to fetch").
const SKIPPED_RESPONSE_HEADERS = new Set([
  "set-cookie",
  "content-length",
  "content-encoding",
  "transfer-encoding",
]);

fastify.route({
  method: ["GET", "POST"],
  url: "/api/auth/*",
  handler: async (request, reply) => {
    const headers = new Headers();
    for (const [key, value] of Object.entries(request.headers)) {
      if (Array.isArray(value)) for (const item of value) headers.append(key, item);
      else if (value !== undefined) headers.set(key, value);
    }

    const hasBody =
      request.method !== "GET" &&
      request.method !== "HEAD" &&
      request.body !== undefined;

    const response = await auth.handler(
      new Request(
        new URL(request.url, serverEnv.BETTER_AUTH_URL).toString(),
        {
          method: request.method,
          headers,
          body: hasBody ? JSON.stringify(request.body) : undefined,
        },
      ),
    );

    reply.status(response.status);
    response.headers.forEach((value, key) => {
      if (!SKIPPED_RESPONSE_HEADERS.has(key.toLowerCase())) {
        reply.header(key, value);
      }
    });
    const cookies = response.headers.getSetCookie();
    if (cookies.length > 0) reply.header("set-cookie", cookies);

    reply.send(Buffer.from(await response.arrayBuffer()));
  },
});

fastify.get("/", (request, reply) => {
  reply.send({ message: "nodedrive server running" });
});

fastify.get("/health", (request, reply) => {
  reply.send({ status: "OK" });
});

fastify.listen({ port: 3001 }, (err, address) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  // Server is now listening on ${address}
});
