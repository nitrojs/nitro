import type { NitroOptions } from "nitro/types";

export async function resolveTracingOptions(options: NitroOptions) {
  if (!options.tracing) return;
  options.tracing = {
    srvx: true,
    h3: true,
    ...(typeof options.tracing === "object" ? options.tracing : {}),
  };
  options.plugins = options.plugins || [];
  options.plugins.push("#nitro/virtual/tracing");
}
