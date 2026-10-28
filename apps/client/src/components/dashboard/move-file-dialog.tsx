"use client";

import type { FolderListItem } from "@repo/drizzle";
import { Check, Folder, HardDrive } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { updateFile } from "@/lib/files";
import { folderOptions } from "@/lib/folder-options";
import { cn } from "@/lib/utils";

const rowClassName =
  "flex w-full cursor-pointer items-center gap-2 rounded-md py-1.5 pr-2 text-left text-sm outline-none transition-colors hover:bg-muted has-[:checked]:bg-muted has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/50";

export function MoveFileDialog({
  fileId,
  fileName,
  currentFolderId,
  folders,
  open,
  onOpenChange,
}: {
  fileId: string;
  fileName: string;
  currentFolderId: string | null;
  folders: FolderListItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(currentFolderId);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const options = folderOptions(folders);
  const unchanged = selected === currentFolderId;

  function handleOpenChange(next: boolean) {
    if (!next && pending) return;

    onOpenChange(next);

    if (next) {
      setSelected(currentFolderId);
      setError(null);
    }
  }

  async function handleMove() {
    if (unchanged) return;

    setPending(true);
    setError(null);

    try {
      await updateFile(fileId, { folderId: selected });
      setPending(false);
      onOpenChange(false);
      router.refresh();
    } catch (moveError) {
      setPending(false);
      setError(
        moveError instanceof Error ? moveError.message : "Could not move file",
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move to folder</DialogTitle>
          <DialogDescription>
            Choose a destination for “{fileName}”.
          </DialogDescription>
        </DialogHeader>

        <fieldset className="max-h-64 overflow-y-auto rounded-lg border p-1">
          <legend className="sr-only">Destination folder</legend>

          <label className={cn(rowClassName, "pl-2")}>
            <input
              type="radio"
              name={`destination-${fileId}`}
              className="sr-only"
              checked={selected === null}
              onChange={() => setSelected(null)}
            />
            <HardDrive
              aria-hidden="true"
              className="size-4 shrink-0 text-muted-foreground"
            />
            <span className="min-w-0 flex-1 truncate">My Drive</span>
            <span className="shrink-0 text-xs text-muted-foreground">
              Top level
            </span>
            {selected === null ? (
              <Check aria-hidden="true" className="size-4 shrink-0" />
            ) : null}
          </label>

          {options.map((option) => (
            <label
              key={option.id}
              title={option.path}
              className={rowClassName}
              style={{ paddingLeft: `${0.5 + option.depth}rem` }}
            >
              <input
                type="radio"
                name={`destination-${fileId}`}
                className="sr-only"
                checked={selected === option.id}
                onChange={() => setSelected(option.id)}
              />
              <Folder
                aria-hidden="true"
                className="size-4 shrink-0 text-muted-foreground"
              />
              <span className="min-w-0 flex-1 truncate">{option.name}</span>
              {selected === option.id ? (
                <Check aria-hidden="true" className="size-4 shrink-0" />
              ) : null}
            </label>
          ))}

          {options.length === 0 ? (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">
              No folders yet. Create one first.
            </p>
          ) : null}
        </fieldset>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => handleOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={pending || unchanged}
            onClick={handleMove}
          >
            {pending ? "Moving..." : "Move"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
