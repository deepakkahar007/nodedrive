import { getSession as getAuthSession } from "@repo/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

/** Session or `null`. Safe to call from anywhere, including public routes. */
export async function getSession() {
  return getAuthSession({ headers: await headers() });
}

/** Session for authenticated routes; redirects to sign-in when absent. */
export async function requireSession() {
  const session = await getSession();

  if (!session) {
    redirect("/auth");
  }

  return session;
}
