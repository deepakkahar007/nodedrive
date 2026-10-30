import type { FileListItem, FolderListItem } from "@repo/drizzle";
import { Star } from "lucide-react";
import {
  formatBytes,
  formatFileDate,
  formatFileType,
  getFileIcon,
} from "@/lib/file-display";
import { FileMenu } from "./file-menu";

export function FileTable({
  files,
  inBin,
  showSource = false,
  folders = [],
  currentFolderId = null,
}: {
  files: FileListItem[];
  inBin: boolean;
  showSource?: boolean;
  folders?: FolderListItem[];
  currentFolderId?: string | null;
}) {
  const gridColumns = showSource
    ? "lg:grid-cols-[minmax(0,1fr)_7rem_8rem_9rem_5rem_2.5rem]"
    : "lg:grid-cols-[minmax(0,1fr)_7rem_9rem_5rem_2.5rem]";

  return (
    <div className="overflow-hidden rounded-xl border">
      <div
        className={`hidden ${gridColumns} items-center gap-3 border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground lg:grid`}
      >
        <span>Name</span>
        <span>Type</span>
        {showSource ? <span>Source</span> : null}
        <span>Last modified</span>
        <span className="text-right">Size</span>
        <span className="sr-only">Options</span>
      </div>

      <ul className="divide-y">
        {files.map((file) => {
          const Icon = getFileIcon(file.extension, file.mimeType);
          const type = formatFileType(file.extension, file.mimeType);
          const date = formatFileDate(file.updatedAt);
          const size = formatBytes(Number(file.size));
          const source = file.organizationId
            ? (file.organizationName ?? "Organization")
            : "Shared";

          return (
            <li
              key={file.id}
              className={`grid grid-cols-[minmax(0,1fr)_2.5rem] items-center gap-3 px-3 py-2 transition-colors hover:bg-muted/50 ${gridColumns}`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  aria-hidden="true"
                  className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground"
                >
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
                    <span className="truncate">{file.originalName}</span>
                    {file.isStarred && !inBin ? (
                      <Star
                        aria-label="Starred"
                        className="size-3.5 shrink-0 fill-current text-amber-500"
                      />
                    ) : null}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground lg:hidden">
                    {type}
                    {showSource ? ` · ${source}` : ""} · {date} · {size}
                  </p>
                </div>
              </div>

              <span className="hidden truncate text-sm text-muted-foreground lg:block">
                {type}
              </span>
              {showSource ? (
                <span className="hidden truncate text-sm text-muted-foreground lg:block">
                  {source}
                </span>
              ) : null}
              <span className="hidden truncate text-sm text-muted-foreground lg:block">
                {date}
              </span>
              <span className="hidden text-right text-sm tabular-nums text-muted-foreground lg:block">
                {size}
              </span>

              <div className="flex justify-end">
                <FileMenu
                  fileId={file.id}
                  fileName={file.originalName}
                  isStarred={file.isStarred}
                  inBin={inBin}
                  canManage={!file.isSharedWithMe}
                  folders={folders}
                  currentFolderId={currentFolderId}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
