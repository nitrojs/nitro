import type { NitroAppPlugin } from "nitro/types";

export function defineNitroPlugin(def: NitroAppPlugin) {
  return def;
}

export const nitroPlugin = defineNitroPlugin;
