import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { SearchBar } from "./search-bar";
import { ThemeToggle } from "./theme-toggle";
import { type DashboardUser, UserMenu } from "./user-menu";

export function AppHeader({ user }: { user: DashboardUser }) {
  return (
    <header className="sticky top-0 z-20 grid h-16 shrink-0 grid-cols-[1fr_minmax(0,40rem)_1fr] items-center gap-3 border-b border-border/70 bg-background/95 px-3 backdrop-blur md:px-5">
      <div className="flex min-w-0 items-center gap-2">
        <SidebarTrigger />
        <Link
          href="/dashboard"
          className="hidden items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex md:hidden"
        >
          <BrandMark className="size-6 text-sidebar-primary" />
          <span className="font-(family-name:--font-poppins text-base font-medium">
            NodeDrive
          </span>
        </Link>
      </div>

      <SearchBar />

      <div className="flex items-center justify-end gap-1">
        <ThemeToggle />
        <UserMenu user={user} />
      </div>
    </header>
  );
}
