import {
  Clock3,
  HardDrive,
  House,
  type LucideIcon,
  Monitor,
  Star,
  Trash2,
  Users,
} from "lucide-react";

export type DashboardNavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
};

export type DashboardNavGroup = {
  items: readonly DashboardNavItem[];
};

export const dashboardNavGroups = [
  {
    items: [
      { title: "Home", href: "/dashboard", icon: House },
      { title: "My Drive", href: "/dashboard/my-drive", icon: HardDrive },
      { title: "Computers", href: "/dashboard/computers", icon: Monitor },
    ],
  },
  {
    items: [
      {
        title: "Shared with me",
        href: "/dashboard/shared",
        icon: Users,
      },
      { title: "Recent", href: "/dashboard/recent", icon: Clock3 },
      { title: "Starred", href: "/dashboard/starred", icon: Star },
    ],
  },
  {
    items: [{ title: "Bin", href: "/dashboard/bin", icon: Trash2 }],
  },
] satisfies readonly DashboardNavGroup[];

export const dashboardNavItems: readonly DashboardNavItem[] =
  dashboardNavGroups.flatMap((group) => group.items);
