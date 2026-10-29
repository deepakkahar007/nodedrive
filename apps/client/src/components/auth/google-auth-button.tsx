"use client";

import { signInWithGoogle } from "@repo/auth/client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { dashboardUrl } from "@/lib/routes";
import { GoogleIcon } from "./google-icon";

export function GoogleAuthButton({
  onError,
}: {
  onError: (message: string | null) => void;
}) {
  const [pending, setPending] = useState(false);

  async function handleClick() {
    onError(null);
    setPending(true);
    const { error } = await signInWithGoogle({
      callbackURL: dashboardUrl(),
    });
    if (error) {
      onError(error);
      setPending(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      disabled={pending}
      onClick={handleClick}
      className="h-11 w-full rounded-xl"
    >
      <GoogleIcon className="size-4" />
      Continue with Google
    </Button>
  );
}
