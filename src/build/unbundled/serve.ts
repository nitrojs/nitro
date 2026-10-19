import type { EnvRunner, ListenOptions } from "env-runner";
import type { Nitro } from "nitro/types";

import { loadRunner } from "env-runner";
import { joinURL, withTrailingSlash } from "ufo";
import { createNitro } from "../../nitro.ts";
import { scanHandlers } from "../../scan.ts";
import { globPublicAssets } from "../assets.ts";
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
    await nitro.hooks.callHook("build:before", nitro);
    await scanHandlers(nitro);
    nitro.routing.sync();
    const { entry, virtual, appEntry } = await prepareUnbundledApp(nitro);
    await nitro.hooks.callHook("compiled", nitro);
    const publicAssets = await scanPublicAssets(nitro);
    if (publicAssets.length > 0) {
      virtual[entry] = serveEntry(appEntry, publicAssets);
    }
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

interface ServedPublicAssets {
  /** Base URL (with `baseURL` and a trailing slash). */
  base: string;
  dir: string;
  /** File paths (relative to `base`, with a leading slash). */
  files: string[];
}

/** Public assets indexed once, so requests for other paths skip the file system. */
async function scanPublicAssets(nitro: Nitro): Promise<ServedPublicAssets[]> {
  if (nitro.options.noPublicDir) {
    return [];
  }
  const assets: ServedPublicAssets[] = [];
  for (const asset of nitro.options.publicAssets) {
    const files = await globPublicAssets(nitro, asset);
    if (files.length === 0) {
      continue;
    }
    assets.push({
      base: withTrailingSlash(joinURL(nitro.options.baseURL, asset.baseURL || "/")),
      dir: asset.dir,
      files: files.map((file) => `/${file}`),
    });
  }
  return assets;
}

/** Entry serving the public assets from their source directories before the app. */
function serveEntry(appEntry: string, publicAssets: ServedPublicAssets[]): string {
  return /* js */ `
import app from ${JSON.stringify(appEntry)};
import { staticMiddleware } from ${JSON.stringify(import.meta.resolve("srvx/static"))};

globalThis.__nitro_main__ = import.meta.url;

const publicAssets = ${JSON.stringify(publicAssets)}.map((asset) => ({
  base: asset.base,
  files: new Set(asset.files),
  handler: staticMiddleware({ dir: asset.dir }),
}));

// The files srvx staticMiddleware looks up for a path (also .html and index.html)
function hasFile(files, path) {
  if (path.endsWith("/")) {
    return files.has(path + "index.html");
  }
  return files.has(path) || files.has(path + ".html") || files.has(path + "/index.html");
}

function servePublicAssets(req, next) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return next();
  }
  const pathname = (req._url ??= new URL(req.url)).pathname;
  for (const asset of publicAssets) {
    if (!pathname.startsWith(asset.base)) {
      continue;
    }
    let path = pathname.slice(asset.base.length - 1);
    if (path.includes("%")) {
      try {
        path = decodeURI(path);
      } catch {
        continue;
      }
    }
    if (!hasFile(asset.files, path)) {
      continue;
    }
    let assetReq = req;
    if (asset.base !== "/") {
      const url = new URL(req.url);
      url.pathname = pathname.slice(asset.base.length - 1);
      assetReq = new Request(url, req);
    }
    return Promise.resolve(asset.handler(assetReq, () => undefined)).then((res) => res || next());
  }
  return next();
}

export default { ...app, middleware: [servePublicAssets, ...(app.middleware || [])] };
`.trimStart();
}
