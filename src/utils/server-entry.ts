import type { Nitro } from "nitro/types";

/** Resolved path of the server entry (`server.ts`), if any. */
export function serverEntryHandler(nitro: Nitro): string | undefined {
  return (nitro.options.serverEntry && nitro.options.serverEntry.handler) || undefined;
}
