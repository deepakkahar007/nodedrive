import { clientEnv } from "@repo/env/client";

const baseUrl = clientEnv.NEXT_PUBLIC_BETTER_AUTH_URL;

async function errorMessage(response: Response): Promise<string> {
  const fallback = `Request failed (HTTP ${response.status})`;

  try {
    const data = (await response.json()) as { message?: unknown };
    return typeof data.message === "string" ? data.message : fallback;
  } catch {
    return fallback;
  }
}

/** Authenticated JSON request to the server API. */
export async function apiJson<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);

  if (init.body) headers.set("Content-Type", "application/json");

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    credentials: "include",
    headers,
  });

  if (!response.ok) throw new Error(await errorMessage(response));

  return (await response.json()) as T;
}
