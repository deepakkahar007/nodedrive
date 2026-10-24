import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import { organization } from "better-auth/plugins";
import { db } from "@repo/drizzle";
import { serverEnv } from "@repo/env";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  plugins: [
    organization({
      // Requirement: invitations stay valid for 48 hours.
      invitationExpiresIn: 60 * 60 * 48,
    }),
  ],
  trustedOrigins: [serverEnv.CLIENT_URL],
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    google: {
      clientId: serverEnv.GOOGLE_CLIENT_ID,
      clientSecret: serverEnv.GOOGLE_CLIENT_SECRET,
    },
  },
});
