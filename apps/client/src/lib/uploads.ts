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
  size: string;
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
): Promise<PresignedUpload[]> {
  const data = await apiJson<{ files: PresignedUpload[] }>("/uploads/presign", {
    method: "POST",
    body: JSON.stringify({
      organizationId,
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
): Promise<UploadedFile[]> {
  const data = await apiJson<{ files: UploadedFile[] }>("/uploads/complete", {
    method: "POST",
    body: JSON.stringify({ organizationId, files }),
  });

  return data.files;
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
