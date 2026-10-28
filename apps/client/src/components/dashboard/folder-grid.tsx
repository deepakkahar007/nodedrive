import type { FolderListItem } from "@repo/drizzle";
import { Folder } from "lucide-react";
import Link from "next/link";

export function FolderGrid({ folders }: { folders: FolderListItem[] }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {folders.map((folder) => (
        <Link
          key={folder.id}
          href={`/dashboard/folder/${folder.id}`}
          className="group flex min-w-0 items-center gap-3 rounded-lg border bg-background px-3 py-2.5 outline-none transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover:text-foreground">
            <Folder aria-hidden="true" className="size-4" />
          </span>
          <span className="truncate text-sm font-medium">{folder.name}</span>
        </Link>
      ))}
    </div>
  );
}
