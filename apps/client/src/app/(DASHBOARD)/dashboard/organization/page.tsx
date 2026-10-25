import { listOrganizations } from "@repo/auth";
import { Building2 } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { CreateOrganizationButton } from "@/components/organization/create-organization-button";
import { InvitationsDialog } from "@/components/organization/invitations-dialog";
import { OrganizationLogo } from "@/components/organization/organization-logo";

export default async function OrganizationPage() {
  const organizations = await listOrganizations({
    headers: await headers(),
  });

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Organizations
          </h1>
          <p className="text-sm text-muted-foreground">
            Create a shared space or join one you were invited to.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <InvitationsDialog />
          <CreateOrganizationButton />
        </div>
      </div>

      {organizations.length > 0 ? (
        <section aria-labelledby="organizations-heading" className="grid gap-3">
          <h2 id="organizations-heading" className="text-sm font-medium">
            Your organizations
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {organizations.map((organization) => (
              <li key={organization.id}>
                <Link
                  href={`/dashboard/organization/${organization.id}`}
                  className="flex items-center gap-3 rounded-xl border p-4 outline-none transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <OrganizationLogo
                    logo={organization.logo}
                    className="size-10 rounded-xl"
                    iconClassName="size-5"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {organization.name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {organization.slug}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <div className="grid min-h-64 place-items-center rounded-xl border border-dashed bg-muted/30 p-8 text-center">
          <div>
            <Building2
              aria-hidden="true"
              className="mx-auto size-8 text-muted-foreground"
            />
            <p className="mt-3 text-sm font-medium">No organizations yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Create one to share files with your team.
            </p>
            <CreateOrganizationButton className="mt-4" />
          </div>
        </div>
      )}
    </section>
  );
}
