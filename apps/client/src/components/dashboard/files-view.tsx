import { type FileSection, listFiles } from "@repo/drizzle";
import type { LucideIcon } from "lucide-react";
import { FileTable } from "./file-table";
import { UploadDialog } from "./upload-dialog";

const emptyCopy: Record<FileSection, { title: string; description: string }> = {
  home: {
    title: "No files yet",
    description: "Upload a file and it will show up here.",
  },
  "my-drive": {
    title: "My Drive is empty",
    description: "Files you upload to your personal drive will appear here.",
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
  const files = await listFiles({ userId, section });
  const empty = emptyCopy[section];

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <UploadDialog />
      </div>

      {files.length > 0 ? (
        <FileTable
          files={files}
          inBin={section === "bin"}
          showSource={section === "shared"}
        />
      ) : (
        <div className="grid min-h-64 place-items-center rounded-xl border border-dashed bg-muted/30 p-8 text-center">
          <div>
            <Icon
              aria-hidden="true"
              className="mx-auto size-8 text-muted-foreground"
            />
            <p className="mt-3 text-sm font-medium">{empty.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {empty.description}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
