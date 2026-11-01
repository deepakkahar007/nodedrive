import { backoffMs } from "@repo/sync-core";
import type { RunLogBody } from "@repo/sync-protocol";
import type { CycleResult, createSyncEngine } from "./engine";

export type Trigger = RunLogBody["trigger"];
export type SyncEngine = ReturnType<typeof createSyncEngine>;

export type LoopOptions = {
  engine: SyncEngine;
  pollWaitSeconds?: number;
  intervalMs?: number;
  sleep?: (ms: number) => Promise<void>;
};

const HARD_POLL_TIMEOUT_MS = 35_000;
const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const isAbort = (error: unknown) => error instanceof Error && error.name === "AbortError";

/** Runs cycles on open, poll, interval and manual triggers. Triggers during a cycle coalesce into one rerun. */
export function createSyncLoop({
  engine,
  pollWaitSeconds = 25,
  intervalMs = 30_000,
  sleep = defaultSleep,
}: LoopOptions) {
  let running = false;
  let inFlight: Promise<CycleResult> | null = null;
  let rerun: Trigger | null = null;
  let poll: AbortController | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;

  function request(trigger: Trigger): Promise<CycleResult | undefined> {
    if (!running) return Promise.resolve(undefined);
    if (inFlight) {
      rerun = trigger;

      return inFlight;
    }

    inFlight = (async () => {
      let result = await engine.cycle(trigger);

      while (rerun && running) {
        const next: Trigger = rerun;

        rerun = null;
        result = await engine.cycle(next);
      }

      return result;
    })().finally(() => {
      inFlight = null;
    });

    return inFlight;
  }

  async function pollLoop() {
    let failures = 0;

    while (running) {
      poll = new AbortController();
      const hardStop = setTimeout(() => poll?.abort(), HARD_POLL_TIMEOUT_MS);

      try {
        const changed = await engine.hasRemoteChanges(poll.signal, pollWaitSeconds);

        failures = 0;

        if (changed) {
          const result = await request("poll");

          if (result?.status === "error") {
            failures += 1;
            await sleep(backoffMs(failures - 1));
          }
        }
      } catch (error) {
        if (!running) break;

        if (!isAbort(error)) {
          failures += 1;
          await sleep(backoffMs(failures - 1));
        }
      } finally {
        clearTimeout(hardStop);
        poll = null;
      }
    }
  }

  return {
    start() {
      if (running) return;

      running = true;
      timer = setInterval(() => void request("interval"), intervalMs);
      void request("open");
      void pollLoop();
    },
    stop() {
      running = false;

      if (timer) clearInterval(timer);

      timer = null;
      poll?.abort();
    },
    /** Asks for a cycle now. Use from focus, online and visibility handlers. */
    trigger(trigger: Trigger = "manual") {
      return request(trigger);
    },
  };
}
