import type { FolderListItem } from "@repo/drizzle";
import { apiJson } from "./api";

type CreateFolderInput = { name: string; parentId: string | null };

export function createFolder(input: CreateFolderInput) {
  return apiJson<{ folder: FolderListItem }>("/folders", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
