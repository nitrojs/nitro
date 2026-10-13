import type { NitroPreset, NitroPresetMeta } from "nitro/types";

import { presetsDir } from "nitro/meta";
import { resolve } from "node:path";

export function defineNitroPreset<P extends NitroPreset, M extends NitroPresetMeta>(
  preset: P,
  meta?: M
): P & { _meta: NitroPresetMeta } {
  if (typeof preset !== "function" && preset.entry && preset.entry.startsWith(".")) {
    preset.entry = resolve(presetsDir, preset.entry);
  }
  return { ...preset, _meta: meta } as P & { _meta: M };
}
