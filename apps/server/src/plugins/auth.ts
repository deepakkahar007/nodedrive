import fp from "fastify-plugin";
import { handleAuthRequest } from "@repo/auth";
import { serverEnv } from "@repo/env";
import { toHeaders } from "../lib/headers";

const SKIPPED_RESPONSE_HEADERS = new Set([
  "set-cookie",
  "content-length",
  "content-encoding",
  "transfer-encoding",
]);

export default fp(async (fastify) => {
  fastify.route({
    method: ["GET", "POST"],
    url: "/api/auth/*",
    handler: async (request, reply) => {
      const headers = toHeaders(request.headers);

      const hasBody =
        request.method !== "GET" &&
        request.method !== "HEAD" &&
        request.body !== undefined;

      const response = await handleAuthRequest({
        url: new URL(request.url, serverEnv.BETTER_AUTH_URL).toString(),
        method: request.method,
        headers,
        body: hasBody ? JSON.stringify(request.body) : undefined,
      });

      reply.status(response.status);
      response.headers.forEach((value, key) => {
        if (!SKIPPED_RESPONSE_HEADERS.has(key.toLowerCase())) {
          reply.header(key, value);
        }
      });
      const cookies = response.headers.getSetCookie();
      if (cookies.length > 0) reply.header("set-cookie", cookies);

      return reply.send(Buffer.from(await response.arrayBuffer()));
    },
  });
});
