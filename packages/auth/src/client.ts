import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";
import { clientEnv } from "@repo/env/client";

export const authClient = createAuthClient({
  baseURL: clientEnv.NEXT_PUBLIC_BETTER_AUTH_URL,
  plugins: [organizationClient()],
});
