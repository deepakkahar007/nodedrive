import { House } from "lucide-react";
import { FilesView } from "@/components/dashboard/files-view";
import { requireSession } from "@/lib/session";

export default async function DashboardPage() {
  const session = await requireSession();

  return (
    <FilesView
      userId={session.user.id}
      section="home"
      title="Home"
      description="Folders and recent files at the top level of your drive."
      icon={House}
    />
  );
}
