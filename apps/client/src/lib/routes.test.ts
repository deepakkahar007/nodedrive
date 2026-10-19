import { expect, test } from "bun:test";
import { isPublicPath } from "./routes";

test("public and auth routes are open", () => {
  const open = ["/", "/about", "/about/team", "/license", "/auth"];
  for (const path of open) expect(isPublicPath(path)).toBe(true);
});

test("everything else is protected", () => {
  const protectedPaths = [
    "/dashboard",
    "/dashboard/files",
    "/create-organization",
    "/settings",
  ];
  for (const path of protectedPaths) expect(isPublicPath(path)).toBe(false);
});

test("prefixes do not leak across route boundaries", () => {
  expect(isPublicPath("/about-us")).toBe(false);
  expect(isPublicPath("/authentication")).toBe(false);
});
