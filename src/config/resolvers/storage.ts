import type { NitroOptions } from "nitro/types";
import { resolve } from "pathe";

export async function resolveStorageOptions(options: NitroOptions) {
  // Build-only storage
  const fsMounts = {
    root: resolve(options.rootDir),
    src: resolve(options.srcDir),
    build: resolve(options.buildDir),
    cache: resolve(options.buildDir, "cache"),
  } as const;
  for (const p in fsMounts) {
    options.devStorage[p] = options.devStorage[p] || {
      driver: "fs",
      readOnly: p === "root" || p === "src",
      base: fsMounts[p as keyof typeof fsMounts],
    };
  }

  // Runtime storage
  if (
    options.dev &&
    options.storage.data === undefined &&
    options.devStorage.data === undefined
  ) {
    options.devStorage.data = {
      driver: "fs",
      base: resolve(options.rootDir, ".data/kv"),
    };
  } else if (options.node && options.storage.data === undefined) {
    options.storage.data = {
      driver: "fsLite",
      base: "./.data/kv",
    };
  }
}
