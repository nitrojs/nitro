import type { Server } from "srvx";
import { tracingPlugin } from "srvx/tracing";

type Fetch = (request: Request) => Promise<Response>;

/**
 * Apply the srvx tracing plugin to the Vite dev fetch path.
 *
 * The Vite dev server dispatches requests directly instead of creating a srvx
 * `Server`, so `srvx.request` spans are otherwise missing in development.
 * `tracingPlugin` only reads `server.options`, which lets us reuse it without
 * starting a second server.
 */
export function createSrvxTracingFetch(enabled: boolean | undefined, fetch: Fetch): Fetch {
  if (!enabled) {
    return fetch;
  }
  const server = {
    options: { fetch, middleware: [] },
  } as unknown as Server;
  tracingPlugin()(server);
  return server.options.fetch as Fetch;
}
