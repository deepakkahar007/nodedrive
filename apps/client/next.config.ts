import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  transpilePackages: [
    "@repo/auth",
    "@repo/drizzle",
    "@repo/env",
    "@repo/sync-client",
    "@repo/sync-core",
    "@repo/sync-protocol",
  ],
};

export default nextConfig;
