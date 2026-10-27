import { apiJson } from "./api";

export type FileDownload = {
  url: string;
  name: string;
};

export type FileUpdate = {
  starred?: boolean;
  trashed?: boolean;
};

export type SharedFileUser = {
  id: string;
  name: string;
  email: string;
};

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
