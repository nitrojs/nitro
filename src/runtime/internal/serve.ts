import type { ServerOptions } from "srvx";
import { serverEntryOptions } from "#nitro/virtual/server-entry";
import { tracingSrvxPlugins } from "#nitro/virtual/tracing";

/**
 * Resolve srvx `serve()` options for a server preset.
 *
 * Options exported from the server entry (`export default { fetch, ...options }`) are the base.
 * `NITRO_PORT`/`PORT`, `NITRO_HOST`/`HOST` and `NITRO_SSL_CERT`/`NITRO_SSL_KEY` take precedence
 * over them, and the preset's own options (`fetch` and runtime specific settings) win last.
 *
 * When `NITRO_UNIX_SOCKET` (or `node.path` in the server entry) is set, the server listens on
 * that UNIX socket (or Windows named pipe) instead of a TCP port.
 */
export function resolveServeOptions(opts: ServerOptions): ServerOptions {
  const { port, hostname, tls, ...entryOptions } = serverEntryOptions;

  const env: Record<string, string | undefined> = globalThis.process?.env || {};
  const _parsedPort = Number.parseInt(env.NITRO_PORT ?? env.PORT ?? "");
  const cert = env.NITRO_SSL_CERT;
  const key = env.NITRO_SSL_KEY;
  const socketPath = env.NITRO_UNIX_SOCKET;

  const resolved: ServerOptions = {
    ...entryOptions,
    port: Number.isNaN(_parsedPort) ? (port ?? 3000) : _parsedPort,
    hostname: env.NITRO_HOST || env.HOST || hostname,
    tls: cert && key ? { cert, key } : tls,
    ...opts,
    plugins: [...tracingSrvxPlugins, ...(opts.plugins || [])],
  };

  for (const runtime of ["node", "bun", "deno"] as const) {
    if (entryOptions[runtime] && opts[runtime]) {
      resolved[runtime] = { ...entryOptions[runtime], ...opts[runtime] } as any;
    }
  }

  if (socketPath) {
    resolved.bun = { ...resolved.bun, unix: socketPath } as ServerOptions["bun"];
    resolved.deno = { ...resolved.deno, path: socketPath } as ServerOptions["deno"];
  }

  // srvx always passes `port` to `server.listen()`, which takes precedence over `path` in Node.js
  // (`undefined` and `null` bind a random port), so set it to a value that `listen()` skips.
  const nodePath = socketPath || resolved.node?.path;
  if (nodePath) {
    resolved.node = { ...resolved.node, path: nodePath, port: false as unknown as number };
  }

  return resolved;
}
