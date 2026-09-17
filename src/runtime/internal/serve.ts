import type { ServerHandler, ServerOptions, ServerPlugin } from "srvx";
import { serverEntryOptions } from "#nitro/virtual/server-entry";
import { tracingSrvxPlugins } from "#nitro/virtual/tracing";
import { useNitroApp } from "./app.ts";
import { composeFetch } from "./app-fetch.ts";

/**
 * Resolve srvx `serve()` options for a server preset.
 *
 * Options exported from the server entry (`export default { fetch, ...options }`) are the base.
 * `NITRO_PORT`/`PORT`, `NITRO_HOST`/`HOST` and `NITRO_SSL_CERT`/`NITRO_SSL_KEY` take precedence
 * over them, and the preset's own options (`fetch` and runtime specific settings) win last.
 *
 * `useNitroApp().fetch` is pointed to the started server's middleware (see {@link appFetchPlugin}).
 */
export function resolveServeOptions(opts: ServerOptions): ServerOptions {
  const { port, hostname, tls, plugins, ...entryOptions } = serverEntryOptions;

  const env: Record<string, string | undefined> = globalThis.process?.env || {};
  const _parsedPort = Number.parseInt(env.NITRO_PORT ?? env.PORT ?? "");
  const cert = env.NITRO_SSL_CERT;
  const key = env.NITRO_SSL_KEY;
  // const socketPath = env.NITRO_UNIX_SOCKET; // TODO

  const resolved: ServerOptions = {
    ...entryOptions,
    port: Number.isNaN(_parsedPort) ? (port ?? 3000) : _parsedPort,
    hostname: env.NITRO_HOST || env.HOST || hostname,
    tls: cert && key ? { cert, key } : tls,
    ...opts,
    plugins: [...tracingSrvxPlugins, ...(plugins || []), ...(opts.plugins || []), appFetchPlugin],
  };

  for (const runtime of ["node", "bun", "deno"] as const) {
    if (entryOptions[runtime] && opts[runtime]) {
      resolved[runtime] = { ...entryOptions[runtime], ...opts[runtime] } as any;
    }
  }

  return resolved;
}

/**
 * srvx plugin for presets starting a srvx server: points `useNitroApp().fetch` to the server middleware
 * (including middleware added by plugins) around its fetch handler, so direct calls get the same
 * options without running plugins again.
 */
export const appFetchPlugin: ServerPlugin = (server) => {
  let handler: ServerHandler | undefined;
  // Bun and Deno pass `error` to the native server, the Node.js adapter registers it as middleware.
  useNitroApp().fetch = (req) => (handler ??= composeFetch(server, server.runtime !== "node"))(req);
};
