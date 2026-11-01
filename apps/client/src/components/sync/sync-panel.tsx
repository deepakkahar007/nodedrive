"use client";

import type { ConflictRecord, CycleResult, RunEntry } from "@repo/sync-client";
import {
  AlertCircle,
  CheckCircle2,
  FolderSync,
  Loader2,
  MonitorOff,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  allowMassDelete,
  chooseFolder,
  isSyncSupported,
  resumeSync,
  savedFolder,
  startSync,
  stopSync,
  syncApi,
  syncDb,
  syncNow,
} from "@/lib/sync-client";

type View = "checking" | "unsupported" | "no-folder" | "ready";

function describe(result: CycleResult | null): {
  text: string;
  tone: "ok" | "warn" | "error";
} {
  if (!result) return { text: "Waiting for the first sync.", tone: "warn" };

  switch (result.status) {
    case "ok":
      return { text: "Up to date.", tone: "ok" };
    case "needs-permission":
      return {
        text: "Folder access expired. Grant access to resume sync.",
        tone: "warn",
      };
    case "paused":
    case "needs-confirmation":
      return {
        text: "Paused: this sync would remove most of the folder. Check it before allowing the deletes.",
        tone: "warn",
      };
    case "partial":
      return {
        text: `${result.errors.length} file(s) failed and will retry.`,
        tone: "warn",
      };
    case "error":
      return {
        text: `Sync failed: ${result.errors[0]?.message ?? "unknown error"}`,
        tone: "error",
      };
  }
}

const tones = {
  ok: "text-primary",
  warn: "text-muted-foreground",
  error: "text-destructive",
};

function summarize(run: RunEntry): string {
  const {
    uploaded = 0,
    downloaded = 0,
    deleted = 0,
    moved = 0,
    conflicts = 0,
  } = run.counts;

  return `${uploaded} uploaded · ${downloaded} downloaded · ${moved} moved · ${deleted} removed · ${conflicts} conflicts`;
}

async function loadPanel(
  setConflicts: (items: ConflictRecord[]) => void,
  setRuns: (items: RunEntry[]) => void,
) {
  setConflicts(
    await syncDb()
      .conflicts.filter((item) => !item.resolved)
      .toArray(),
  );
  setRuns(
    (
      await syncApi()
        .runs()
        .catch(() => ({ runs: [] }))
    ).runs.slice(0, 10),
  );
}

export function SyncPanel() {
  const [view, setView] = useState<View>("checking");
  const [folderName, setFolderName] = useState("");
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<CycleResult | null>(null);
  const [conflicts, setConflicts] = useState<ConflictRecord[]>([]);
  const [runs, setRuns] = useState<RunEntry[]>([]);

  const refresh = useCallback(() => loadPanel(setConflicts, setRuns), []);
  const onCycle = useCallback(
    (result: CycleResult) => {
      setLast(result);
      void refresh();
    },
    [refresh],
  );

  useEffect(() => {
    if (!isSyncSupported()) {
      setView("unsupported");

      return;
    }

    let cancelled = false;

    void (async () => {
      const folder = await savedFolder();

      if (cancelled) return;

      if (!folder) {
        setView("no-folder");

        return;
      }

      setFolderName(folder.name);
      setView("ready");
      startSync(folder, onCycle);
      void refresh();
    })();

    return () => {
      cancelled = true;
      stopSync();
    };
  }, [onCycle, refresh]);

  async function choose() {
    try {
      const folder = await chooseFolder();

      setFolderName(folder.name);
      setView("ready");
      startSync(folder, onCycle);
    } catch {
      // Picker dismissed.
    }
  }

  async function run(task: () => Promise<unknown>) {
    setBusy(true);

    try {
      await task();
    } finally {
      setBusy(false);
    }
  }

  if (view === "checking") return null;

  if (view === "unsupported") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MonitorOff aria-hidden="true" className="size-4" />
            Folder sync is not available here
          </CardTitle>
          <CardDescription>
            Folder sync needs a desktop Chromium browser: Chrome, Edge, or
            Opera. Everything else in NodeDrive works in any browser.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const status = describe(last);
  const needsPermission = last?.status === "needs-permission";
  const paused =
    last?.status === "paused" || last?.status === "needs-confirmation";

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderSync aria-hidden="true" className="size-4" />
            Folder sync
          </CardTitle>
          <CardDescription>
            Keeps a folder on this computer in sync while NodeDrive is open.
            Deletes move to the bin on the server, not the OS trash.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {view === "no-folder" ? (
            <div className="grid gap-3">
              <p className="text-sm text-muted-foreground">
                No folder selected yet.
              </p>
              <div>
                <Button onClick={choose}>Choose a folder</Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="grid gap-1">
                <p className="text-sm font-medium">{folderName}</p>
                <p
                  className={`flex items-center gap-2 text-sm ${tones[busy ? "warn" : status.tone]}`}
                >
                  {busy ? (
                    <Loader2
                      aria-hidden="true"
                      className="size-4 animate-spin"
                    />
                  ) : status.tone === "ok" ? (
                    <CheckCircle2 aria-hidden="true" className="size-4" />
                  ) : status.tone === "error" ? (
                    <AlertCircle aria-hidden="true" className="size-4" />
                  ) : null}
                  {busy ? "Syncing…" : status.text}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {needsPermission ? (
                  <Button onClick={() => run(resumeSync)} disabled={busy}>
                    Resume sync
                  </Button>
                ) : null}
                {paused ? (
                  <Button onClick={() => run(allowMassDelete)} disabled={busy}>
                    Allow these deletes
                  </Button>
                ) : null}
                <Button
                  variant="outline"
                  onClick={() => run(syncNow)}
                  disabled={busy || needsPermission}
                >
                  Sync now
                </Button>
                <Button variant="outline" onClick={choose} disabled={busy}>
                  Choose another folder
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {conflicts.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Conflicts</CardTitle>
            <CardDescription>
              Both versions are kept. Open the copy and decide which one to
              keep.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2">
              {conflicts.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
                >
                  <div className="min-w-0 text-sm">
                    <p className="truncate font-medium">{item.path}</p>
                    <p className="truncate text-muted-foreground">
                      Copy: {item.copyPath}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      await syncDb().conflicts.update(item.id ?? -1, {
                        resolved: true,
                      });
                      void refresh();
                    }}
                  >
                    Mark resolved
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {runs.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Recent syncs</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2 text-sm">
              {runs.map((item) => (
                <li
                  key={item.id}
                  className="grid gap-0.5 rounded-lg border p-3"
                >
                  <p className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium capitalize">
                      {item.status}
                    </span>
                    <time
                      className="text-muted-foreground"
                      dateTime={item.finishedAt}
                    >
                      {new Date(item.finishedAt).toLocaleString()}
                    </time>
                  </p>
                  <p className="text-muted-foreground">{summarize(item)}</p>
                  {item.errorSummary ? (
                    <p className="text-destructive">{item.errorSummary}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
