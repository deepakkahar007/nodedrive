import type { FileSection } from "@repo/drizzle";
import { notFound } from "next/navigation";
import { FilesView } from "@/components/dashboard/files-view";
import { dashboardNavItems } from "@/lib/dashboard-nav";
import { requireSession } from "@/lib/session";

const sectionDetails: Record<
  string,
  { section: FileSection; description: string }
> = {
  "my-drive": {
    section: "my-drive",
    description: "Files you own in your personal drive.",
  },
  computers: {
    section: "computers",
    description: "Files from your synced computers.",
  },
  shared: {
    section: "shared",
    description: "Files from organizations you belong to.",
  },
  recent: {
    section: "recent",
    description: "Files you uploaded or changed recently.",
  },
  starred: {
    section: "starred",
    description: "Files you marked with a star.",
  },
  bin: {
    section: "bin",
    description: "Deleted files are kept here.",
  },
};

export default async function DashboardSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  const session = await requireSession();
  const item = dashboardNavItems.find(
    (entry) => entry.href === `/dashboard/${section}`,
  );
  const details = sectionDetails[section];

  if (!item || !details) {
    notFound();
  }

  return (
    <FilesView
      userId={session.user.id}
      section={details.section}
      title={item.title}
      description={details.description}
      icon={item.icon}
    />
  );
}
