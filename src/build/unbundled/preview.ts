import type { Socket } from "node:net";
import type { NitroConfig } from "nitro/types";
import type { PreviewInstance, PreviewOptions } from "../../preview.ts";

import consola from "consola";
import { RunnerManager, loadRunner } from "env-runner";
import { joinURL, withTrailingSlash } from "ufo";
import { loadConfig } from "c12";
import { createNitro } from "../../nitro.ts";
import { prepareUnbundledApp } from "./entry.ts";
import { unbundledPlugins } from "./plugins.ts";

const previewDotenv = { fileName: [".env.preview", ".env.production", ".env"] };

/**
 * Preview the server sources without a build (`builder: false`).
 *
 * Returns `undefined` when the project uses a builder.
 */
export async function startUnbundledPreview(
  opts: PreviewOptions
): Promise<PreviewInstance | undefined> {
  // User config only: resolving the options can install dependencies (e.g. the builder)
  const { config: userConfig } = await loadConfig<NitroConfig>({
    name: "nitro",
    cwd: opts.rootDir,
    dotenv: false,
    extend: false,
  }).catch(() => ({ config: undefined }));
  if (userConfig?.builder !== false) {
    return;
  }

  const nitro = await createNitro(
    { rootDir: opts.rootDir, dev: false, preset: "standard" },
    { dotenv: previewDotenv }
  );
  const manager = new RunnerManager();
  try {
    const { entry, virtual } = await prepareUnbundledApp(nitro);
    await manager.reload(
      await loadRunner("node-worker", {
        name: "nitro-preview",
        data: { entry, virtual },
        plugins: await unbundledPlugins(nitro),
      })
    );
  } catch (error) {
    await manager.close();
    await nitro.close();
    throw error;
  }

  consola.info("Previewing server sources without a build (`builder: false`).");

  const { staticMiddleware } = await import("srvx/static");
  const publicAssets = nitro.options.publicAssets.map((asset) => ({
    base: withTrailingSlash(joinURL(nitro.options.baseURL, asset.baseURL || "/")),
    handler: staticMiddleware({ dir: asset.dir }),
  }));

  return {
    async fetch(req) {
      const url = new URL(req.url);
      for (const asset of publicAssets) {
        if (!url.pathname.startsWith(asset.base)) {
          continue;
        }
        url.pathname = url.pathname.slice(asset.base.length - 1);
        const res = await asset.handler(new Request(url, req) as any, () => undefined as any);
        if (res) {
          return res;
        }
      }
      return manager.fetch(req);
    },
    async upgrade(req, socket, head) {
      await manager.upgrade?.({ node: { req, socket: socket as Socket, head } });
    },
    async close() {
      await manager.close();
      await nitro.close();
    },
  };
}
