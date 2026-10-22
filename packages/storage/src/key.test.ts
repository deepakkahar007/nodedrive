import { describe, expect, test } from "bun:test";
import { createStorageKey } from "./key";

describe("createStorageKey", () => {
  test("scopes to user and folder", () => {
    const key = createStorageKey({
      userId: "user-1",
      folderId: "folder-1",
      fileName: "report.pdf",
    });

    expect(key.startsWith("users/user-1/folders/folder-1/")).toBe(true);
    expect(key.endsWith("-report.pdf")).toBe(true);
  });

  test("scopes to organization when present", () => {
    const key = createStorageKey({
      userId: "user-1",
      organizationId: "org-1",
      fileName: "report.pdf",
    });

    expect(key.startsWith("organizations/org-1/")).toBe(true);
  });

  test("strips path traversal and separators", () => {
    const key = createStorageKey({
      userId: "user-1",
      fileName: "../../etc/passwd",
    });

    expect(key).not.toContain("..");
    expect(key).not.toContain("/etc/");
  });

  test("generates unique keys for the same file", () => {
    const input = { userId: "user-1", fileName: "same.txt" };

    expect(createStorageKey(input)).not.toBe(createStorageKey(input));
  });

  test("falls back when the name is empty", () => {
    const key = createStorageKey({ userId: "user-1", fileName: "   " });

    expect(key.endsWith("-file")).toBe(true);
  });
});
