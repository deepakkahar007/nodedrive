export type LocalKind = "file" | "folder";
export type LocalEntry = { path: string; kind: LocalKind; size: number; mtime: number };
export type Permission = "granted" | "prompt" | "denied";
export type WriteSink = {
  write(chunk: Uint8Array): Promise<void>;
  close(): Promise<void>;
  abort(): Promise<void>;
};

/** Port over the synced folder. Paths are "/"-separated and relative to the root. */
export type LocalFs = {
  permission(): Promise<Permission>;
  requestPermission(): Promise<Permission>;
  list(): Promise<LocalEntry[]>;
  stat(path: string): Promise<LocalEntry | null>;
  read(path: string): Promise<Blob>;
  openWrite(path: string): Promise<WriteSink>;
  mkdir(path: string): Promise<void>;
  remove(path: string): Promise<void>;
};
