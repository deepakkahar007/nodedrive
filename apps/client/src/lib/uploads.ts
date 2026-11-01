import { apiJson } from "./api";

export type PresignedUpload = {
  key: string;
  url: string;
  headers: Record<string, string>;
};

export type UploadedFile = {
  id: string;
  name: string;
  originalName: string;
  storage_url: string;
  size: number;
  mime_type: string;
};

type CompleteInput = {
  key: string;
  name: string;
  mimeType: string;
};

export async function presignUploads(
  files: File[],
  organizationId: string | null,
  folderId: string | null = null,
): Promise<PresignedUpload[]> {
  const data = await apiJson<{ files: PresignedUpload[] }>("/uploads/presign", {
    method: "POST",
    body: JSON.stringify({
      organizationId,
      folderId,
      files: files.map((file) => ({
        name: file.name,
        size: file.size,
        mimeType: file.type || "application/octet-stream",
      })),
    }),
  });

  return data.files;
}

export async function completeUploads(
  files: CompleteInput[],
  organizationId: string | null,
  folderId: string | null = null,
): Promise<UploadedFile[]> {
  const data = await apiJson<{ files: UploadedFile[] }>("/uploads/complete", {
    method: "POST",
    body: JSON.stringify({ organizationId, folderId, files }),
  });

  return data.files;
}

export type FileStatus = "uploading" | "done" | "error";

type UploadOptions = {
  organizationId: string | null;
  folderId: string | null;
  onStatus: (file: File, status: FileStatus) => void;
  onProgress: (percent: number) => void;
};

export type UploadOutcome = { uploaded: File[]; failed: File[] };

/** Presign, PUT each file, then record the ones that landed. */
export async function uploadFiles(
  files: File[],
  { organizationId, folderId, onStatus, onProgress }: UploadOptions,
): Promise<UploadOutcome> {
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  const percent = (bytes: number) =>
    totalBytes > 0 ? Math.round((bytes / totalBytes) * 100) : 100;
  const presigned = await presignUploads(files, organizationId, folderId);
  const uploaded: { file: File; key: string }[] = [];
  const failed: File[] = [];
  let settledBytes = 0;

  for (const [index, file] of files.entries()) {
    const target = presigned[index];

    if (!target) {
      failed.push(file);
      onStatus(file, "error");
      continue;
    }

    onStatus(file, "uploading");

    try {
      await uploadToStorage(target.url, file, target.headers, (loaded) =>
        onProgress(percent(settledBytes + Math.min(loaded, file.size))),
      );
      uploaded.push({ file, key: target.key });
      onStatus(file, "done");
    } catch {
      failed.push(file);
      onStatus(file, "error");
    } finally {
      settledBytes += file.size;
      onProgress(percent(settledBytes));
    }
  }

  if (uploaded.length > 0) {
    await completeUploads(
      uploaded.map(({ file, key }) => ({
        key,
        name: file.name,
        mimeType: file.type || "application/octet-stream",
      })),
      organizationId,
      folderId,
    );
  }

  return { uploaded: uploaded.map(({ file }) => file), failed };
}

/** Browser PUT with upload progress. Uses XHR because fetch cannot report it. */
export function uploadToStorage(
  url: string,
  file: File,
  headers: Record<string, string>,
  onProgress: (loadedBytes: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();

    request.open("PUT", url);

    for (const [name, value] of Object.entries(headers)) {
      request.setRequestHeader(name, value);
    }

    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) onProgress(event.loaded);
    });

    request.addEventListener("load", () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(file.size);
        resolve();
        return;
      }

      reject(
        new Error(`Storage rejected ${file.name} (HTTP ${request.status})`),
      );
    });

    request.addEventListener("error", () => {
      reject(new Error(`Could not upload ${file.name}`));
    });

    request.addEventListener("abort", () => {
      reject(new Error(`Upload cancelled: ${file.name}`));
    });

    request.send(file);
  });
}
