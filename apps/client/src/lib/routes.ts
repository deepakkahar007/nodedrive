/** Route groups. Any path not listed here requires a session. */

/** Reachable without a session. */
export const publicRoutes = ["/", "/about", "/license", "/og"] as const;

/** Sign-in / sign-up. Open to everyone; the session redirect lives in the layout. */
export const authRoutes = ["/auth"] as const;

function matches(pathname: string, routes: readonly string[]) {
  return routes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

/** True when the path is reachable without a session. */
export function isPublicPath(pathname: string) {
  return matches(pathname, publicRoutes) || matches(pathname, authRoutes);
}

/** True when a dashboard nav item should be highlighted for the current path. */
export function isDashboardPathActive(pathname: string, href: string) {
  if (
    href === "/dashboard/my-drive" &&
    pathname.startsWith("/dashboard/folder/")
  ) {
    return true;
  }

  return href === "/dashboard"
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Absolute dashboard URL for post-auth redirects. The auth backend resolves
 * relative callback URLs against its own origin (port 3001), not the client.
 */
export function dashboardUrl() {
  return new URL("/dashboard", window.location.origin).toString();
}
