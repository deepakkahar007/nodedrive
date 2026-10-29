import type { FileSearchItem } from "@repo/drizzle";
import { apiJson } from "./api";

export type FileDownload = {
  url: string;
  name: string;
};

export type FileUpdate = {
  starred?: boolean;
  trashed?: boolean;
  folderId?: string | null;
};

export type SharedFileUser = {
  id: string;
  name: string;
  email: string;
};

export function searchFiles(query: string, signal?: AbortSignal) {
  return apiJson<{ files: FileSearchItem[] }>(
    `/files/search?q=${encodeURIComponent(query)}`,
    { signal },
  );
}

export function getFileDownload(fileId: string) {
  return apiJson<FileDownload>(`/files/${encodeURIComponent(fileId)}/download`);
}

export function shareFile(fileId: string, email: string) {
  return apiJson<{ sharedWith: SharedFileUser }>(
    `/files/${encodeURIComponent(fileId)}/share`,
    { method: "POST", body: JSON.stringify({ email }) },
  );
}

export function updateFile(fileId: string, input: FileUpdate) {
  return apiJson<{ file: unknown }>(`/files/${encodeURIComponent(fileId)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}
