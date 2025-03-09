import consola from "consola";
import type { NitroOptions } from "nitro/types";
import { join } from "node:path";
import { nodeMajorVersion, provider } from "std-env";
import { runtimeDir } from "nitro/runtime/meta";

export async function resolveFetchOptions(options: NitroOptions) {
  if (options.experimental.nodeFetchCompat === undefined) {
    options.experimental.nodeFetchCompat = (nodeMajorVersion || 0) < 18;
    if (options.experimental.nodeFetchCompat && provider !== "stackblitz") {
      consola.warn(
        "Node fetch compatibility is enabled. Please consider upgrading to Node.js >= 18."
      );
    }
  }
  if (!options.experimental.nodeFetchCompat) {
    options.alias = {
      "node-fetch-native/polyfill": join(runtimeDir, "internal/empty"),
      "node-fetch-native/native": "node-fetch-native/native",
      "node-fetch-native": "node-fetch-native/native",
      ...options.alias,
    };
  }
}
