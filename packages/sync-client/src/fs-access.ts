import type { LocalEntry, LocalFs, Permission, WriteSink } from "./fs";

// Minimal File System Access types; the DOM lib is not part of this package.
type Writable = {
  write(data: Uint8Array): Promise<void>;
  close(): Promise<void>;
  abort(): Promise<void>;
};
type FileHandle = { kind: "file"; name: string; getFile(): Promise<File>; createWritable(): Promise<Writable> };
type DirHandle = {
  kind: "directory";
  name: string;
  queryPermission(options: { mode: "readwrite" }): Promise<Permission>;
  requestPermission(options: { mode: "readwrite" }): Promise<Permission>;
  entries(): AsyncIterable<[string, FileHandle | DirHandle]>;
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<DirHandle>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileHandle>;
  removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>;
};

const split = (path: string) => path.split("/").filter(Boolean);

/** Browser folder via the File System Access API. Requires a user gesture for requestPermission. */
export function createAccessFs(root: DirHandle): LocalFs {
  async function dirFor(path: string, create: boolean): Promise<DirHandle> {
    let dir = root;

    for (const name of split(path)) dir = await dir.getDirectoryHandle(name, { create });

    return dir;
  }

  async function fileHandleFor(path: string, create: boolean): Promise<FileHandle> {
    const parts = split(path);
    const name = parts.pop() ?? "";
    const dir = await dirFor(parts.join("/"), create);

    return dir.getFileHandle(name, { create });
  }

  async function walk(dir: DirHandle, prefix: string, out: LocalEntry[]) {
    for await (const [name, handle] of dir.entries()) {
      const path = prefix ? `${prefix}/${name}` : name;

      if (handle.kind === "directory") {
        out.push({ path, kind: "folder", size: 0, mtime: 0 });
        await walk(handle, path, out);
      } else {
        const file = await handle.getFile();

        out.push({ path, kind: "file", size: file.size, mtime: file.lastModified });
      }
    }
  }

  return {
    permission: () => root.queryPermission({ mode: "readwrite" }),
    requestPermission: () => root.requestPermission({ mode: "readwrite" }),
    async list() {
      const out: LocalEntry[] = [];

      await walk(root, "", out);

      return out;
    },
    async stat(path) {
      try {
        const handle = await fileHandleFor(path, false);
        const file = await handle.getFile();

        return { path, kind: "file", size: file.size, mtime: file.lastModified };
      } catch {
        try {
          await dirFor(path, false);

          return { path, kind: "folder", size: 0, mtime: 0 };
        } catch {
          return null;
        }
      }
    },
    async read(path) {
      return (await fileHandleFor(path, false)).getFile();
    },
    async openWrite(path) {
      const writable = await (await fileHandleFor(path, true)).createWritable();
      const sink: WriteSink = {
        write: (chunk) => writable.write(chunk),
        close: () => writable.close(),
        abort: () => writable.abort(),
      };

      return sink;
    },
    async mkdir(path) {
      await dirFor(path, true);
    },
    async remove(path) {
      const parts = split(path);
      const name = parts.pop() ?? "";

      try {
        const parent = await dirFor(parts.join("/"), false);

        await parent.removeEntry(name, { recursive: true });
      } catch (error) {
        if (!(error instanceof DOMException) || error.name !== "NotFoundError") throw error;
      }
    },
  };
}
