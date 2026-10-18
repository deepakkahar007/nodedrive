"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@repo/auth/client";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleSignOut() {
    setPending(true);
    await authClient.signOut();
    router.push("/auth/sign-in");
    router.refresh();
  }

  return (
    <Button variant="outline" disabled={pending} onClick={handleSignOut}>
      Sign out
    </Button>
  );
}
