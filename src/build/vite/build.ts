import type { Nitro } from "nitro/types";
import { isTest } from "std-env";
import { nitro as nitroPlugin } from "nitro/vite";

export async function viteBuild(nitro: Nitro) {
  if (nitro.options.dev) {
    throw new Error("Nitro dev CLI does not supports vite. Please use `vite dev` instead.");
  }
  const { createBuilder } = await import((nitro.options as any).__vitePkg__ || "vite");
  const builder = await createBuilder({
    base: nitro.options.rootDir,
    plugins: [await nitroPlugin({ _nitro: nitro })],
    logLevel: isTest ? "warn" : undefined,
  });
  await builder.buildApp();
}
