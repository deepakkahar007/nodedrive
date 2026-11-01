import { describe, expect, test } from "bun:test";
import {
  backoffMs,
  checkName,
  conflictName,
  guardDeletes,
  pathKey,
  reconcile,
  uniqueName,
  type Action,
  type ReconcileInput,
} from "./index";

const row = (input: ReconcileInput, expected: Action) =>
  test(`${input.local}/${input.remote} base=${input.base} same=${input.sameContent} -> ${expected}`, () => {
    expect(reconcile(input)).toBe(expected);
  });

describe("reconcile (spec 10.5)", () => {
  row({ base: true, local: "same", remote: "same", sameContent: true }, "none");
  row({ base: true, local: "same", remote: "changed", sameContent: false }, "download");
  row({ base: true, local: "changed", remote: "same", sameContent: false }, "upload");
  row({ base: true, local: "changed", remote: "changed", sameContent: true }, "adopt-remote");
  row({ base: true, local: "changed", remote: "changed", sameContent: false }, "conflict");
  row({ base: true, local: "same", remote: "absent", sameContent: false }, "delete-local");
  row({ base: true, local: "absent", remote: "same", sameContent: false }, "delete-remote");
  row({ base: true, local: "changed", remote: "absent", sameContent: false }, "upload-as-new");
  row({ base: true, local: "absent", remote: "changed", sameContent: false }, "download");
  row({ base: true, local: "absent", remote: "absent", sameContent: false }, "drop-record");
  row({ base: false, local: "changed", remote: "changed", sameContent: true }, "adopt-remote");
  row({ base: false, local: "changed", remote: "changed", sameContent: false }, "conflict");
  row({ base: false, local: "absent", remote: "changed", sameContent: false }, "download");
  row({ base: false, local: "changed", remote: "absent", sameContent: false }, "upload-as-new");
  row({ base: false, local: "absent", remote: "absent", sameContent: false }, "none");
  row({ base: true, local: "changed", remote: "changed", sameContent: true, kindMismatch: true }, "conflict");
});

describe("checkName", () => {
  test("normalizes to NFC and trims", () => {
    expect(checkName("  cafe\u0301.txt ")).toEqual({ ok: true, name: "caf\u00e9.txt" });
  });

  test("rejects bad names", () => {
    expect(checkName("a/b").ok).toBe(false);
    expect(checkName("CON.txt").ok).toBe(false);
    expect(checkName("report.").ok).toBe(false);
    expect(checkName("..").ok).toBe(false);
    expect(checkName("x".repeat(256)).ok).toBe(false);
  });
});

describe("pathKey", () => {
  test("folds case for collision checks", () => {
    expect(pathKey("Docs/Read.MD")).toBe(pathKey("docs/read.md"));
  });
});

describe("conflictName", () => {
  test("keeps extension and adds marker", () => {
    expect(conflictName({ name: "plan.md", device: "Laptop", date: "2026-10-31" })).toBe(
      "plan (conflicted copy Laptop 2026-10-31).md",
    );
  });

  test("stays within the name byte limit", () => {
    const name = `${"é".repeat(200)}.txt`;
    const out = conflictName({ name, device: "PC", date: "2026-10-31" });
    expect(new TextEncoder().encode(out).length).toBeLessThanOrEqual(255);
    expect(out.endsWith(".txt")).toBe(true);
  });
});

describe("uniqueName", () => {
  test("keeps a free name, suffixes taken ones case-insensitively", () => {
    expect(uniqueName("a.txt", new Set())).toBe("a.txt");
    expect(uniqueName("a.txt", new Set([pathKey("A.txt")]))).toBe("a (2).txt");
    expect(uniqueName("a.txt", new Set([pathKey("a.txt"), pathKey("a (2).txt")]))).toBe("a (3).txt");
  });

  test("keeps dotfiles and extensionless names intact", () => {
    expect(uniqueName(".env", new Set([pathKey(".env")]))).toBe(".env (2)");
    expect(uniqueName("notes", new Set([pathKey("notes")]))).toBe("notes (2)");
  });
});

describe("guardDeletes", () => {
  test("ok when no deletes", () => {
    expect(guardDeletes({ deletes: 0, known: 0, scanned: 0 })).toBe("ok");
  });

  test("blocks deletes when the folder scans empty", () => {
    expect(guardDeletes({ deletes: 3, known: 3, scanned: 0 })).toBe("block");
  });

  test("asks before mass delete, larger of 20% or 50 files", () => {
    expect(guardDeletes({ deletes: 50, known: 1000, scanned: 900 })).toBe("ok");
    expect(guardDeletes({ deletes: 201, known: 1000, scanned: 900 })).toBe("confirm");
    expect(guardDeletes({ deletes: 50, known: 100, scanned: 50 })).toBe("ok");
    expect(guardDeletes({ deletes: 51, known: 100, scanned: 50 })).toBe("confirm");
  });
});

describe("backoffMs", () => {
  test("stays between 1s and the 30s cap", () => {
    expect(backoffMs(0, () => 0)).toBe(1_000);
    expect(backoffMs(20, () => 1)).toBe(30_000);
    expect(backoffMs(3, () => 0.5)).toBe(4_500);
  });
});
