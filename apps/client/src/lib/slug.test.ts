import { expect, test } from "bun:test";
import { createOrganizationSlug, createSlugSuffix, slugify } from "./slug";

test("slugify keeps only url-safe characters", () => {
  expect(slugify("  Acme Design Co.  ")).toBe("acme-design-co");
  expect(slugify("héllo__world")).toBe("h-llo-world");
});

test("slugify falls back for empty or symbol-only names", () => {
  expect(slugify("")).toBe("org");
  expect(slugify("***")).toBe("org");
});

test("slugify caps the base length", () => {
  expect(slugify("a".repeat(80))).toHaveLength(32);
});

test("organization slugs carry a uuid fragment and stay unique", () => {
  const slug = createOrganizationSlug("Acme Design Co.");
  expect(slug).toMatch(/^acme-design-co-[0-9a-f]{8}$/);
  expect(slug).not.toBe(createOrganizationSlug("Acme Design Co."));
});

test("slug suffix is eight lowercase hex characters", () => {
  expect(createSlugSuffix()).toMatch(/^[0-9a-f]{8}$/);
});
