"use client";

import { inviteMember } from "@repo/auth/client";
import { UserPlus } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const emailSchema = z.email("Enter a valid email address");

export function InviteMemberDialog({
  organizationId,
}: {
  organizationId: string;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleOpenChange(next: boolean) {
    setOpen(next);

    if (!next) {
      setEmail("");
      setSentTo(null);
      setError(null);
      setIsSubmitting(false);
    }
  }

  async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const parsed = emailSchema.safeParse(email.trim());

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Enter a valid email");
      return;
    }

    setIsSubmitting(true);
    const { error: inviteError } = await inviteMember({
      email: parsed.data,
      role: "member",
      organizationId,
    });
    setIsSubmitting(false);

    if (inviteError) {
      setError(inviteError);
      return;
    }

    setSentTo(parsed.data);
    setEmail("");
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger className={buttonVariants()}>
        <UserPlus aria-hidden="true" />
        Invite member
      </DialogTrigger>

      <DialogContent>
        {sentTo ? (
          <>
            <DialogHeader>
              <DialogTitle>Invitation sent</DialogTitle>
              <DialogDescription>
                {sentTo} can join from the Organizations page after signing in.
                The invitation expires in 48 hours.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={() => handleOpenChange(false)}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <form className="grid gap-4" onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Invite member</DialogTitle>
              <DialogDescription>
                Send an invitation by email. It expires in 48 hours.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-1.5">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="teammate@example.com"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>

            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Sending..." : "Send invite"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
