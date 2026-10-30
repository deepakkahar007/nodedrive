"use client";

import { clientEnv } from "@repo/env/client";
import { Bell } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Toaster, toast } from "sonner";
import { Button } from "@/components/ui/button";

type SharedFile = { id: string; fileName: string; sharedBy: string };

export function ShareNotifications({ userId }: { userId: string }) {
  const router = useRouter();
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const key = `share-cursor:${userId}`;
    const url = new URL(
      `${clientEnv.NEXT_PUBLIC_BETTER_AUTH_URL}/notifications/stream`,
    );
    url.searchParams.set("since", localStorage.getItem(key) ?? "");

    const source = new EventSource(url, { withCredentials: true });

    source.addEventListener("shares", (event) => {
      localStorage.setItem(key, event.lastEventId);

      const shares = JSON.parse(event.data) as SharedFile[];
      const [first] = shares;
      if (!first) return;

      const single = shares.length === 1;
      const title = single
        ? `${first.sharedBy} shared “${first.fileName}” with you`
        : `${shares.length} files were shared with you`;
      const open = () => {
        window.focus();
        router.push("/dashboard/shared");
      };

      toast(title, { action: { label: "View", onClick: open } });

      if (
        typeof Notification !== "undefined" &&
        Notification.permission === "granted"
      ) {
        const notification = new Notification("Shared with you", {
          body: title,
          tag: single ? first.id : "share-summary",
        });
        notification.onclick = () => {
          open();
          notification.close();
        };
      }
    });

    return () => source.close();
  }, [userId, router]);

  return (
    <Toaster
      position="top-left"
      offset={{ top: 80, left: 16 }}
      theme={resolvedTheme === "dark" ? "dark" : "light"}
    />
  );
}

export function EnableNotificationsButton() {
  const [permission, setPermission] = useState<NotificationPermission | null>(
    null,
  );

  useEffect(() => {
    if (typeof Notification !== "undefined") {
      setPermission(Notification.permission);
    }
  }, []);

  if (permission === null || permission === "granted") return null;

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Enable notifications"
      title={
        permission === "denied"
          ? "Notifications are blocked. Allow them in your browser settings."
          : "Enable share notifications"
      }
      disabled={permission === "denied"}
      onClick={async () =>
        setPermission(await Notification.requestPermission())
      }
    >
      <Bell />
    </Button>
  );
}
