import { auth } from "@repo/auth";
import { headers } from "next/headers";
import { AppHeader } from "@/components/dashboard/app-header";
import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { requireSession } from "@/lib/session";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  const organizations = await auth.api.listOrganizations({
    headers: await headers(),
  });

  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar organizations={organizations} />
        <SidebarInset>
          <AppHeader
            user={{
              name: session.user.name,
              email: session.user.email,
              image: session.user.image,
            }}
          />
          <div className="flex-1 p-4 md:p-6">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
