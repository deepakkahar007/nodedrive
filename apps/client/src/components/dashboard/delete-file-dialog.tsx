"use client";

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
import { deleteFilePermanently } from "@/lib/files";

export function DeleteFileDialog({
  fileId,
  fileName,
  open,
  onOpenChange,
}: {
  fileId: string;
  fileName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleOpenChange(next: boolean) {
    if (!next && pending) return;

    onOpenChange(next);

    if (next) setError(null);
  }

  async function handleDelete() {
    setPending(true);
    setError(null);

    try {
      await deleteFilePermanently(fileId);
      setPending(false);
      onOpenChange(false);
      router.refresh();
    } catch (deleteError) {
      setPending(false);
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Could not delete file",
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete permanently?</DialogTitle>
          <DialogDescription>
            “{fileName?.slice(0, 20)}
            {fileName?.length > 20 ? "..." : ""}” will be removed from storage
            and can’t be recovered. People it was shared with will lose access.
          </DialogDescription>
        </DialogHeader>

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
            variant="destructive"
            disabled={pending}
            onClick={handleDelete}
          >
            {pending ? "Deleting..." : "Delete permanently"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
