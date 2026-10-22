import multipart from "@fastify/multipart";
import type { FastifyInstance } from "fastify";
import { createStorageKey, uploadFile } from "@repo/storage";

// ponytail: hard 5 GB cap, same ceiling as a single S3 PUT. Make configurable
// when uploading larger files or switching to multipart presigned uploads.
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024 * 1024;

export default async function uploadRoute(fastify: FastifyInstance) {
  await fastify.register(multipart, {
    limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  });

  fastify.post("/upload", async (request, reply) => {
    const userId = request.user?.id;

    if (!userId) {
      return reply.code(401).send({ message: "Unauthorized" });
    }

    const file = await request.file();

    if (!file) {
      return reply.code(400).send({ message: "No file uploaded" });
    }

    const key = createStorageKey({
      userId,
      fileName: file.filename,
    });

    const result = await uploadFile({
      key,
      body: file.file,
      contentType: file.mimetype,
    });

    return {
      ...result,
      originalName: file.filename,
      mimeType: file.mimetype,
      size: file.file.bytesRead,
    };
  });
}
