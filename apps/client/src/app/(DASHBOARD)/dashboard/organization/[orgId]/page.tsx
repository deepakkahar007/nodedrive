import { getFullOrganization } from "@repo/auth";
import { FolderOpen } from "lucide-react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { InviteMemberDialog } from "@/components/organization/invite-member-dialog";
import { OrganizationLogo } from "@/components/organization/organization-logo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { requireSession } from "@/lib/session";

function initials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean).slice(0, 2);

  return parts.map((part) => part[0]?.toUpperCase()).join("") || "?";
}

export default async function OrganizationDetailPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const session = await requireSession();
  const organization = await getFullOrganization({
    organizationId: orgId,
    headers: await headers(),
  });

  if (!organization) {
    notFound();
  }

  const me = organization.members.find(
    (member) => member.userId === session.user.id,
  );
  const canInvite = (me?.role ?? "")
    .split(",")
    .some((role) => role.trim() === "owner" || role.trim() === "admin");

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <OrganizationLogo
            logo={organization.logo}
            className="size-12 rounded-xl"
            iconClassName="size-6"
          />
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight">
              {organization.name}
            </h1>
            <p className="truncate text-sm text-muted-foreground">
              {organization.slug}
            </p>
          </div>
        </div>
        {canInvite ? (
          <InviteMemberDialog organizationId={organization.id} />
        ) : null}
      </header>

      <div className="grid min-h-48 place-items-center rounded-xl border border-dashed bg-muted/30 p-8 text-center">
        <div>
          <FolderOpen
            aria-hidden="true"
            className="mx-auto size-8 text-muted-foreground"
          />
          <p className="mt-3 text-sm font-medium">
            Files shared with this organization will appear here
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Uploading to organizations is not wired up yet.
          </p>
        </div>
      </div>

      <section aria-labelledby="members-heading" className="grid gap-3">
        <h2 id="members-heading" className="text-sm font-medium">
          Members
        </h2>
        <ul className="divide-y overflow-hidden rounded-xl border">
          {organization.members.map((member) => {
            const name = member.user?.name || member.user?.email || "Member";

            return (
              <li key={member.id} className="flex items-center gap-3 p-3">
                <Avatar>
                  {member.user?.image ? (
                    <AvatarImage src={member.user.image} alt="" />
                  ) : null}
                  <AvatarFallback>{initials(name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {member.user?.email}
                  </p>
                </div>
                <span className="rounded-md bg-muted px-2 py-0.5 text-xs capitalize text-muted-foreground">
                  {member.role}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </section>
  );
}
