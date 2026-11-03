import type { Nitro } from "nitro/types";
import type { ViteDevServer } from "vite";
import type { NitroPluginContext } from "./types.ts";
import type { FetchableDevEnvironment } from "./dev.ts";
import { readFile } from "node:fs/promises";
import { isAbsolute, join, relative } from "pathe";

const RENDERER_TEMPLATE_ID = "#nitro/virtual/renderer-template";

// Backstop for a worker that does not answer (e.g. restarting): the request is dispatched anyway.
const INVALIDATE_ACK_TIMEOUT = 5000;

/**
 * Provides the page HTML transformed by Vite, compiled into the renderer template module (see
 * `build/virtual/renderer-template.ts`).
 *
 * The HTML depends on the Vite HTML pipeline (template, client modules, plugins), so it is
 * transformed again on the first request to the renderer after any file change (and on every
 * navigation with bundled dev, whose output is updated after the change). When it changed, the
 * module (imported on each request in development) is invalidated in the worker before the
 * request is dispatched. Requests to other routes are never delayed.
 */
export function setupDevPageTemplate(
  ctx: NitroPluginContext,
  server: ViteDevServer,
  nitroEnv: FetchableDevEnvironment
): { sync: (req: Request) => Promise<void>; close: () => void } {
  const nitro = ctx.nitro!;
  const template = nitro.options.renderer?.template;

  // HTML compiled into the module
  let compiledHTML: string | undefined;

  // Any file can change the HTML (e.g. read by a `transformIndexHtml` hook): only page requests
  // pay for the transform, once per change
  let stale = true;

  const transformHTML = async (): Promise<string | undefined> => {
    if (!template) {
      return;
    }
    const html = await readFile(template, "utf8");
    try {
      return (
        (await _readBundledHTML(server, template)) ??
        (await server.transformIndexHtml(_htmlTemplateURL(template, server.config.root), html))
      );
    } catch (error) {
      nitro.logger.warn("Failed to transform HTML via Vite:", error);
      // Transformed again by the next page request
      stale = true;
      return html;
    }
  };

  nitro._pageTemplate = {
    ...nitro._pageTemplate,
    html: async () => (compiledHTML ??= await transformHTML()),
  };

  if (!template) {
    return { sync: async () => {}, close: () => {} };
  }

  server.watcher.add(template);
  server.watcher.on("all", () => {
    stale = true;
  });

  const invalidator = createModuleInvalidator(nitroEnv);

  const sync = async () => {
    const html = await transformHTML();
    if (html === compiledHTML) {
      return;
    }
    compiledHTML = html;
    // A module not loaded yet is rendered with the new HTML when imported
    const mod = nitroEnv.moduleGraph.getModuleById(RENDERER_TEMPLATE_ID);
    if (mod) {
      nitroEnv.moduleGraph.invalidateModule(mod);
      await invalidator.invalidate(RENDERER_TEMPLATE_ID);
    }
  };

  // Syncs run one at a time. Requests arriving while one runs share the next one (which reads
  // the HTML after the change), instead of queuing one each.
  let tail: Promise<void> = Promise.resolve();
  let queued: Promise<void> | undefined;
  const schedule = () => {
    stale = false;
    if (!queued) {
      queued = tail = tail
        .then(() => {
          queued = undefined;
          return sync();
        })
        .catch((error) => {
          // Retried by the next page request (meanwhile, the last compiled HTML is rendered),
          // invalidating the module again even if the HTML is the same
          stale = true;
          compiledHTML = undefined;
          nitro.logger.error("Failed to update the page template:", error);
        });
    }
    return queued;
  };

  const bundledDev = !!server.environments.client.bundledDev;
  return {
    sync: (req) => {
      const page = _pageRequest(nitro, req);
      if (!page) {
        return Promise.resolve();
      }
      if (stale || (bundledDev && page === "document")) {
        return schedule();
      }
      return tail;
    },
    close: invalidator.close,
  };
}

/**
 * Invalidates a module in the dev worker, resolving once the worker acknowledged it. Requests and
 * messages are not ordered with each other (workerd), so requests depending on the invalidation
 * wait for the acknowledgement of the worker.
 */
function createModuleInvalidator(nitroEnv: FetchableDevEnvironment) {
  const pending = new Map<string, () => void>();
  const onMessage = (message: any) => {
    if (message?.type === "custom" && message.event === "nitro:invalidated") {
      pending.get(message.data?.id)?.();
    }
  };
  nitroEnv.devServer.onMessage(onMessage);
  let counter = 0;
  return {
    invalidate: (moduleId: string) =>
      new Promise<void>((resolve) => {
        const id = String(++counter);
        const timeout = setTimeout(done, INVALIDATE_ACK_TIMEOUT);
        function done() {
          clearTimeout(timeout);
          pending.delete(id);
          resolve();
        }
        pending.set(id, done);
        nitroEnv.devServer.sendMessage({
          type: "custom",
          event: "nitro:invalidate",
          data: { id, env: nitroEnv.name, moduleId },
        });
      }),
    close: () => {
      nitroEnv.devServer.offMessage(onMessage);
      for (const done of [...pending.values()]) {
        done();
      }
    },
  };
}

/**
 * Whether a request is routed to the page renderer: `document` for navigations (and requests
 * accepting HTML), `other` for the rest (e.g. `fetch()` calls), `undefined` for other routes.
 */
function _pageRequest(nitro: Nitro, req: Request): "document" | "other" | undefined {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return;
  }
  const match = nitro.routing.routes.match("GET", new URL(req.url).pathname);
  const handler = nitro.options.renderer?.handler;
  if (![match].flat().some((h) => h?.handler === handler)) {
    return;
  }
  const dest = req.headers.get("sec-fetch-dest");
  return dest === "document" ||
    dest === "iframe" ||
    (!dest && req.headers.get("accept")?.toLowerCase().includes("text/html"))
    ? "document"
    : "other";
}

// Vite derives the HTML file path from the URL, which relative imports (e.g. in inline `<style>`) resolve against.
function _htmlTemplateURL(template: string, root: string): string {
  const path = relative(root, template);
  return path.startsWith("../") || isAbsolute(path) ? join("/@fs", template) : `/${path}`;
}

// Bundled dev only emits the template when it is a client build input (no custom client entry).
async function _readBundledHTML(
  server: ViteDevServer,
  template: string
): Promise<string | undefined> {
  const bundledDev = server.environments.client.bundledDev;
  if (!bundledDev) {
    return;
  }
  // `devEngine` is internal to Vite (no public API to wait for the latest output).
  await bundledDev["devEngine"].ensureLatestBuildOutput();
  // The output files are stored by a callback that can run after the promise resolved
  await new Promise((resolve) => setImmediate(resolve));
  const file = bundledDev.memoryFiles.get(relative(server.config.root, template));
  if (!file) {
    return;
  }
  return typeof file.source === "string" ? file.source : Buffer.from(file.source).toString("utf8");
}
