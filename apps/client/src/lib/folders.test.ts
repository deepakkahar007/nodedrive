import { describe, expect, test } from "bun:test";
import type { FolderListItem } from "@repo/drizzle";
import { folderOptions } from "./folder-options";

function folder(
  id: string,
  name: string,
  parentId: string | null = null,
): FolderListItem {
  return { id, name, parentId, updatedAt: new Date(0) };
}

describe("folderOptions", () => {
  test("nests folders depth-first with path labels", () => {
    const options = folderOptions([
      folder("b", "Work"),
      folder("c", "Q1", "b"),
      folder("a", "Photos"),
    ]);

    expect(options.map((option) => option.path)).toEqual([
      "Photos",
      "Work",
      "Work / Q1",
    ]);
    expect(options.map((option) => option.depth)).toEqual([0, 0, 1]);
  });

  test("keeps orphans and cycles selectable", () => {
    const options = folderOptions([
      folder("x", "Orphan", "missing"),
      folder("y", "Cycle A", "z"),
      folder("z", "Cycle B", "y"),
    ]);

    expect(options).toHaveLength(3);
    expect(options.map((option) => option.id).sort()).toEqual(["x", "y", "z"]);
  });
});
