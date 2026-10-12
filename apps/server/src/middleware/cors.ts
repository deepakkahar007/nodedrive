import cors, { type FastifyCorsOptions } from "@fastify/cors";

export const corsOptions: FastifyCorsOptions = {
  origin: process.env.CORS_ORIGIN,
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

export const corsPlugin = cors;
