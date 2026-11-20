import type { NitroConfig, NitroOptions, ServerTimingOptions } from "nitro/types";

export async function resolveServerTimingOptions(options: NitroOptions) {
  // Enabled by default in development only; production builds opt in.
  const input = (options.serverTiming as NitroConfig["serverTiming"]) ?? options.dev;
  if (input === false || options.preset === "nitro-prerender") {
    options.serverTiming = false;
    return;
  }
  // `true` enables every metric, an object only the ones it sets to `true`.
  const enabled = (metric: keyof ServerTimingOptions) =>
    typeof input === "object" ? input[metric] === true : true;
  const resolved = {
    total: enabled("total"),
    kv: enabled("kv"),
    db: enabled("db") && !!options.experimental.database,
    cache: enabled("cache"),
  };
  options.serverTiming =
    resolved.total || resolved.kv || resolved.db || resolved.cache ? resolved : false;
}
