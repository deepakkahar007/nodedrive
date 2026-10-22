import fp from "fastify-plugin";
import { auth } from "@repo/auth";
import { toHeaders } from "../lib/headers";

type AuthSession = typeof auth.$Infer.Session;

declare module "fastify" {
  interface FastifyRequest {
    session: AuthSession["session"] | null;
    user: AuthSession["user"] | null;
  }
}

const PUBLIC_PATHS = new Set(["/", "/health"]);

export default fp(async (fastify) => {
  fastify.decorateRequest("session", null);
  fastify.decorateRequest("user", null);

  fastify.addHook("onRequest", async (request, reply) => {
    const path = request.url.split("?")[0] ?? "";

    if (
      request.method === "OPTIONS" ||
      PUBLIC_PATHS.has(path) ||
      path === "/api/auth" ||
      path.startsWith("/api/auth/")
    ) {
      return;
    }

    const authSession = await auth.api.getSession({
      headers: toHeaders(request.headers),
    });

    if (!authSession) {
      return reply.code(401).send({ message: "Unauthorized" });
    }

    request.session = authSession.session;
    request.user = authSession.user;
  });
});
