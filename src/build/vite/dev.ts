import type { NitroPluginContext } from "./types.ts";
import type { DevEnvironment, DevEnvironmentContext, ResolvedConfig, ViteDevServer } from "vite";
import type { FetchFunctionOptions, FetchResult } from "vite/module-runner";
import type { RunnerRPCHooks, UpgradeContext } from "env-runner";
import type { Socket } from "node:net";

import { IncomingMessage, ServerResponse } from "node:http";
import type { Http2ServerResponse } from "node:http2";
import { readFile } from "node:fs/promises";
import { statSync } from "node:fs";
import { NodeRequest, sendNodeResponse } from "srvx/node";
import { createViteHotChannel } from "env-runner/vite";
import { isAbsolute, join, relative } from "pathe";
import { debounce } from "perfect-debounce";
import { withBase, withoutBase } from "ufo";
import { handleDevRPC } from "../../dev/_rpc.ts";
import { writeDevBuildInfo } from "../info.ts";
import { rescanHandlers, watchScanDirs } from "./_scan-watch.ts";
import {
  isDocumentRequest,
  isRecoverableDevErrorPage,
  withDevErrorRecovery,
} from "./_dev-error-page.ts";
import { importVite, _resolveFromPath, type ViteImportOptions } from "./_import.ts";
import { _isWorkerdRunner } from "./env.ts";

// https://vite.dev/guide/api-environment-runtimes.html#modulerunner

// Extensions that strongly indicate a browser asset load (script/style/font/image/media).
// Used as a fallback signal when `Sec-Fetch-Dest` is absent (plain-HTTP non-loopback origins).
// Kept narrow on purpose so that arbitrary dotted Nitro route params (e.g. `.../foo.bar.1`) keep reaching Nitro.
const ASSET_EXT_RE =
  /^(?:[jt]sx?|mjs|cjs|css|s[ac]ss|less|styl|vue|svelte|astro|mdx?|map|wasm|png|jpe?g|gif|svg|webp|avif|ico|bmp|woff2?|ttf|otf|eot|mp[34]|webm|wav|ogg|m4a)$/i;

// workerd built-in module namespaces (`cloudflare:workers`, `cloudflare:sockets`, `workerd:...`).
// These are provided natively by the runtime and have no host-side representation, so they must be
// externalized for the in-worker module runner to `import()` them directly instead of being fetched
// and transformed by Vite (which would fail with ERR_MODULE_NOT_FOUND).
const WORKERD_BUILTIN_RE = /^(?:cloudflare|workerd):/;

// ---- Types ----

export type FetchHandler = (req: Request) => Promise<Response>;

type NitroDevRequest = IncomingMessage & {
  _nitroHandled?: boolean;
  _nitroAssetCheck?: boolean;
  _nitroDevRoute?: boolean;
};

export interface DevServer extends RunnerRPCHooks {
  fetch: FetchHandler;
  upgrade?: (context: UpgradeContext) => void;
  init?: () => void | Promise<void>;
  close?: () => void | Promise<void>;
}

// ---- Fetchable Dev Environment ----

export async function createFetchableDevEnvironment(
  name: string,
  config: ResolvedConfig,
  devServer: DevServer,
  entry: string,
  opts?: { workerd?: boolean; vite?: ViteImportOptions; onInit?: () => void }
): Promise<FetchableDevEnvironment> {
  const transport = createViteHotChannel(devServer, name);
  const context: DevEnvironmentContext = { hot: true, transport };
  const FetchableDevEnvironment = await getFetchableDevEnvironment(
    opts?.vite || { dir: config.root }
  );
  return new FetchableDevEnvironment(name, config, context, devServer, entry, opts);
}

export interface FetchableDevEnvironment extends DevEnvironment {
  devServer: DevServer;
  dispatchFetch(request: Request): Promise<Response>;
}

