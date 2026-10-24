"use client";

import { authClient } from "@repo/auth/client";
import { Inbox } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { OrganizationLogo } from "@/components/organization/organization-logo";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type PendingInvitation = {
  id: string;
  organizationId: string;
  organizationName: string;
  role: string | null;
  expiresAt: string | Date;
};

function formatExpiry(value: string | Date) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function InvitationsDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { data: session } = authClient.useSession();
  const emailVerified = Boolean(session?.user.emailVerified);

  const loadInvitations = useCallback(async () => {
    const { data, error: loadError } =
      await authClient.organization.listUserInvitations();

    if (loadError) {
      setError(loadError.message ?? "Could not load your invitations");
      return;
    }

    setInvitations((data ?? []) as PendingInvitation[]);
  }, []);

  useEffect(() => {
    // Better Auth only lists invitations for verified emails.
    if (emailVerified) void loadInvitations();
  }, [emailVerified, loadInvitations]);

  async function accept(invitation: PendingInvitation) {
    setBusyId(invitation.id);
    setError(null);

    const { error: acceptError } =
      await authClient.organization.acceptInvitation({
        invitationId: invitation.id,
      });

    if (acceptError) {
      setError(acceptError.message ?? "Could not accept the invitation");
      setBusyId(null);
      return;
    }

    await authClient.organization.setActive({
      organizationId: invitation.organizationId,
    });

    setBusyId(null);
    setOpen(false);
    router.push(`/dashboard/organization/${invitation.organizationId}`);
    router.refresh();
  }

  async function decline(invitation: PendingInvitation) {
    setBusyId(invitation.id);
    setError(null);

    const { error: declineError } =
      await authClient.organization.rejectInvitation({
        invitationId: invitation.id,
      });

    if (declineError) {
      setError(declineError.message ?? "Could not decline the invitation");
      setBusyId(null);
      return;
    }

    setBusyId(null);
    setInvitations((current) =>
      current.filter((entry) => entry.id !== invitation.id),
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={buttonVariants({ variant: "outline" })}>
        <Inbox aria-hidden="true" />
        Invitations
        {invitations.length > 0 ? ` (${invitations.length})` : ""}
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invitations</DialogTitle>
          <DialogDescription>
            {session?.user.email
              ? `Organizations that invited ${session.user.email}.`
              : "Organizations that invited you."}{" "}
            Each invitation expires 48 hours after it was sent.
          </DialogDescription>
        </DialogHeader>

        {!emailVerified ? (
          <p className="text-sm text-muted-foreground">
            Verify your email to see invitations sent to you.
          </p>
        ) : invitations.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-muted/30 p-6 text-center">
            <Inbox
              aria-hidden="true"
              className="mx-auto size-6 text-muted-foreground"
            />
            <p className="mt-2 text-sm font-medium">No pending invitations</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Invitations you receive will show up here.
            </p>
          </div>
        ) : (
          <ul
            aria-label="Pending invitations"
            className="divide-y overflow-hidden rounded-lg border"
          >
            {invitations.map((invitation) => (
              <li
                key={invitation.id}
                className="flex flex-wrap items-center gap-3 p-3"
              >
                <OrganizationLogo logo={null} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {invitation.organizationName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Invited as {invitation.role ?? "member"}. Expires{" "}
                    {formatExpiry(invitation.expiresAt)}.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busyId === invitation.id}
                    onClick={() => decline(invitation)}
                  >
                    Decline
                  </Button>
                  <Button
                    size="sm"
                    disabled={busyId === invitation.id}
                    onClick={() => accept(invitation)}
                  >
                    Accept
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
