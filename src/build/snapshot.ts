import type { Nitro } from "nitro/types";
import { dirname, join, resolve } from "pathe";
import { mkdir, writeFile } from "node:fs/promises";
import { snapshotStorage } from "../utils/storage.ts";

export async function snapshot(nitro: Nitro) {
  if (
    nitro.options.bundledStorage.length === 0 ||
    nitro.options.preset === "nitro-prerender"
  ) {
    return;
  }
  // TODO: Use virtual storage for server assets
  const storageDir = resolve(nitro.options.buildDir, "snapshot");
  nitro.options.serverAssets.push({
    baseName: "nitro:bundled",
    dir: storageDir,
  });

  const data = await snapshotStorage(nitro);
  await Promise.all(
    Object.entries(data).map(async ([path, contents]) => {
      if (typeof contents !== "string") {
        contents = JSON.stringify(contents);
      }
      const fsPath = join(storageDir, path.replace(/:/g, "/"));
      await mkdir(dirname(fsPath), { recursive: true });
      await writeFile(fsPath, contents, "utf8");
    })
  );
}
