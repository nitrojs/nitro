import { join } from "pathe";
import { runtimeDir } from "nitro/meta";
import type { NitroOptions } from "nitro/types";

export async function resolveTracingOptions(options: NitroOptions) {
  if (!options.tracingChannel) return;
  options.tracingChannel = {
    srvx: true,
    h3: true,
    unstorage: true,
    ...(typeof options.tracingChannel === "object" ? options.tracingChannel : {}),
  };
  options.plugins = options.plugins || [];
  options.plugins.push("#nitro/virtual/tracing");

  // Built-in console span logger (opt-in). Unshift so it subscribes to the
  // traced channels at startup, before any request is handled.
  if (options.experimental?.tracingLogger) {
    options.plugins.unshift(join(runtimeDir, "internal/telemetry/logger-plugin"));
    // The logger groups spans per request via the `request`/`response` runtime
    // hooks, so ensure those are wired regardless of plugin-count heuristics.
    options.features ??= {};
    options.features.runtimeHooks = true;
  }
}
