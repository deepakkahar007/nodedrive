import type { FolderListItem } from "@repo/drizzle";

export type FolderOption = FolderListItem & { depth: number; path: string };

/** Flat, depth-first folder list with path labels for pickers. */
export function folderOptions(folders: FolderListItem[]): FolderOption[] {
  const children = new Map<string | null, FolderListItem[]>();

  for (const folder of folders) {
    const siblings = children.get(folder.parentId) ?? [];

    siblings.push(folder);
    children.set(folder.parentId, siblings);
  }

  for (const siblings of children.values()) {
    siblings.sort((a, b) => a.name.localeCompare(b.name));
  }

  const options: FolderOption[] = [];
  const seen = new Set<string>();

  function walk(parentId: string | null, depth: number, prefix: string) {
    for (const folder of children.get(parentId) ?? []) {
      if (seen.has(folder.id)) continue;

      seen.add(folder.id);
      const path = prefix ? `${prefix} / ${folder.name}` : folder.name;

      options.push({ ...folder, depth, path });
      walk(folder.id, depth + 1, path);
    }
  }

  walk(null, 0, "");

  // Orphans or cycles stay selectable instead of vanishing.
  for (const folder of [...folders].sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    if (seen.has(folder.id)) continue;

    seen.add(folder.id);
    options.push({ ...folder, depth: 0, path: folder.name });
  }

  return options;
}
