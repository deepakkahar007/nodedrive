import { getSessionCookie } from "@repo/auth/cookies";
import { type NextRequest, NextResponse } from "next/server";
import { isPublicPath } from "@/lib/routes";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Optimistic guard: no session cookie at all means no access to protected
  // routes. The verified check runs in the route group layouts.
  if (!isPublicPath(pathname) && !getSessionCookie(request)) {
    return NextResponse.redirect(new URL("/auth/sign-in", request.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
