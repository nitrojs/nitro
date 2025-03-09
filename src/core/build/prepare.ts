import fsp from "node:fs/promises";
import type { Nitro } from "nitro/types";

export async function prepare(nitro: Nitro) {
  await prepareDir(nitro.options.output.dir);
  if (!nitro.options.noPublicDir) {
    await prepareDir(nitro.options.output.publicDir);
  }
  if (!nitro.options.static) {
    await prepareDir(nitro.options.output.serverDir);
  }
}

async function prepareDir(dir: string) {
  await fsp.rm(dir, { recursive: true, force: true });
  await fsp.mkdir(dir, { recursive: true });
}