interface FetchableDevEnvironmentConstructor {
  new (
    name: string,
    config: ResolvedConfig,
    context: DevEnvironmentContext,
    devServer: DevServer,
    entry: string,
    opts?: { workerd?: boolean; onInit?: () => void }
  ): FetchableDevEnvironment;
}

const _envClasses = new Map<string, Promise<FetchableDevEnvironmentConstructor>>();

/**
 * `DevEnvironment` is a value import from the (optional) `vite` dependency, so the subclass is
 * defined lazily against the `vite` instance resolved from the user project.
 */
function getFetchableDevEnvironment(
  opts: ViteImportOptions
): Promise<FetchableDevEnvironmentConstructor> {
  const key = opts.path ? _resolveFromPath("vite", opts) : opts.dir;
  let envClass = _envClasses.get(key);
  if (!envClass) {
    envClass = importVite(opts).then((vite) => _defineFetchableDevEnvironment(vite));
    envClass.catch(() => _envClasses.delete(key));
    _envClasses.set(key, envClass);
  }
  return envClass;
}

function _defineFetchableDevEnvironment({
  DevEnvironment,
}: typeof import("vite")): FetchableDevEnvironmentConstructor {
  return class FetchableDevEnvironment extends DevEnvironment {
    devServer: DevServer;

    #entry: string;
    #workerd: boolean;
    #onInit?: () => void;

    constructor(
      name: string,
      config: ResolvedConfig,
      context: DevEnvironmentContext,
      devServer: DevServer,
      entry: string,
      opts?: { workerd?: boolean; onInit?: () => void }
    ) {
      super(name, config, context);
      this.devServer = devServer;
      this.#entry = entry;
      this.#workerd = opts?.workerd ?? false;
      this.#onInit = opts?.onInit;
    }

    override async fetchModule(
      id: string,
      importer?: string,
      options?: FetchFunctionOptions
    ): Promise<FetchResult> {
      if (this.#workerd && WORKERD_BUILTIN_RE.test(id)) {
        return { externalize: id, type: "builtin" };
      }
      return super.fetchModule(id, importer, options);
    }

    async dispatchFetch(request: Request): Promise<Response> {
      return this.devServer.fetch(request);
    }

    override async init(...args: any[]): Promise<void> {
      await this.devServer.init?.();
      await super.init(...args);
      // Announced (and registered for the runner's replay) only once initialized: the dev worker
      // invokes the environment as soon as it hears about it (#4638).
      this.#onInit?.();
      this.devServer.sendMessage({
        type: "custom",
        event: "nitro:vite-env",
        data: { name: this.name, entry: this.#entry },
      });
    }

    override async close(): Promise<void> {
      await super.close();
      await this.devServer.close?.();
    }
  };
}

// ---- Vite Dev Server Integration ----

export async function configureViteDevServer(ctx: NitroPluginContext, server: ViteDevServer) {
  const nitro = ctx.nitro!;
  const nitroEnv = server.environments.nitro as FetchableDevEnvironment;

  const viteBase = server.config.base || "/";
  const hmrEnabled = server.config.server.ws !== false && server.config.server.hmr !== false;

  // Restart with nitro.config changes
  const nitroConfigFile = nitro.options._c12.configFile;
  if (nitroConfigFile) {
    server.config.configFileDependencies.push(nitroConfigFile);
  }

  // Websocket (`httpServer` is null in middleware mode, the parent server handles upgrades)
  // In workerd, routes can accept upgrades without crossws (e.g. with a Durable Object)
  const websocket =
    (nitro.options.features.websocket ?? nitro.options.experimental.websocket) ||
    _isWorkerdRunner(ctx);
  const wsProxy = Object.values(nitro.options.devProxy).some(
    (opts) => typeof opts === "object" && opts.ws
  );
  if (websocket || wsProxy) {
    const viteHmrBase = _getViteHmrBase(server);
    server.httpServer?.on("upgrade", (req, socket, head) => {
      // Vite HMR WebSocket connection. Other `vite-*` upgrades (e.g. the HMR socket of a proxied
      // upstream Vite on another path) are never claimed by Vite and must reach Nitro.
      if (viteHmrBase && _isViteHmrUpgrade(req, viteHmrBase)) {
        return;
      }
      if (ctx.devApp?.proxyUpgrade(req, socket as Socket, head)) {
        return;
      }
      if (websocket) {
        nitroEnv.devServer.upgrade?.({ node: { req, socket, head } });
      }
    });
  }

  // Rebuild on scan dir changes
  const reload = debounce(async () => {
    await rescanHandlers(nitro, nitroEnv);
    nitroEnv.hot.send({ type: "full-reload" });
  });
  watchScanDirs(nitro, server, () => reload());

  // Vite only installs a `SIGTERM` handler, so Ctrl+C (`SIGINT`) tears the process down before
  // any `close` hook runs and leaves the dev worker (and its resources) behind (#4586). In
  // middleware mode the embedding server owns the process signals, so it is left alone.
  if (!server.config.server.middlewareMode) {
    const onSigint = async () => {
      try {
        await server.close();
      } finally {
        process.exit(130);
      }
    };
    process.once("SIGINT", onSigint);
    nitro.hooks.hook("close", () => {
      process.off("SIGINT", onSigint);
    });
  }

  // Point CLI commands (`nitro fetch`) to this dev server
  server.httpServer?.once("listening", () => {
    const url = _getListenURL(server);
    if (url) {
      writeDevBuildInfo(nitro, { url }).catch((error) => {
        nitro.logger.warn(
          `Failed to write dev build info: ${error instanceof Error ? error.message : String(error)}`
        );
      });
    }
  });

  // Worker => Host RPC
  nitroEnv.devServer.onMessage((message) =>
    handleDevRPC(message, {
      sendMessage: (message) => nitroEnv.devServer.sendMessage(message),
      handlers: {
        transformHTML: async (html: string) => {
          const template = nitro.options.renderer?.template;
          html =
            (await _readBundledHTML(server, template)) ??
            (await server.transformIndexHtml(_htmlTemplateURL(template, server.config.root), html));
          return html.replace(
            "<!--ssr-outlet-->",
            `{{{ globalThis.__nitro_vite_envs__?.["ssr"]?.fetch($REQUEST) || "" }}}`
          );
        },
        rendererTemplate: () => readFile(nitro.options.renderer!.template!, "utf8"),
      },
    })
  );

  const nitroDevMiddleware = async (
    nodeReq: NitroDevRequest,
    nodeRes: ServerResponse,
    next: (error?: unknown) => void
  ) => {
    // Skip for vite internal requests or if already handled
    if (
      !nodeReq.url ||
      /^\/@(?:vite|fs|id)\//.test(withoutBase(nodeReq.url, viteBase)) ||
      nodeReq._nitroHandled ||
      server.middlewares.stack.some((mw) => matchesMiddlewareRoute(mw.route, nodeReq.url!))
    ) {
      return next();
    }
    nodeReq._nitroHandled = true;

    const baseURL = nitro.options.baseURL || "/";
    const originalURL = nodeReq.url;
    if (baseURL !== "/") {
      nodeReq.url = withBase(nodeReq.url, baseURL);
    }
    try {
      // Create web API compat request
      const req = new NodeRequest({ req: nodeReq, res: nodeRes });

      // Try dev app
      const devAppRes = await ctx.devApp!.fetch(req);
      if (nodeRes.writableEnded || nodeRes.headersSent) {
        return;
      }
      if (devAppRes.status !== 404 || nodeReq._nitroDevRoute) {
        return await sendNodeResponse(nodeRes, devAppRes);
      }

      // Dispatch the request to the nitro environment
      const envRes = await nitroEnv.dispatchFetch(req);
      if (nodeRes.writableEnded || nodeRes.headersSent) {
        return;
      }
      // An asset-tagged request Vite already declined that only an opaque catch-all could
      // handle: a 2xx `text/html` page means the catch-all swallowed a missing asset (#4234) —
      // fall through to the 404 instead. Anything else passes through untouched: JSON is how
      // opaque frameworks deliberately answer API routes tagged as asset loads and sourcemaps
      // (#4252, TanStack/router#7403), and `text/plain` is the bridge default for bare string
      // returns.
      if (
        nodeReq._nitroAssetCheck &&
        envRes.ok &&
        /^text\/html\b/i.test(envRes.headers.get("content-type") || "")
      ) {
        await envRes.body?.cancel();
        return next();
      }
      if (hmrEnabled && isRecoverableDevErrorPage(nodeReq.method, envRes)) {
        // Set for the page's own polling fetches too, so a still broken page is notified again.
        ctx._devErrorPageServed = true;
        if (isDocumentRequest(nodeReq.headers)) {
          return await sendNodeResponse(nodeRes, withDevErrorRecovery(envRes, viteBase));
        }
      }
      return await sendNodeResponse(nodeRes, envRes);
    } catch (error) {
      if (_isResponseDestroyed(nodeRes)) return;
      return next(error);
    } finally {
      if (baseURL !== "/") {
        nodeReq.url = originalURL;
      }
    }
  };

  const isCatchAllRoute = (route: string) =>
    route === "/**" || route.startsWith("/**:") || /^\/:\w+\(\.\*\)$/.test(route);

  // Only a scanned user route file catch-all is transparent; the SSR renderer, a custom server
  // entry and `routes:`/`handlers:` registrations are opaque (see .agents/vite-dev.md §2).
  const isOpaqueHandler = (h?: { handler?: string }) =>
    !!h?.handler && !nitro.scannedHandlers.some((s) => s.handler === h.handler);

  // Handle server routes first to avoid conflicts with static assets served by Vite from the root
  // https://github.com/vitejs/vite/pull/20866
  const nitroDevMiddlewarePre = (
    req: NitroDevRequest,
    res: ServerResponse,
    next: (error?: unknown) => void
  ) => {
    // Vite-internal prefixes (/@vite/client, /__vue-router/auto-routes, ...) are never Nitro's.
    if (/^\/(?:__|@)/.test(withoutBase(req.url!, viteBase))) {
      return next();
    }

    // `nitro.routing.routes` always includes the SSR catch-all `/**` in SSR apps, so an explicit
    // user route must be told apart from the catch-all. A root-level user catch-all
    // (`routes/[...].ts` -> `/**`, `routes/[...slug].ts` -> `/:slug(.*)`) is as authoritative as the
    // SSR `/**` and must not swallow Vite asset serves either, so both forms count as catch-all;
    // prefixed splat routes (`/api/photos/**`) are deterministic user routes and stay explicit.
    const pathname = new URL(withBase(req.url!, nitro.options.baseURL), "http://localhost")
      .pathname;
    let match = nitro.routing.routes.match(req.method || "", pathname);
    // Mirrors the runtime: `HEAD` is served by the `GET` route unless a `HEAD` route matches
    if (req.method === "HEAD" && !(match && !Array.isArray(match) && match.method)) {
      match = nitro.routing.routes.match("GET", pathname);
    }
    const matchedHandlers = match ? (Array.isArray(match) ? match : [match]) : [];
    const isExplicitRoute = matchedHandlers.some((h) => h?.route && !isCatchAllRoute(h.route));

    // Explicit dev app routes (dev handlers, dev proxies and public asset dirs without
    // fallthrough) are explicit too; their response (even a 404) is final, since falling through
    // to the Nitro env would let the SSR catch-all answer an asset load (#4234).
    if (!isExplicitRoute && ctx.devApp!.hasRoute(req.method || "", pathname)) {
      req._nitroDevRoute = true;
      return nitroDevMiddleware(req, res, next);
    }

    // An explicit user route is a deterministic match and always wins, regardless of how the
    // browser tags the request (#4108, #4241, #4252, #4270) — no heuristic may override it.
    if (isExplicitRoute) {
      return nitroDevMiddleware(req, res, next);
    }

    // Otherwise the request is unmatched or matched only by the SSR catch-all `/**` — genuinely
    // ambiguous between a page navigation (-> Nitro) and an asset load (-> Vite). A wrong guess
    // here only affects the catch-all fallback, never an explicit route.
    res.setHeader("vary", "sec-fetch-dest, accept");
    const fetchDest = req.headers["sec-fetch-dest"];
    const ext = req.url!.split(/[?#]/, 1)[0].match(/\.([a-z0-9]+)$/i)?.[1];

    // A known asset extension without `text/html` in `Accept` — the fallback signal when
    // `Sec-Fetch-Dest` is unavailable. The header is absent on plain-HTTP non-loopback origins
    // (e.g. http://10.0.0.x, #4234), and `empty` (fetch/XHR) is ambiguous: it tags both API
    // calls and `fetch()`ed assets, so it falls back to the extension like a missing header.
    const isAssetByExt =
      !!ext && ASSET_EXT_RE.test(ext) && !/\btext\/html\b/.test(req.headers["accept"] || "");

    // `?url` imports compile to a bare root-relative path (`/src/foo.txt`) that carries no
    // request-time marker: `fetch()` sends no usable `Sec-Fetch-Dest` and the extension can be
    // anything, so the only disambiguation left is that Vite's `serveStaticMiddleware` can
    // serve it as a real file under the project root. Mirrors its skip rules (`.html` files
    // are left for Nitro) — #4230.
    const isAssetByFile = () => {
      const urlPath = req.url!.split(/[?#]/, 1)[0];
      // Vite only serves root files under its base; outside it, the probe would only leak existence.
      if (
        !ext ||
        ext === "html" ||
        /\btext\/html\b/.test(req.headers["accept"] || "") ||
        !urlPath.startsWith(viteBase)
      ) {
        return false;
      }
      let filePath = withoutBase(urlPath, viteBase);
      try {
        filePath = decodeURI(filePath);
      } catch {}
      // Never probe outside the root (`/%2e%2e/...`), or the response would leak file existence.
      const file = join(server.config.root, filePath);
      const rel = relative(server.config.root, file);
      if (rel.startsWith("../") || isAbsolute(rel)) {
        return false;
      }
      // `throwIfNoEntry` only covers a missing entry; a stat error (permissions, symlink
      // loop) on a crafted path must not take the request down — it is simply not an asset.
      try {
        return statSync(file, { throwIfNoEntry: false })?.isFile() === true;
      } catch {
        return false;
      }
    };

    // `document`/`iframe`/`frame` are definite navigations; any other concrete `Sec-Fetch-Dest`
    // (`image`, `video`, `style`, ...) is a definite asset load. Only `GET`/`HEAD` can be
    // browser asset loads at all — other methods are never assets.
    const isAsset =
      (!req.method || req.method === "GET" || req.method === "HEAD") &&
      (typeof fetchDest === "string" && fetchDest !== "empty"
        ? !/^(?:document|iframe|frame)$/.test(fetchDest)
        : // Vite tags module-graph fetches for files it serves as modules (e.g. an imported
          // `.json`) with an `?import` query. Only the module graph emits it — a page navigation
          // never does — so it stays authoritative for extensions left out of `ASSET_EXT_RE` (#4433).
          /[?&]import(?:[&=]|$)/.test(req.url!) || isAssetByExt || isAssetByFile());

    // Non-asset requests go to Nitro: the catch-all (`matchedHandlers` are all catch-all here,
    // since explicit routes already returned) renders them, and bare (extensionless) unmatched
    // URLs default to Nitro as page navigations.
    if (!isAsset && (matchedHandlers.length > 0 || !ext)) {
      return nitroDevMiddleware(req, res, next);
    }

    if (isAsset) {
      // Opaque catch-alls (the SSR renderer, a custom server entry, config-registered `/**`)
      // route requests Nitro cannot see in `nitro.routing.routes` (#4252, #4531), so an
      // asset-tagged miss from Vite must still be dispatched — the response content-type then
      // decides (`_nitroAssetCheck`).
      // A user-file root catch-all is transparent: Nitro sees everything it can handle, so
      // Vite stays the definitive asset handler and a Vite miss must not fall back into it.
      if (matchedHandlers.every(isOpaqueHandler)) {
        req._nitroAssetCheck = true;
      } else {
        req._nitroHandled = true;
      }
    }
    next();
  };
  server.middlewares.use(nitroDevMiddlewarePre);

  return () => {
    server.middlewares.use(nitroDevMiddleware);
  };
}

/**
 * Whether a connect middleware mounted on `route` handles `url` (same matching as connect).
 */
export function matchesMiddlewareRoute(route: string | undefined, url: string): boolean {
  route = route?.replace(/\/$/, "").toLowerCase();
  if (!route) {
    return false;
  }
  const path = url.replace(/[?#].*$/, "").toLowerCase();
  if (!path.startsWith(route)) {
    return false;
  }
  const boundary = path[route.length];
  return !boundary || boundary === "/" || boundary === ".";
}

// Vite derives the HTML file path from the URL, which relative imports (e.g. in inline `<style>`) resolve against.
function _htmlTemplateURL(template: string | undefined, root: string): string {
  if (!template) {
    return "/index.html";
  }
  const path = relative(root, template);
  return path.startsWith("../") || isAbsolute(path) ? join("/@fs", template) : `/${path}`;
}

// Bundled dev only emits the template when it is a client build input (no custom client entry).
async function _readBundledHTML(
  server: ViteDevServer,
  template: string | undefined
): Promise<string | undefined> {
  const bundledDev = server.environments.client.bundledDev;
  if (!bundledDev) {
    return;
  }
  // `devEngine` is internal to Vite (no public API to wait for the latest output).
  await bundledDev["devEngine"].ensureLatestBuildOutput();
  const file = bundledDev.memoryFiles.get(
    relative(server.config.root, template || join(server.config.root, "index.html"))
  );
  if (!file) {
    return;
  }
  return typeof file.source === "string" ? file.source : Buffer.from(file.source).toString("utf8");
}

// `Http2ServerResponse` (Vite with `server.https`) has no `destroyed`; its stream does.
function _isResponseDestroyed(res: ServerResponse | Http2ServerResponse): boolean {
  return "stream" in res ? res.stream.destroyed : res.destroyed;
}

// Path on which Vite's own WebSocket server claims upgrades on `server.httpServer`, if it listens
// there at all (mirrors `createWebSocketServer`: Vite 8.3 reads `server.ws`, older 8.x `server.hmr`).
function _getViteHmrBase(server: ViteDevServer): string | undefined {
  const { ws, hmr, port } = server.config.server;
  if (ws === false) {
    return;
  }
  const opts = (typeof ws === "object" ? ws : typeof hmr === "object" ? hmr : undefined) as
    | { server?: unknown; port?: number; path?: string }
    | undefined;
  const wsServer = opts?.server || ((!opts?.port || opts.port === port) && server.httpServer);
  if (!wsServer || wsServer !== server.httpServer) {
    return;
  }
  return opts?.path ? join(server.config.base, opts.path) : server.config.base;
}

function _getListenURL(server: ViteDevServer): string | undefined {
  const addr = server.httpServer?.address();
  if (!addr || typeof addr === "string") {
    return;
  }
  const host = addr.address.includes(":") ? `[${addr.address}]` : addr.address;
  return `${server.config.server.https ? "https" : "http"}://${host}:${addr.port}/`;
}

function _isViteHmrUpgrade(req: IncomingMessage, hmrBase: string): boolean {
  const protocol = req.headers["sec-websocket-protocol"];
  return (
    (protocol === "vite-hmr" || protocol === "vite-ping") &&
    new URL(`http://localhost${req.url}`).pathname === hmrBase
  );
}
