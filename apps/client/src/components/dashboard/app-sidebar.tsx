import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
} from "@/components/ui/sidebar";
import type { OrganizationSummary } from "@/lib/organization";
import { SidebarNav } from "./sidebar-nav";

export function AppSidebar({
  organizations,
}: {
  organizations: OrganizationSummary[];
}) {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-4 pt-5 pb-3 group-data-[collapsible=icon]:px-2">
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring group-data-[collapsible=icon]:justify-center"
        >
          <BrandMark className="size-8 shrink-0 text-sidebar-primary" />
          <span className="font-(family-name:--font-poppins) text-xl font-medium tracking-tight group-data-[collapsible=icon]:hidden">
            NodeDrive
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent className="gap-2 py-2">
        <SidebarNav organizations={organizations} />
      </SidebarContent>
    </Sidebar>
  );
}
