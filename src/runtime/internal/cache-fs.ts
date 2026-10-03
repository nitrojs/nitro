import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "pathe";
import { createBlobStorage } from "ocache";
import type { StorageInterface } from "ocache";

/**
 * Filesystem cache storage (Node.js compatible runtimes only).
 *
 * Each entry is stored as one file. Storage TTLs are not enforced by the filesystem;
 * ocache checks entry expiry on read and overwrites expired entries.
 */
export function createFSCacheStorage(opts: { dir: string }): StorageInterface {
  const dir = resolve(opts.dir);
  let tmpCounter = 0;
  return createBlobStorage({
    async get(key) {
      try {
        return await readFile(keyToPath(dir, key));
      } catch (error) {
        if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
          return null;
        }
        throw error;
      }
    },
    async set(key, value) {
      const path = keyToPath(dir, key);
      if (value === null) {
        await rm(path, { force: true });
        return;
      }
      await mkdir(dirname(path), { recursive: true });
      const tmpPath = `${path}.${Date.now().toString(36)}${(tmpCounter++).toString(36)}.tmp`;
      await writeFile(tmpPath, value);
      await rename(tmpPath, path);
    },
  });
}

function keyToPath(dir: string, key: string): string {
  const segments = key.split(/[:/\\]/).filter(Boolean);
  if (segments.length === 0 || segments.some((s) => s === "." || s === "..")) {
    throw new Error(`[cache] Invalid cache key: ${JSON.stringify(key)}`);
  }
  return join(dir, ...segments);
}
