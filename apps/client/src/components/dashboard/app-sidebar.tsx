import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { SidebarNav } from "./sidebar-nav";

export function AppSidebar() {
  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader className="px-4 pt-5 pb-3">
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        >
          <BrandMark className="size-8 text-sidebar-primary" />
          <span className="font-(family-name:--font-poppins) text-xl font-medium tracking-tight">
            NodeDrive
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent className="gap-2 py-2">
        <SidebarNav />
      </SidebarContent>
    </Sidebar>
  );
}
