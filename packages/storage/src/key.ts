import { randomUUID } from "node:crypto";

export type StorageKeyInput = {
  userId: string;
  organizationId?: string | null;
  folderId?: string | null;
  fileName: string;
};

/** Build a user/org-scoped, collision-free object key. Call server-side only. */
export function createStorageKey(input: StorageKeyInput): string {
  const scope = input.organizationId
    ? `organizations/${input.organizationId}`
    : `users/${input.userId}`;
  const folder = input.folderId ? `/folders/${input.folderId}` : "";
  const name = input.fileName
    .trim()
    .replace(/[/\\?%*:|"<>]/g, "_")
    .replace(/\.{2,}/g, ".")
    .slice(-120);

  return `${scope}${folder}/${randomUUID()}-${name || "file"}`;
}
