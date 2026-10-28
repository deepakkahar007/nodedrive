"use client";

import { clientEnv } from "@repo/env/client";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  ChevronsUpDown,
  CloudUpload,
  File,
  Loader2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useDropzone } from "react-dropzone";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatBytes } from "@/lib/file-display";
import {
  completeUploads,
  presignUploads,
  uploadToStorage,
} from "@/lib/uploads";
import { cn } from "@/lib/utils";

type UploadOrganization = {
  id: string;
  name: string;
  slug: string;
  logo?: string | null;
  access: "owned" | "shared";
};

type FileStatus = "uploading" | "done" | "error";

const optionClassName =
  "flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-sm outline-none transition-colors hover:bg-muted focus-visible:bg-muted aria-pressed:bg-muted";

function fileKey(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

export function UploadDialog({
  folderId = null,
}: {
  folderId?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [organizationOpen, setOrganizationOpen] = useState(false);
  const [organizations, setOrganizations] = useState<UploadOrganization[]>([]);
  const [organizationsLoaded, setOrganizationsLoaded] = useState(false);
  const [organizationsLoading, setOrganizationsLoading] = useState(false);
  const [organizationsError, setOrganizationsError] = useState<string | null>(
    null,
  );
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<Record<string, FileStatus>>({});

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    multiple: true,
    disabled: uploading,
    onDrop: (acceptedFiles) => {
      setCompletedCount(0);
      setError(null);
      setStatuses({});
      setFiles((current) => {
        const seen = new Set(current.map(fileKey));

        return [
          ...current,
          ...acceptedFiles.filter((file) => !seen.has(fileKey(file))),
        ];
      });
    },
  });

  const selectedOrganization = organizations.find(
    (organization) => organization.id === organizationId,
  );

  async function loadOrganizations() {
    if (organizationsLoaded) return;

    setOrganizationsLoading(true);
    setOrganizationsError(null);

    try {
      const response = await fetch(
        `${clientEnv.NEXT_PUBLIC_BETTER_AUTH_URL}/organizations`,
        { credentials: "include" },
      );

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = (await response.json()) as {
        organizations: UploadOrganization[];
      };
      setOrganizations(data.organizations);
      setOrganizationsLoaded(true);
    } catch {
      setOrganizationsError("Could not load organizations");
    } finally {
      setOrganizationsLoading(false);
    }
  }

  function resetUploadState() {
    setProgress(0);
    setCompletedCount(0);
    setError(null);
    setStatuses({});
  }

  function handleOpenChange(next: boolean) {
    if (!next && uploading) return;

    setOpen(next);

    if (next) {
      resetUploadState();
      if (!folderId) void loadOrganizations();
      return;
    }

    setFiles([]);
    setOrganizationId(null);
    setOrganizationOpen(false);
    resetUploadState();
  }

  function removeFile(file: File) {
    setFiles((current) => current.filter((entry) => entry !== file));
  }

  async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    if (files.length === 0 || uploading) return;

    setUploading(true);
    resetUploadState();

    const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
    const uploaded: { file: File; key: string }[] = [];
    const failed: File[] = [];
    let settledBytes = 0;

    try {
      const presigned = await presignUploads(
        files,
        folderId ? null : organizationId,
        folderId,
      );

      for (const [index, file] of files.entries()) {
        const target = presigned[index];

        if (!target) {
          failed.push(file);
          setStatuses((current) => ({
            ...current,
            [fileKey(file)]: "error",
          }));
          continue;
        }

        setStatuses((current) => ({
          ...current,
          [fileKey(file)]: "uploading",
        }));

        try {
          await uploadToStorage(target.url, file, target.headers, (loaded) => {
            const loadedBytes = settledBytes + Math.min(loaded, file.size);

            setProgress(
              totalBytes > 0
                ? Math.round((loadedBytes / totalBytes) * 100)
                : 100,
            );
          });

          uploaded.push({ file, key: target.key });
          setStatuses((current) => ({
            ...current,
            [fileKey(file)]: "done",
          }));
        } catch (uploadError) {
          failed.push(file);
          setStatuses((current) => ({
            ...current,
            [fileKey(file)]: "error",
          }));
          setError(
            uploadError instanceof Error
              ? uploadError.message
              : `Could not upload ${file.name}`,
          );
        } finally {
          settledBytes += file.size;
          setProgress(
            totalBytes > 0
              ? Math.round((settledBytes / totalBytes) * 100)
              : 100,
          );
        }
      }

      if (uploaded.length > 0) {
        await completeUploads(
          uploaded.map(({ file, key }) => ({
            key,
            name: file.name,
            mimeType: file.type || "application/octet-stream",
          })),
          folderId ? null : organizationId,
          folderId,
        );
        setCompletedCount(uploaded.length);
        router.refresh();
      }

      if (failed.length > 0) {
        showFailedFiles(failed, files.length);
      } else {
        setFiles([]);
      }
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Upload failed",
      );
    } finally {
      setUploading(false);
    }
  }

  function showFailedFiles(failed: File[], total: number) {
    setFiles(failed);
    setError(`${failed.length} of ${total} files failed. Retry them below.`);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger className={buttonVariants()}>
        <CloudUpload aria-hidden="true" />
        Upload files
      </DialogTrigger>

      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload files</DialogTitle>
          <DialogDescription>
            Drag and drop files here, or click the zone to browse.
          </DialogDescription>
        </DialogHeader>

        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div
            {...getRootProps({
              role: "button",
              "aria-label": "Drop files here or click to select files",
              "aria-disabled": uploading,
              className: cn(
                "flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-muted/30 px-6 py-8 text-center outline-none transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50",
                isDragActive && "border-primary bg-primary/5",
                uploading && "pointer-events-none opacity-60",
              ),
            })}
          >
            <input {...getInputProps()} />
            <CloudUpload
              aria-hidden="true"
              className="size-8 text-muted-foreground"
            />
            <p className="text-sm font-medium">
              {isDragActive ? "Drop files here" : "Drag and drop files here"}
            </p>
            <p className="text-xs text-muted-foreground">
              or click to select files
            </p>
          </div>

          {files.length > 0 ? (
            <ul
              aria-label="Selected files"
              className="max-h-48 space-y-2 overflow-y-auto"
            >
              {files.map((file) => {
                const status = statuses[fileKey(file)];

                return (
                  <li
                    key={fileKey(file)}
                    className="flex items-center gap-3 rounded-lg border p-2"
                  >
                    {status === "uploading" ? (
                      <Loader2
                        aria-hidden="true"
                        className="size-4 shrink-0 animate-spin text-muted-foreground"
                      />
                    ) : status === "done" ? (
                      <CheckCircle2
                        aria-hidden="true"
                        className="size-4 shrink-0 text-primary"
                      />
                    ) : status === "error" ? (
                      <AlertCircle
                        aria-hidden="true"
                        className="size-4 shrink-0 text-destructive"
                      />
                    ) : (
                      <File
                        aria-hidden="true"
                        className="size-4 shrink-0 text-muted-foreground"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {file.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatBytes(file.size)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={uploading}
                      aria-label={`Remove ${file.name}`}
                      onClick={() => removeFile(file)}
                    >
                      <X aria-hidden="true" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {folderId ? null : (
            <div className="grid gap-1.5">
              <span className="text-sm font-medium">Organization</span>
              <Popover
                open={organizationOpen}
                onOpenChange={(next) => {
                  if (!uploading) setOrganizationOpen(next);
                }}
              >
                <PopoverTrigger
                  type="button"
                  aria-label="Organization"
                  disabled={uploading}
                  className="flex h-8 w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Building2
                      aria-hidden="true"
                      className="size-4 shrink-0 text-muted-foreground"
                    />
                    <span className="truncate">
                      {selectedOrganization?.name ?? "No organization"}
                    </span>
                  </span>
                  <ChevronsUpDown
                    aria-hidden="true"
                    className="size-4 shrink-0 text-muted-foreground"
                  />
                </PopoverTrigger>

                <PopoverContent
                  align="start"
                  className="w-[var(--anchor-width)] gap-0 p-1"
                >
                  <div className="flex flex-col">
                    <button
                      type="button"
                      aria-pressed={organizationId === null}
                      className={optionClassName}
                      onClick={() => {
                        setOrganizationId(null);
                        setOrganizationOpen(false);
                      }}
                    >
                      <span>No organization</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        Personal
                      </span>
                    </button>

                    {organizations.map((organization) => (
                      <button
                        key={organization.id}
                        type="button"
                        aria-pressed={organizationId === organization.id}
                        className={optionClassName}
                        onClick={() => {
                          setOrganizationId(organization.id);
                          setOrganizationOpen(false);
                        }}
                      >
                        <span className="truncate">{organization.name}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {organization.access === "owned" ? "Owned" : "Shared"}
                        </span>
                      </button>
                    ))}

                    {organizationsLoading ? (
                      <p className="px-2 py-1.5 text-xs text-muted-foreground">
                        Loading organizations...
                      </p>
                    ) : null}

                    {organizationsError ? (
                      <p
                        className="px-2 py-1.5 text-xs text-destructive"
                        role="alert"
                      >
                        {organizationsError}
                      </p>
                    ) : null}
                  </div>
                </PopoverContent>
              </Popover>
              <p className="text-xs text-muted-foreground">
                Leave empty to upload to your personal drive.
              </p>
            </div>
          )}

          {uploading || progress > 0 ? (
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span aria-live="polite">
                  {uploading
                    ? "Uploading files..."
                    : `Uploaded ${completedCount} ${
                        completedCount === 1 ? "file" : "files"
                      }`}
                </span>
                <span className="tabular-nums">{progress}%</span>
              </div>
              <div
                role="progressbar"
                aria-label="Upload progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress}
                className="h-1.5 overflow-hidden rounded-full bg-muted"
              >
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-150"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ) : null}

          {completedCount > 0 && !uploading ? (
            <output className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-foreground">
              <CheckCircle2
                aria-hidden="true"
                className="size-4 shrink-0 text-primary"
              />
              Uploaded {completedCount}{" "}
              {completedCount === 1 ? "file" : "files"}.
            </output>
          ) : null}

          {error ? (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            >
              <AlertCircle
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0"
              />
              {error}
            </p>
          ) : null}

          <DialogFooter>
            {completedCount > 0 && files.length === 0 && !uploading ? (
              <Button type="button" onClick={() => handleOpenChange(false)}>
                Done
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  disabled={uploading}
                  onClick={() => handleOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={files.length === 0 || uploading}
                >
                  {uploading
                    ? `Uploading ${progress}%`
                    : `Upload${files.length > 1 ? ` ${files.length} files` : ""}`}
                </Button>
              </>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
