import { fileURLToPath } from "node:url";
import type { NitroPreset, NitroPresetMeta } from "nitropack/types";

export function defineNitroPreset<
  P extends NitroPreset,
  M extends NitroPresetMeta,
>(preset: P, meta?: M): P & { _meta: NitroPresetMeta } {
  if (
    meta?.url &&
    typeof preset !== "function" &&
    preset.entry &&
    preset.entry.startsWith(".")
  ) {
    preset.entry = fileURLToPath(new URL(preset.entry, meta.url));
  }
  return { ...preset, _meta: meta } as P & { _meta: M };
}

const DEFAULT_NODE_VERSION = 20 as const;

/**
 * Builder to get the default Node.js version for a provider.
 *
 * Ideally, all presets will support Nitro's preferred `DEFAULT_NODE_VERSION`,
 * which will simply be converted to a preset-specific identifier.
 * If not, it will return the highest supported version below `DEFAULT_NODE_VERSION`.
 *
 * @param supportedNodeVersions - A set of Node.js version numbers supported by the provider.
 * @param getNodeVerisonString  - A preset-specific function to convert a Node.js version number to the runtime string. Defaults to String constructor.
 * @returns The Node.js version identifier for preset.
 */
export function getDefaultNodeVersion(
  supportedNodeVersions: Set<number>,
  getNodeVerisonString: (version: number) => string = String
): string {
  // Get Nitro's current default Node.js version
  let version = DEFAULT_NODE_VERSION;

  // Check it is supported by the provider
  if (supportedNodeVersions.has(version)) {
    // If so, return the mapped version
    return getNodeVerisonString(version);
  }

  // Else, return the latest supported version
  while (version > 10) {
    version--;
    if (supportedNodeVersions.has(version)) {
      // Found the next-highest supported version
      return getNodeVerisonString(version);
    }
  }

  throw new Error("No supported Node.js version found");
}
