"use client";

import type { FolderListItem } from "@repo/drizzle";
import {
  Download,
  FolderInput,
  Loader2,
  MoreVertical,
  RotateCcw,
  Share2,
  Star,
  StarOff,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { getFileDownload, updateFile } from "@/lib/files";
import { DeleteFileDialog } from "./delete-file-dialog";
import { MoveFileDialog } from "./move-file-dialog";
import { ShareFileDialog } from "./share-file-dialog";

type FileMenuProps = {
  fileId: string;
  fileName: string;
  isStarred: boolean;
  inBin: boolean;
  canManage: boolean;
  folders: FolderListItem[];
  currentFolderId: string | null;
};

const itemClassName =
  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none transition-colors hover:bg-muted focus-visible:bg-muted disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0";

export function FileMenu({
  fileId,
  fileName,
  isStarred,
  inBin,
  canManage,
  folders,
  currentFolderId,
}: FileMenuProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<void>, refresh = true) {
    setBusy(true);
    setError(null);

    try {
      await action();
      setOpen(false);
      if (refresh) router.refresh();
    } catch (actionError) {
      setError(
        actionError instanceof Error ? actionError.message : "Action failed",
      );
    } finally {
      setBusy(false);
    }
  }

  function download() {
    return run(async () => {
      const { url } = await getFileDownload(fileId);
      const link = document.createElement("a");

      link.href = url;
      link.download = fileName;
      link.click();
    }, false);
  }

  function setStarred(starred: boolean) {
    return run(() => updateFile(fileId, { starred }).then(() => undefined));
  }

  function setTrashed(trashed: boolean) {
    return run(() => updateFile(fileId, { trashed }).then(() => undefined));
  }

  return (
    <>
      <Popover
        open={open}
        onOpenChange={(next) => {
          if (busy) return;

          setOpen(next);
          if (!next) setError(null);
        }}
      >
        <PopoverTrigger
          aria-label={`More options for ${fileName}`}
          className="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 [&_svg]:size-4"
        >
          {busy ? (
            <Loader2 aria-hidden="true" className="animate-spin" />
          ) : (
            <MoreVertical aria-hidden="true" />
          )}
        </PopoverTrigger>
        <PopoverContent align="end" className="w-48 gap-0 p-1">
          <button
            type="button"
            className={itemClassName}
            disabled={busy}
            onClick={download}
          >
            <Download aria-hidden="true" />
            Download
          </button>

          {canManage ? (
            inBin ? (
              <>
                <button
                  type="button"
                  className={itemClassName}
                  disabled={busy}
                  onClick={() => setTrashed(false)}
                >
                  <RotateCcw aria-hidden="true" />
                  Restore
                </button>
                <button
                  type="button"
                  className={`${itemClassName} text-destructive`}
                  disabled={busy}
                  onClick={() => {
                    setOpen(false);
                    setDeleteOpen(true);
                  }}
                >
                  <Trash2 aria-hidden="true" />
                  Delete permanently
                </button>
              </>
            ) : (
              <>
                {folders.length > 0 || currentFolderId ? (
                  <button
                    type="button"
                    className={itemClassName}
                    disabled={busy}
                    onClick={() => {
                      setOpen(false);
                      setMoveOpen(true);
                    }}
                  >
                    <FolderInput aria-hidden="true" />
                    Move to folder
                  </button>
                ) : null}
                <button
                  type="button"
                  className={itemClassName}
                  disabled={busy}
                  onClick={() => {
                    setOpen(false);
                    setShareOpen(true);
                  }}
                >
                  <Share2 aria-hidden="true" />
                  Share
                </button>
                <button
                  type="button"
                  className={itemClassName}
                  disabled={busy}
                  onClick={() => setStarred(!isStarred)}
                >
                  {isStarred ? (
                    <StarOff aria-hidden="true" />
                  ) : (
                    <Star aria-hidden="true" />
                  )}
                  {isStarred ? "Remove from starred" : "Add to starred"}
                </button>
                <button
                  type="button"
                  className={`${itemClassName} text-destructive`}
                  disabled={busy}
                  onClick={() => setTrashed(true)}
                >
                  <Trash2 aria-hidden="true" />
                  Move to bin
                </button>
              </>
            )
          ) : null}

          {error ? (
            <p role="alert" className="px-2 py-1.5 text-xs text-destructive">
              {error}
            </p>
          ) : null}
        </PopoverContent>
      </Popover>

      <ShareFileDialog
        fileId={fileId}
        fileName={fileName}
        open={shareOpen}
        onOpenChange={setShareOpen}
      />

      <MoveFileDialog
        fileId={fileId}
        fileName={fileName}
        currentFolderId={currentFolderId}
        folders={folders}
        open={moveOpen}
        onOpenChange={setMoveOpen}
      />

      <DeleteFileDialog
        fileId={fileId}
        fileName={fileName}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </>
  );
}
