import { type FastifyServerOptions } from "fastify";

const env = process.env.NODE_ENV || "development";

export const envToLogger: Record<string, FastifyServerOptions["logger"]> = {
  development: {
    transport: {
      target: "pino-pretty",
      options: {
        translateTime: "HH:MM:ss Z",
        ignore: "pid,hostname",
        colorize: true,
      },
    },
  },
  production: true,
  test: false,
};

export const getLoggerConfig = () => {
  return envToLogger[env] ?? true;
};
