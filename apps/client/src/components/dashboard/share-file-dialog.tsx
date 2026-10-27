"use client";

import { CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type SharedFileUser, shareFile } from "@/lib/files";

const emailSchema = z.email("Enter a valid email address");

export function ShareFileDialog({
  fileId,
  fileName,
  open,
  onOpenChange,
}: {
  fileId: string;
  fileName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [email, setEmail] = useState("");
  const [sharedWith, setSharedWith] = useState<SharedFileUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const inputId = `share-email-${fileId}`;

  function handleOpenChange(next: boolean) {
    onOpenChange(next);

    if (!next) {
      setEmail("");
      setSharedWith(null);
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

    try {
      const { sharedWith: user } = await shareFile(fileId, parsed.data);
      setSharedWith(user);
      setEmail("");
    } catch (shareError) {
      setError(
        shareError instanceof Error
          ? shareError.message
          : "Could not share file",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Share file</DialogTitle>
            <DialogDescription>
              Share “{fileName}” with another user by email.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-1.5">
            <Label htmlFor={inputId}>Email</Label>
            <Input
              id={inputId}
              name="email"
              type="email"
              autoComplete="email"
              placeholder="teammate@example.com"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          {sharedWith ? (
            <output className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-foreground">
              <CheckCircle2
                aria-hidden="true"
                className="size-4 shrink-0 text-primary"
              />
              Shared with {sharedWith.name}
            </output>
          ) : null}

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
              {sharedWith ? "Done" : "Cancel"}
            </Button>
            <Button type="submit" disabled={isSubmitting || !email.trim()}>
              {isSubmitting ? "Sharing..." : "Share"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
