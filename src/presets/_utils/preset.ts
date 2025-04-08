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
