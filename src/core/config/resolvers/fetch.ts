import consola from "consola";
import type { NitroOptions } from "nitropack/types";
import { nodeMajorVersion, provider } from "std-env";

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
      "node-fetch-native/polyfill": "unenv/mock/empty",
      "node-fetch-native": "node-fetch-native/native",
      ...options.alias,
    };
  }
}
