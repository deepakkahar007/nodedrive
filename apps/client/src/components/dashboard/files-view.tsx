import { type FileSection, listFiles, listFolders } from "@repo/drizzle";
import type { LucideIcon } from "lucide-react";
import { CreateFolderDialog } from "./create-folder-dialog";
import { EmptyState } from "./empty-state";
import { FileTable } from "./file-table";
import { FolderGrid } from "./folder-grid";
import { UploadDialog } from "./upload-dialog";

const emptyCopy: Record<FileSection, { title: string; description: string }> = {
  home: {
    title: "No files yet",
    description: "Upload a file or create a folder to get started.",
  },
  "my-drive": {
    title: "My Drive is empty",
    description: "Files and folders you create will appear here.",
  },
  computers: {
    title: "No computers connected",
    description: "Files from synced computers will appear here.",
  },
  shared: {
    title: "Nothing shared yet",
    description: "Upload to an organization to share files with its members.",
  },
  recent: {
    title: "No recent files",
    description: "Files you upload or change will appear here.",
  },
  starred: {
    title: "No starred files",
    description: "Star files to find them quickly.",
  },
  bin: {
    title: "Bin is empty",
    description: "Files you move to the bin will appear here.",
  },
};

export async function FilesView({
  userId,
  section,
  title,
  description,
  icon: Icon,
}: {
  userId: string;
  section: FileSection;
  title: string;
  description: string;
  icon: LucideIcon;
}) {
  const showFolders = section === "home" || section === "my-drive";
  const [files, folders] = await Promise.all([
    listFiles({ userId, section }),
    showFolders ? listFolders({ userId }) : Promise.resolve([]),
  ]);
  const rootFolders = folders.filter((folder) => folder.parentId === null);
  const empty = emptyCopy[section];

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {showFolders ? <CreateFolderDialog parentId={null} /> : null}
          <UploadDialog />
        </div>
      </div>

      {rootFolders.length > 0 ? (
        <section aria-labelledby="folders-heading" className="grid gap-3">
          <h2 id="folders-heading" className="text-sm font-medium">
            Folders
          </h2>
          <FolderGrid folders={rootFolders} />
        </section>
      ) : null}

      {files.length > 0 ? (
        <section aria-labelledby="files-heading" className="grid gap-3">
          <h2 id="files-heading" className="text-sm font-medium">
            {section === "home" ? "Recent files" : "Files"}
          </h2>
          <FileTable
            files={files}
            folders={folders}
            currentFolderId={null}
            inBin={section === "bin"}
            showSource={section === "shared"}
          />
        </section>
      ) : rootFolders.length === 0 ? (
        <EmptyState
          icon={Icon}
          title={empty.title}
          description={empty.description}
        />
      ) : null}
    </section>
  );
}
