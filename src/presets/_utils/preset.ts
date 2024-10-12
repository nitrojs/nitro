import { fileURLToPath } from "node:url";
import type { NitroPreset, NitroPresetMeta } from "nitro/types";

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

export function getDefaultNodeVersion(
  supportedNodeVersions: Set<number>,
  nodeVersionMap: Map<number, string>
): string {
  // Get Nitro's current default Node.js version
  let version = DEFAULT_NODE_VERSION;

  // Check it is supported by the provider
  if (supportedNodeVersions.has(version) && nodeVersionMap.has(version)) {
    // If so, return the mapped version
    return nodeVersionMap.get(version)!;
  }

  // Else, return the latest supported version
  while (version > 0) {
    version--;
    if (supportedNodeVersions.has(version) && nodeVersionMap.has(version)) {
      // Found the next-highest supported version
      return nodeVersionMap.get(version)!;
    }
  }

  throw new Error("No supported Node.js version found");
}
