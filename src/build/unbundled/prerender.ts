import type { Nitro } from "nitro/types";

import { EnvServer } from "env-runner";
import { scanHandlers } from "../../scan.ts";
import { prepareUnbundledApp } from "./entry.ts";
import { unbundledPlugins } from "./plugins.ts";

/**
 * Start the prerenderer from the server sources, without a build (`builder: false`).
 *
 * Runs in a Node.js worker, like the prerenderer built by a bundler.
 */
export async function startUnbundledPrerenderer(nitro: Nitro): Promise<EnvServer> {
  await nitro.hooks.callHook("build:before", nitro);
  await scanHandlers(nitro);
  nitro.routing.sync();
  const { entry, virtual } = await prepareUnbundledApp(nitro);
  await nitro.hooks.callHook("compiled", nitro);
  return new EnvServer({
    runner: "node-worker",
    name: "nitro-prerender",
    entry,
    data: { virtual },
    plugins: await unbundledPlugins(nitro),
  }).start();
}
