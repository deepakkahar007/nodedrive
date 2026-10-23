import { notFound } from "next/navigation";
import { SectionPlaceholder } from "@/components/dashboard/section-placeholder";
import { dashboardNavItems } from "@/lib/dashboard-nav";

export default async function DashboardSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  const item = dashboardNavItems.find(
    (entry) => entry.href === `/dashboard/${section}`,
  );

  if (!item) {
    notFound();
  }

  return (
    <SectionPlaceholder
      title={item.title}
      description={`${item.title} will appear here.`}
      icon={item.icon}
    />
  );
}
