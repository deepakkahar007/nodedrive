import type {
  ChangeEntry,
  DeviceBody,
  FolderBody,
  MoveBody,
  RunLogBody,
  TreeEntry,
  UploadBody,
} from "@repo/sync-protocol";

export class SyncApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export type UploadSession =
  | { sessionId: string; mode: "single"; partSize: null; expiresAt: string; url: string; headers?: Record<string, string> }
  | { sessionId: string; mode: "multipart"; partSize: number; expiresAt: string };

export type CommitResult = { file: TreeEntry; cursor: number };

export type RunEntry = {
  id: string;
  runId: string;
  trigger: string;
  startedAt: string;
  finishedAt: string;
  status: string;
  counts: Record<string, number>;
  bytesUp: number;
  bytesDown: number;
  errorSummary: string | null;
};

export type SyncApi = ReturnType<typeof createSyncApi>;

type Fetch = typeof fetch;

/** Typed client for /sync. Throws SyncApiError with the server's error code. */
export function createSyncApi({ baseUrl, fetch: doFetch = fetch }: { baseUrl: string; fetch?: Fetch }) {
  async function call<T>(
    method: string,
    path: string,
    body?: unknown,
    headers: Record<string, string> = {},
    signal?: AbortSignal,
  ): Promise<T> {
    const response = await doFetch(`${baseUrl}${path}`, {
      method,
      credentials: "include",
      headers: body === undefined ? headers : { "Content-Type": "application/json", ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { code?: string; message?: string };

      throw new SyncApiError(response.status, data.code ?? "unknown", data.message ?? `HTTP ${response.status}`);
    }

    return (await response.json()) as T;
  }

  return {
    registerDevice: (body: DeviceBody) => call<{ deviceId: string }>("POST", "/sync/devices", body),
    tree: (pageToken?: string) =>
      call<{ entries: TreeEntry[]; cursor: number; nextPageToken: string | null }>(
        "GET",
        `/sync/tree${pageToken ? `?pageToken=${encodeURIComponent(pageToken)}` : ""}`,
      ),
    changes: (cursor: number, limit: number, poll: { wait?: number; deviceId?: string; signal?: AbortSignal } = {}) => {
      const query = new URLSearchParams({ cursor: String(cursor), limit: String(limit) });

      if (poll.wait) query.set("wait", String(poll.wait));
      if (poll.deviceId) query.set("deviceId", poll.deviceId);

      return call<{ changes: ChangeEntry[]; nextCursor: number; hasMore: boolean }>(
        "GET",
        `/sync/changes?${query}`,
        undefined,
        {},
        poll.signal,
      );
    },
    downloadUrls: (fileIds: string[]) =>
      call<{
        files: { id: string; url: string; expiresAt: string; size: number; hash: string | null; revision: number }[];
      }>("POST", "/sync/download-urls", { fileIds }),
    createUpload: (body: UploadBody) => call<UploadSession>("POST", "/sync/uploads", body),
    uploadParts: (sessionId: string, partNumbers: number[]) =>
      call<{ parts: { partNumber: number; url: string }[] }>("POST", `/sync/uploads/${sessionId}/parts`, { partNumbers }),
    commit: (sessionId: string, parts?: { partNumber: number; etag: string }[]) =>
      call<CommitResult>("POST", `/sync/uploads/${sessionId}/commit`, parts ? { parts } : {}),
    mkdir: (body: FolderBody) =>
      call<{ folder: { id: string; name: string; parentId: string | null }; cursor: number }>("POST", "/sync/folders", body),
    move: (fileId: string, revision: number, body: MoveBody) =>
      call<CommitResult>("POST", `/sync/files/${fileId}/move`, body, { "If-Match": String(revision) }),
    remove: (fileId: string, revision: number) =>
      call<{ cursor: number }>("DELETE", `/sync/files/${fileId}`, undefined, { "If-Match": String(revision) }),
    postLog: (body: RunLogBody) => call<{ ok: boolean }>("POST", "/sync/logs", body),
    runs: () =>
      call<{ runs: RunEntry[]; nextPageToken: string | null }>("GET", "/sync/logs"),
  };
}
