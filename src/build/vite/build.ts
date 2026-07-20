import type { Nitro } from "nitro/types";
import { isTest } from "std-env";
import { nitro as nitroPlugin } from "nitro/vite";
import { resolveModulePath } from "exsolve";

export async function viteBuild(nitro: Nitro) {
  if (nitro.options.dev) {
    throw new Error("Nitro dev CLI does not supports vite. Please use `vite dev` instead.");
  }

  const vitePkg = (nitro.options as any).__vitePkg__ || "vite";
  const viteEntry = resolveModulePath(vitePkg, { from: nitro.options.rootDir });
  const { createBuilder } = (await import(viteEntry)) as typeof import("vite");

  const pluginInstance = nitroPlugin({ _nitro: nitro });

  (globalThis as any).__nitro_build__ = true;

  const builder = await createBuilder({
    root: nitro.options.rootDir,
    plugins: [pluginInstance],
    logLevel: isTest ? "warn" : undefined,
  });

  delete (globalThis as any).__nitro_build__;

  await builder.buildApp();
}
