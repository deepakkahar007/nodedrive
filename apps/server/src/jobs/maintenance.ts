import {
  deleteRevisionRows,
  expireUploadSessions,
  listRevisionsOlderThan,
  pruneChangesOlderThan,
  pruneSyncLogs,
  sampleStorageKeys,
} from "@repo/drizzle";
import { abortMultipartUpload, deleteStoredObject, getObjectMetadata } from "@repo/storage";

const DAY_MS = 24 * 60 * 60 * 1000;
// Retention windows from sync spec §7 and §15.
const RETENTION_DAYS = { changes: 90, revisions: 90, logs: 30 };
const REVISION_BATCH = 500;
const SPOT_CHECK = 50;

export type MaintenanceReport = {
  expiredSessions: number;
  revisionsPruned: number;
  accountsPruned: number;
  logsPruned: number;
  spotChecked: number;
  missingObjects: number;
};

const daysBefore = (now: Date, days: number) => new Date(now.getTime() - days * DAY_MS);
const quietly = (task: Promise<unknown>) => task.catch(() => undefined);

/** One pass of retention and spot checks. Safe to re-run; every step is idempotent. */
export async function runMaintenance(now = new Date()): Promise<MaintenanceReport> {
  const sessions = await expireUploadSessions(now);

  for (const session of sessions) {
    if (session.uploadId) {
      await quietly(abortMultipartUpload({ key: session.storageKey, uploadId: session.uploadId }));
    }

    await quietly(deleteStoredObject(session.storageKey));
  }

  const revisions = await listRevisionsOlderThan(daysBefore(now, RETENTION_DAYS.revisions), REVISION_BATCH);
  const removed: string[] = [];

  for (const revision of revisions) {
    try {
      await deleteStoredObject(revision.storageKey);
      removed.push(revision.id);
    } catch {
      // Keep the row so the next run retries the blob.
    }
  }

  await deleteRevisionRows(removed);

  const keys = await sampleStorageKeys(SPOT_CHECK);
  let missingObjects = 0;

  for (const key of keys) {
    await getObjectMetadata(key).catch(() => {
      missingObjects += 1;
    });
  }

  const report: MaintenanceReport = {
    expiredSessions: sessions.length,
    revisionsPruned: removed.length,
    accountsPruned: await pruneChangesOlderThan(daysBefore(now, RETENTION_DAYS.changes)),
    logsPruned: await pruneSyncLogs(daysBefore(now, RETENTION_DAYS.logs)),
    spotChecked: keys.length,
    missingObjects,
  };

  // ponytail: structured log line is the metric; wire a dashboard/alert on missingObjects > 0 later
  console.log(JSON.stringify({ job: "maintenance", at: now.toISOString(), ...report }));

  return report;
}
