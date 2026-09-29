import type { Nitro } from "nitro/types";
import { watchDev } from "./dev.ts";

export async function unbundledBuild(nitro: Nitro) {
  assertUnbundledSupport(nitro);
  await nitro.hooks.callHook("build:before", nitro);
  return watchDev(nitro);
}

/** Throw for what `builder: false` does not support yet (production builds, miniflare runner). */
export function assertUnbundledSupport(nitro: Nitro) {
  if (!nitro.options.dev) {
    throw new Error(
      "Production builds are not supported with `builder: false` yet. Set `builder` to `rolldown`, `rollup` or `vite` to build."
    );
  }
  const runner = nitro.options.devServer.runner || process.env.NITRO_DEV_RUNNER;
  if (runner === "miniflare") {
    throw new Error(
      `The \`miniflare\` dev runner (preset: \`${nitro.options.preset}\`) is not supported with \`builder: false\` yet. Use a Node.js, Bun or Deno runner, or set \`builder\` to \`rolldown\`, \`rollup\` or \`vite\`.`
    );
  }
}
