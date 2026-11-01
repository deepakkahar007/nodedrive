import type { LocalEntry, LocalFs, WriteSink } from "./fs";

type Node = { kind: "file" | "folder"; bytes: Uint8Array<ArrayBuffer>; mtime: number };

/** Proper ancestors of a path, shallowest first. */
const ancestors = (path: string) =>
  path
    .split("/")
    .slice(0, -1)
    .map((_, index, parts) => parts.slice(0, index + 1).join("/"));

/** In-memory folder for tests. mtime is strictly increasing so edits are always visible. */
export function createMemoryFs(): LocalFs {
  const nodes = new Map<string, Node>();
  let clock = 0;
  const tick = () => {
    clock = Math.max(clock + 1, Date.now());
    return clock;
  };
  const entryOf = (path: string, node: Node): LocalEntry => ({
    path,
    kind: node.kind,
    size: node.bytes.byteLength,
    mtime: node.mtime,
  });
  const ensureFolders = (paths: string[]) => {
    for (const path of paths) {
      if (!nodes.has(path)) nodes.set(path, { kind: "folder", bytes: new Uint8Array(0), mtime: tick() });
    }
  };

  return {
    async permission() {
      return "granted";
    },
    async requestPermission() {
      return "granted";
    },
    async list() {
      return [...nodes].map(([path, node]) => entryOf(path, node));
    },
    async stat(path) {
      const node = nodes.get(path);

      return node ? entryOf(path, node) : null;
    },
    async read(path) {
      const node = nodes.get(path);

      if (!node || node.kind !== "file") throw new Error(`Not a file: ${path}`);

      return new Blob([node.bytes]);
    },
    async openWrite(path) {
      ensureFolders(ancestors(path));
      const chunks: Uint8Array[] = [];
      const sink: WriteSink = {
        async write(chunk) {
          chunks.push(chunk.slice());
        },
        async close() {
          const size = chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
          const bytes = new Uint8Array(size);
          let offset = 0;

          for (const chunk of chunks) {
            bytes.set(chunk, offset);
            offset += chunk.byteLength;
          }

          nodes.set(path, { kind: "file", bytes, mtime: tick() });
        },
        async abort() {
          chunks.length = 0;
        },
      };

      return sink;
    },
    async mkdir(path) {
      ensureFolders([...ancestors(path), path]);
    },
    async remove(path) {
      for (const key of [...nodes.keys()]) {
        if (key === path || key.startsWith(`${path}/`)) nodes.delete(key);
      }
    },
  };
}
