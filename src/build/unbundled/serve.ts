import type { EnvRunner, ListenOptions } from "env-runner";
import type { Nitro } from "nitro/types";

import { loadRunner } from "env-runner";
import { joinURL, withTrailingSlash } from "ufo";
import { createNitro } from "../../nitro.ts";
import { prepareUnbundledApp } from "./entry.ts";
import { unbundledPlugins } from "./plugins.ts";

const serveDotenv = { fileName: [".env.production", ".env"] };

export interface UnbundledServerOptions {
  rootDir: string;
  /** Public address the worker listens on. */
  listen?: ListenOptions;
  /** Called when the worker closes, also when it crashes. */
  onClose?: (cause?: unknown) => void;
}

export interface UnbundledServer {
  nitro: Nitro;
  runner: EnvRunner;
  /** Stop accepting connections, wait for in-flight requests, then run the `close` hooks. */
  close: () => Promise<void>;
}

/**
 * Serve the server sources in production without a build (`builder: false`).
 *
 * The Node.js worker listens on the public address itself, while the host loads and
 * transforms the modules it imports.
 */
export async function startUnbundledServer(opts: UnbundledServerOptions): Promise<UnbundledServer> {
  const nitro = await createNitro(
    { rootDir: opts.rootDir, dev: false, preset: "nitro-serve", builder: false },
    { dotenv: serveDotenv }
  );
  let runner: EnvRunner | undefined;
  let closeCause: unknown;
  try {
    const { entry, virtual, appEntry } = await prepareUnbundledApp(nitro);
    virtual[entry] = serveEntry(nitro, appEntry);
    runner = await loadRunner("node-worker", {
      name: "nitro-serve",
      data: { entry, virtual },
      plugins: await unbundledPlugins(nitro),
      listen: opts.listen,
      hooks: {
        onClose: (_runner, cause) => {
          closeCause = cause;
          opts.onClose?.(cause);
        },
      },
    });
    await runner.waitForReady();
  } catch (error) {
    await runner?.close();
    await nitro.close();
    // A worker failing to start (e.g. port taken) closes the runner with the cause
    throw closeCause ?? error;
  }
  return {
    nitro,
    runner,
    async close() {
      await (runner.shutdown?.() ?? runner.close());
      await nitro.close();
    },
  };
}

/** Entry serving the public assets from their source directories before the app. */
function serveEntry(nitro: Nitro, appEntry: string): string {
  const publicAssets = nitro.options.publicAssets.map((asset) => ({
    base: withTrailingSlash(joinURL(nitro.options.baseURL, asset.baseURL || "/")),
    dir: asset.dir,
  }));
  return /* js */ `
import app from ${JSON.stringify(appEntry)};
import { staticMiddleware } from ${JSON.stringify(import.meta.resolve("srvx/static"))};

globalThis.__nitro_main__ = import.meta.url;

const publicAssets = ${JSON.stringify(publicAssets)}.map((asset) => ({
  base: asset.base,
  handler: staticMiddleware({ dir: asset.dir }),
}));

async function servePublicAssets(req, next) {
  if (req.method === "GET" || req.method === "HEAD") {
    const url = new URL(req.url);
    for (const asset of publicAssets) {
      if (!url.pathname.startsWith(asset.base)) {
        continue;
      }
      const assetURL = new URL(url);
      assetURL.pathname = url.pathname.slice(asset.base.length - 1);
      const res = await asset.handler(new Request(assetURL, req), () => undefined);
      if (res) {
        return res;
      }
    }
  }
  return next();
}

export default { ...app, middleware: [servePublicAssets, ...(app.middleware || [])] };
`.trimStart();
}
