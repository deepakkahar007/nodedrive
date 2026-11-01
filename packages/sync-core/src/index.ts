// Pure sync rules shared by browser and server. No I/O.

const ILLEGAL_CHAR = /[\\/:*?"<>|\u0000-\u001f]/g;
const RESERVED_NAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i;
const MAX_NAME_BYTES = 255;
const encoder = new TextEncoder();

export type NameCheck = { ok: true; name: string } | { ok: false; reason: string };

/** NFC-normalize and validate one path segment. Rejects, never renames. */
export function checkName(input: string): NameCheck {
  const name = input.normalize("NFC").trim();

  if (name === "" || name === "." || name === "..") {
    return { ok: false, reason: "empty name" };
  }
  if (encoder.encode(name).length > MAX_NAME_BYTES) {
    return { ok: false, reason: "name too long" };
  }
  if (name.search(ILLEGAL_CHAR) !== -1) {
    return { ok: false, reason: "illegal character" };
  }
  if (RESERVED_NAME.test(name)) {
    return { ok: false, reason: "reserved name" };
  }
  if (/[. ]$/.test(name)) {
    return { ok: false, reason: "trailing dot or space" };
  }

  return { ok: true, name };
}

/** Key for case-insensitive collision checks. */
export function pathKey(path: string): string {
  return path.normalize("NFC").toLowerCase();
}

/** Splits "report.pdf" into stem and extension (with dot). No dot = no extension. */
export function splitName(name: string): { stem: string; ext: string } {
  const dot = name.lastIndexOf(".");

  if (dot <= 0) return { stem: name, ext: "" };

  return { stem: name.slice(0, dot), ext: name.slice(dot) };
}

/** Stem + marker + ext, trimming the stem until the name fits the byte limit. */
function fitName(stem: string, marker: string, ext: string): string {
  let kept = stem;

  // ponytail: trims one code point at a time; fine for rare long names
  while (encoder.encode(kept + marker + ext).length > MAX_NAME_BYTES) {
    kept = Array.from(kept).slice(0, -1).join("");
  }

  return `${kept}${marker}${ext}`;
}

/** First free name among siblings. `taken` holds pathKey values. */
export function uniqueName(name: string, taken: ReadonlySet<string>): string {
  if (!taken.has(pathKey(name))) return name;

  const { stem, ext } = splitName(name);

  for (let n = 2; ; n += 1) {
    const candidate = fitName(stem, ` (${n})`, ext);

    if (!taken.has(pathKey(candidate))) return candidate;
  }
}

export type Side = "absent" | "same" | "changed";

export type ReconcileInput = {
  base: boolean;
  local: Side;
  remote: Side;
  sameContent: boolean;
  kindMismatch?: boolean;
};

export type Action =
  | "none"
  | "drop-record"
  | "download"
  | "upload"
  | "upload-as-new"
  | "delete-local"
  | "delete-remote"
  | "adopt-remote"
  | "conflict";

/** Decision table from sync spec 10.5. Renames are handled separately. */
export function reconcile({
  base,
  local,
  remote,
  sameContent,
  kindMismatch = false,
}: ReconcileInput): Action {
  if (kindMismatch && local !== "absent" && remote !== "absent") return "conflict";

  if (local === "absent") {
    if (remote === "absent") return base ? "drop-record" : "none";
    return remote === "same" ? "delete-remote" : "download";
  }

  if (remote === "absent") return local === "same" ? "delete-local" : "upload-as-new";
  if (local === "same") return remote === "same" ? "none" : "download";
  if (remote === "same") return "upload";

  return sameContent ? "adopt-remote" : "conflict";
}

/** "Name (conflicted copy <device> <date>).ext", kept within the name byte limit. */
export function conflictName({
  name,
  device,
  date,
}: {
  name: string;
  device: string;
  date: string;
}): string {
  const { stem, ext } = splitName(name);

  return fitName(stem, ` (conflicted copy ${device.replace(ILLEGAL_CHAR, "_")} ${date})`, ext);
}

export type DeleteVerdict = "ok" | "confirm" | "block";

/** Mass-delete and empty-root guard (sync spec 10.7). */
export function guardDeletes({
  deletes,
  known,
  scanned,
}: {
  deletes: number;
  known: number;
  scanned: number;
}): DeleteVerdict {
  if (deletes === 0) return "ok";
  if (scanned === 0) return "block";
  if (deletes > Math.max(known * 0.2, 50)) return "confirm";

  return "ok";
}

const BACKOFF_MIN_MS = 1_000;
const BACKOFF_MAX_MS = 30_000;

/** Retry delay for attempt n (0-based), jittered within [1s, 30s]. */
export function backoffMs(attempt: number, random: () => number = Math.random): number {
  const ceiling = Math.min(BACKOFF_MAX_MS, BACKOFF_MIN_MS * 2 ** attempt);

  return BACKOFF_MIN_MS + random() * (ceiling - BACKOFF_MIN_MS);
}
