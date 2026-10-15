import type { NitroConfig, NitroOptions } from "nitro/types";

export async function resolveServerTimingOptions(options: NitroOptions) {
  // Enabled by default in development only; production builds opt in.
  const input = (options.serverTiming as NitroConfig["serverTiming"]) ?? options.dev;
  if (input === false || options.preset === "nitro-prerender") {
    options.serverTiming = false;
    return;
  }
  const resolved = {
    total: true,
    kv: true,
    db: true,
    cache: true,
    ...(typeof input === "object" ? input : {}),
  };
  if (!options.experimental.database) {
    resolved.db = false;
  }
  options.serverTiming =
    resolved.total || resolved.kv || resolved.db || resolved.cache ? resolved : false;
}
