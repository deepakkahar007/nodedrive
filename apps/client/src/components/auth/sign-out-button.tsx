"use client";

import { authClient } from "@repo/auth/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SignOutButton({ className }: { className?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleSignOut() {
    setPending(true);
    await authClient.signOut();
    router.push("/auth");
    router.refresh();
  }

  return (
    <Button
      variant="outline"
      className={cn(className)}
      disabled={pending}
      onClick={handleSignOut}
    >
      Sign out
    </Button>
  );
}
