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
}
