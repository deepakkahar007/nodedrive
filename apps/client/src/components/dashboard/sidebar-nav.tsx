"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { dashboardNavGroups } from "@/lib/dashboard-nav";
import type { OrganizationSummary } from "@/lib/organization";
import { isDashboardPathActive } from "@/lib/routes";
import { OrganizationNav } from "./organization-nav";

export function SidebarNav({
  organizations,
}: {
  organizations: OrganizationSummary[];
}) {
  const pathname = usePathname();

  return (
    <nav aria-label="Drive">
      {dashboardNavGroups.map((group) => (
        <SidebarGroup key={group.items[0]?.href}>
          <SidebarGroupContent>
            <SidebarMenu>
              {group.items.map((item) => {
                const active = isDashboardPathActive(pathname, item.href);
                const Icon = item.icon;

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      render={<Link href={item.href} />}
                      isActive={active}
                      aria-current={active ? "page" : undefined}
                      tooltip={item.title}
                      className="h-10 gap-3 rounded-lg px-3 [&_svg]:size-5 data-active:bg-sidebar-active data-active:text-sidebar-active-foreground"
                    >
                      <Icon aria-hidden="true" />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}

      <OrganizationNav organizations={organizations} />
    </nav>
  );
}
