import type { NitroAppPlugin } from "nitro/types";

export function defineNitroPlugin(def: NitroAppPlugin): NitroAppPlugin {
  return def;
}

export const nitroPlugin: (def: NitroAppPlugin) => NitroAppPlugin = defineNitroPlugin;
