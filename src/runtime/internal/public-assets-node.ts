import { promises as fsp } from "node:fs";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import assets from "#nitro/virtual/public-assets-data";
import { ENCODING_EXTS } from "./public-assets.ts";

/** Reads a public asset from the public dir (Node.js compatible runtimes only). */
export function readAsset(
  id: string,
  { encoding, range }: { encoding?: string; range?: { start: number; end: number } } = {}
): Promise<Uint8Array | ReadableStream<Uint8Array> | undefined> {
  const assetPath =
    (assets as Record<string, { path: string }>)[id].path +
    (encoding ? ENCODING_EXTS[encoding] : "");
  // Dev asset paths are absolute, and the Vite dev runner does not set `__nitro_main__`
  const main = (globalThis as any).__nitro_main__;
  const path = main ? resolve(dirname(fileURLToPath(main)), assetPath) : assetPath;
  // Public dirs might be pruned after the build (uploaded to a CDN, sourcemaps
  // stripped), so a manifest entry with no file behind it reads as absent, not broken.
  return (range ? readRange(path, range) : fsp.readFile(path)).catch((error) => {
    if (error?.code !== "ENOENT") {
      throw error;
    }
    return undefined;
  });
}

// Opened before streaming so a missing file still reads as absent
async function readRange(path: string, { start, end }: { start: number; end: number }) {
  const handle = await fsp.open(path);
  return Readable.toWeb(handle.createReadStream({ start, end })) as ReadableStream<Uint8Array>;
}
