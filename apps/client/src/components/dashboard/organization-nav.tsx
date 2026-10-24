"use client";

import { authClient } from "@repo/auth/client";
import { Building2 } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { OrganizationLogo } from "@/components/organization/organization-logo";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import type { OrganizationSummary } from "@/lib/organization";
import { isDashboardPathActive } from "@/lib/routes";

const itemClassName =
  "h-10 gap-3 rounded-lg px-3 [&_svg]:size-5 data-active:bg-sidebar-active data-active:text-sidebar-active-foreground";

export function OrganizationNav({
  organizations,
}: {
  organizations: OrganizationSummary[];
}) {
  const pathname = usePathname();

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Organizations</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={<Link href="/dashboard/organization" />}
              isActive={pathname === "/dashboard/organization"}
              tooltip="All organizations"
              className={itemClassName}
            >
              <Building2 aria-hidden="true" />
              <span>All organizations</span>
            </SidebarMenuButton>
          </SidebarMenuItem>

          {organizations.map((organization) => (
            <SidebarMenuItem key={organization.id}>
              <SidebarMenuButton
                render={
                  <Link href={`/dashboard/organization/${organization.id}`} />
                }
                isActive={isDashboardPathActive(
                  pathname,
                  `/dashboard/organization/${organization.id}`,
                )}
                tooltip={organization.name}
                className={itemClassName}
                onClick={() => {
                  void authClient.organization.setActive({
                    organizationId: organization.id,
                  });
                }}
              >
                <OrganizationLogo
                  logo={organization.logo}
                  className="size-7 rounded-md"
                />
                <span>{organization.name}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
