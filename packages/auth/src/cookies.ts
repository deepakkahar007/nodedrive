import { getSessionCookie } from "better-auth/cookies";

export function hasSessionCookie(request: Request | Headers) {
  return Boolean(getSessionCookie(request));
}
