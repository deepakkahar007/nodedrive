import { House } from "lucide-react";
import { SectionPlaceholder } from "@/components/dashboard/section-placeholder";

export default function DashboardPage() {
  return (
    <SectionPlaceholder
      title="Home"
      description="Recent files and suggestions will appear here."
      icon={House}
    />
  );
}
