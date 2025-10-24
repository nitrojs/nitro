import type { Nitro } from "nitro/types";
import { nitro as nitroPlugin } from "./plugin";

export async function viteBuild(nitro: Nitro) {
  if (nitro.options.dev) {
    throw new Error(
      "Nitro vite builder is not supported in development mode. Please use `vite dev` instead."
    );
  }
  const { createBuilder } = await import("vite");
  const builder = await createBuilder({
    base: nitro.options.rootDir,
    plugins: [await nitroPlugin({ _nitro: nitro })],
  });
  await builder.buildApp();
}
