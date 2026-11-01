import { clientEnv } from "@repo/env/client";
import {
  type CycleResult,
  createAccessFs,
  createSyncApi,
  createSyncDb,
  createSyncEngine,
  createSyncLoop,
  loadRootHandle,
  navigatorLock,
  saveRootHandle,
  type Trigger,
} from "@repo/sync-client";

// Structural type for the picked folder. The DOM lib lacks File System Access types here.
type FolderHandle = Parameters<typeof createAccessFs>[0];
type Session = {
  engine: ReturnType<typeof createSyncEngine>;
  loop: ReturnType<typeof createSyncLoop>;
  fs: ReturnType<typeof createAccessFs>;
  stopListening: () => void;
};

let db: ReturnType<typeof createSyncDb> | null = null;
let session: Session | null = null;

// Lazy so importing this module on the server never touches IndexedDB.
export const syncDb = () => (db ??= createSyncDb("nodedrive-sync"));
export const syncApi = () =>
  createSyncApi({ baseUrl: clientEnv.NEXT_PUBLIC_BETTER_AUTH_URL });

export function isSyncSupported(): boolean {
  return "showDirectoryPicker" in window && "indexedDB" in window;
}

export async function savedFolder(): Promise<FolderHandle | null> {
  return ((await loadRootHandle(syncDb())) as FolderHandle | undefined) ?? null;
}

export async function chooseFolder(): Promise<FolderHandle> {
  const picker = window as unknown as {
    showDirectoryPicker(options: { mode: "readwrite" }): Promise<FolderHandle>;
  };
  const handle = await picker.showDirectoryPicker({ mode: "readwrite" });

  await saveRootHandle(syncDb(), handle);

  return handle;
}

/** Starts the engine and loop for this tab. `onCycle` fires after every cycle, automatic ones included. */
export function startSync(
  folder: FolderHandle,
  onCycle: (result: CycleResult) => void,
): void {
  stopSync();

  // Keeps sync state from being evicted under storage pressure. Denial is fine; the engine recovers with a full tree.
  void navigator.storage?.persist?.();

  const fs = createAccessFs(folder);
  const engine = createSyncEngine({
    baseUrl: clientEnv.NEXT_PUBLIC_BETTER_AUTH_URL,
    fs,
    db: syncDb(),
    deviceLabel: navigator.platform || "Browser",
    lock: navigatorLock("nodedrive-sync"),
    onCycle,
  });
  const loop = createSyncLoop({ engine });
  const wake = (trigger: Trigger) => () => void loop.trigger(trigger);
  const onFocus = wake("focus");
  const onOnline = wake("online");
  const onVisible = () => {
    if (document.visibilityState === "visible") onFocus();
  };

  window.addEventListener("focus", onFocus);
  window.addEventListener("online", onOnline);
  document.addEventListener("visibilitychange", onVisible);

  session = {
    engine,
    loop,
    fs,
    stopListening: () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
    },
  };
  loop.start();
}

export function stopSync(): void {
  session?.loop.stop();
  session?.stopListening();
  session = null;
}

export function syncNow(): Promise<CycleResult | undefined> {
  return session?.loop.trigger("manual") ?? Promise.resolve(undefined);
}

/** Call from a click handler: the browser only shows the permission prompt inside a user gesture. */
export async function resumeSync(): Promise<void> {
  await session?.fs.requestPermission();
  await syncNow();
}

export async function allowMassDelete(): Promise<void> {
  session?.engine.confirmDeletes();
  await syncNow();
}
