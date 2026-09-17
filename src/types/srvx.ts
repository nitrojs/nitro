import type { ServerOptions, ServerRequest } from "srvx";

export type { ServerRequest, ServerRequestContext, ServerRuntimeContext } from "srvx";

/**
 * Default export of a server entry (`server.ts`).
 *
 * `fetch` handles requests no route matched (return nothing to continue to the renderer).
 * Any other option is passed to the srvx server of the `node`, `bun` and `deno` presets.
 *
 * @see https://nitro.build/docs/server-entry
 */
export interface NitroServerEntry extends Omit<ServerOptions, "fetch" | "manual"> {
  fetch: (request: ServerRequest) => Response | undefined | Promise<Response | undefined>;
}
