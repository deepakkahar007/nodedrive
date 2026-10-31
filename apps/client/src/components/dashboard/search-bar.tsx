"use client";

import type { FileSearchItem } from "@repo/drizzle";
import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent } from "@/components/ui/popover";
import {
  formatBytes,
  formatFileType,
  getFileIcon,
  getFileTone,
} from "@/lib/file-display";
import { searchFiles } from "@/lib/files";

export function SearchBar() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<FileSearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const term = query.trim();

  useEffect(() => {
    if (!term) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);

      try {
        const data = await searchFiles(term, controller.signal);
        setFiles(data.files);
        setError(null);
      } catch (err) {
        if (controller.signal.aborted) return;
        setFiles([]);
        setError(err instanceof Error ? err.message : "Search failed");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [term]);

  return (
    <Popover open={open && term.length > 0} onOpenChange={setOpen}>
      <form
        ref={formRef}
        action="/dashboard/search"
        className="relative min-w-0 flex-1"
      >
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          name="q"
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          aria-label="Search files"
          placeholder="Search in NodeDrive"
          autoComplete="off"
          className="h-11 rounded-full border-transparent bg-muted pl-10 text-sm shadow-none focus-visible:bg-background"
        />
      </form>

      <PopoverContent
        anchor={formRef}
        initialFocus={false}
        finalFocus={false}
        className="w-(--anchor-width) max-w-none p-1.5"
      >
        {error ? (
          <p className="px-2 py-3 text-sm text-destructive">{error}</p>
        ) : null}

        {!error && files.length === 0 ? (
          <p className="px-2 py-3 text-sm text-muted-foreground">
            {loading ? "Searching…" : `No files match “${term}”`}
          </p>
        ) : null}

        {files.length > 0 ? (
          <ul className="grid">
            {files.map((file) => {
              const Icon = getFileIcon(file.extension, file.mimeType);

              return (
                <li
                  key={file.id}
                  className="flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/50"
                >
                  <span
                    aria-hidden="true"
                    className={`grid size-9 shrink-0 place-items-center rounded-lg ${getFileTone(Icon)}`}
                  >
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {file.originalName}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {formatFileType(file.extension, file.mimeType)} ·{" "}
                      {formatBytes(Number(file.size))}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
