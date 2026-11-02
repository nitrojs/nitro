import { mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "pathe";
import { build, copyPublicAssets, createNitro, prepare, prerender } from "nitro/builder";
import type { LoadConfigOptions } from "nitro/types";

const tmpDir = fileURLToPath(new URL("./.tmp", import.meta.url));

export async function prerenderFixture(name: string, opts?: LoadConfigOptions) {
  const outDir = join(tmpDir, name);
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  const nitro = await createNitro(
    {
      rootDir: fileURLToPath(new URL(`./${name}`, import.meta.url)),
      preset: "static",
      output: { dir: outDir },
      prerender: { crawlLinks: false, routes: ["/"] },
    },
    opts
  );

  try {
    await prepare(nitro);
    await copyPublicAssets(nitro);
    await prerender(nitro);
    await build(nitro);
  } finally {
    await nitro.close();
  }

  return { nitro, outDir };
}

export async function cleanupFixtures(names: string[]) {
  await Promise.all(names.map((name) => rm(join(tmpDir, name), { recursive: true, force: true })));
}
