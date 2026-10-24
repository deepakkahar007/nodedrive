import { getOrganizationLogo } from "@/lib/organization-logos";
import { cn } from "@/lib/utils";

/** Renders the lucide icon stored in `organization.logo`. */
export function OrganizationLogo({
  logo,
  className,
  iconClassName,
}: {
  logo?: string | null;
  className?: string;
  iconClassName?: string;
}) {
  const Icon = getOrganizationLogo(logo);

  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-accent text-sidebar-accent-foreground",
        className,
      )}
    >
      <Icon className={cn("size-4", iconClassName)} />
    </span>
  );
}
