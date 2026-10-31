import {
  getFolderAncestors,
  getFolderForUser,
  listFolderFiles,
  listFolders,
} from "@repo/drizzle";
import { ChevronRight, FolderOpen } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Fragment } from "react";
import { CreateFolderDialog } from "@/components/dashboard/create-folder-dialog";
import { EmptyState } from "@/components/dashboard/empty-state";
import { FileTable } from "@/components/dashboard/file-table";
import { FolderGrid } from "@/components/dashboard/folder-grid";
import { UploadDialog } from "@/components/dashboard/upload-dialog";
import { requireSession } from "@/lib/session";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const crumbClassName =
  "truncate rounded-md outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring";

export default async function FolderPage({
  params,
}: {
  params: Promise<{ folderId: string }>;
}) {
  const { folderId } = await params;

  if (!UUID_PATTERN.test(folderId)) notFound();

  const session = await requireSession();
  const userId = session.user.id;
  const folder = await getFolderForUser({ folderId, userId });

  if (!folder) notFound();

  const [ancestors, folders, files] = await Promise.all([
    getFolderAncestors({ folderId: folder.id, userId }),
    listFolders({ userId }),
    listFolderFiles({ folderId: folder.id, userId }),
  ]);
  const childFolders = folders.filter((child) => child.parentId === folder.id);
  const isEmpty = childFolders.length === 0 && files.length === 0;

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex flex-col gap-3">
        <nav
          aria-label="Breadcrumb"
          className="flex min-w-0 flex-wrap items-center gap-1 text-sm text-muted-foreground"
        >
          <Link href="/dashboard/my-drive" className={crumbClassName}>
            My Drive
          </Link>
          {ancestors.map((ancestor) => (
            <Fragment key={ancestor.id}>
              <ChevronRight aria-hidden="true" className="size-3.5 shrink-0" />
              <Link
                href={`/dashboard/folder/${ancestor.id}`}
                className={crumbClassName}
              >
                {ancestor.name}
              </Link>
            </Fragment>
          ))}
          <ChevronRight aria-hidden="true" className="size-3.5 shrink-0" />
          <span className="truncate text-foreground">{folder.name}</span>
        </nav>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
              <FolderOpen aria-hidden="true" className="size-5" />
            </span>
            <div className="min-w-0">
              <h1 className="truncate font-heading text-2xl font-medium tracking-[-0.03em]">
                {folder.name}
              </h1>
              <p className="text-sm text-muted-foreground">
                Files and folders in this folder.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <CreateFolderDialog parentId={folder.id} />
            <UploadDialog folderId={folder.id} />
          </div>
        </div>
      </div>

      {childFolders.length > 0 ? (
        <section aria-labelledby="folders-heading" className="grid gap-3">
          <h2 id="folders-heading" className="text-sm font-medium">
            Folders
          </h2>
          <FolderGrid folders={childFolders} />
        </section>
      ) : null}

      {files.length > 0 ? (
        <section aria-labelledby="files-heading" className="grid gap-3">
          <h2 id="files-heading" className="text-sm font-medium">
            Files
          </h2>
          <FileTable
            files={files}
            folders={folders}
            currentFolderId={folder.id}
            inBin={false}
          />
        </section>
      ) : null}

      {isEmpty ? (
        <EmptyState
          icon={FolderOpen}
          title="This folder is empty"
          description="Upload a file, create a subfolder, or move files into it."
        />
      ) : null}
    </section>
  );
}
