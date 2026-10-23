import { expect, test } from "bun:test";
import { isDashboardPathActive, isPublicPath } from "./routes";

test("public and auth routes are open", () => {
  const open = ["/", "/about", "/about/team", "/license", "/auth"];
  for (const path of open) expect(isPublicPath(path)).toBe(true);
});

test("everything else is protected", () => {
  const protectedPaths = [
    "/dashboard",
    "/dashboard/files",
    "/dashboard/search",
    "/create-organization",
    "/settings",
  ];
  for (const path of protectedPaths) expect(isPublicPath(path)).toBe(false);
});

test("prefixes do not leak across route boundaries", () => {
  expect(isPublicPath("/about-us")).toBe(false);
  expect(isPublicPath("/authentication")).toBe(false);
});

test("dashboard nav highlights only the matching section", () => {
  expect(isDashboardPathActive("/dashboard", "/dashboard")).toBe(true);
  expect(isDashboardPathActive("/dashboard/my-drive", "/dashboard")).toBe(
    false,
  );
  expect(
    isDashboardPathActive("/dashboard/my-drive", "/dashboard/my-drive"),
  ).toBe(true);
  expect(
    isDashboardPathActive("/dashboard/my-drive/folder", "/dashboard/my-drive"),
  ).toBe(true);
  expect(
    isDashboardPathActive("/dashboard/my-drive-2", "/dashboard/my-drive"),
  ).toBe(false);
});
