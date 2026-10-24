"use client";

import { clientEnv } from "@repo/env/client";
import { Building2, ChevronsUpDown, CloudUpload, File, X } from "lucide-react";
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
import { cn } from "@/lib/utils";

type UploadOrganization = {
  id: string;
  name: string;
  slug: string;
  logo?: string | null;
  access: "owned" | "shared";
};

const optionClassName =
  "flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-sm outline-none transition-colors hover:bg-muted focus-visible:bg-muted aria-pressed:bg-muted";

function fileKey(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );

  return `${(bytes / 1024 ** exponent).toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

export function UploadDialog() {
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

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    multiple: true,
    onDrop: (acceptedFiles) => {
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

  function handleOpenChange(next: boolean) {
    setOpen(next);

    if (next) {
      void loadOrganizations();
      return;
    }

    setFiles([]);
    setOrganizationId(null);
    setOrganizationOpen(false);
  }

  function removeFile(file: File) {
    setFiles((current) => current.filter((entry) => entry !== file));
  }

  function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    // ponytail: upload route not wired yet; organizationId is part of the payload
    console.log("upload", { files, organizationId });
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
              className: cn(
                "flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-muted/30 px-6 py-8 text-center outline-none transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50",
                isDragActive && "border-primary bg-primary/5",
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
              {files.map((file) => (
                <li
                  key={fileKey(file)}
                  className="flex items-center gap-3 rounded-lg border p-2"
                >
                  <File
                    aria-hidden="true"
                    className="size-4 shrink-0 text-muted-foreground"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatBytes(file.size)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove ${file.name}`}
                    onClick={() => removeFile(file)}
                  >
                    <X aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="grid gap-1.5">
            <span className="text-sm font-medium">Organization</span>
            <Popover open={organizationOpen} onOpenChange={setOrganizationOpen}>
              <PopoverTrigger
                type="button"
                aria-label="Organization"
                className="flex h-8 w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
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

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={files.length === 0}>
              Upload
              {files.length > 1 ? ` ${files.length} files` : ""}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
