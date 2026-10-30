import type { NitroBuildPlugin, NitroConfig } from "nitro/types";
import { hookVirtualPlugin, wrapNitroPlugin, type BuildOverrides } from "./_plugins.ts";

export function fixtureHooks(
  state: { counts: Record<string, number>; hookOrder: string[] },
  options: BuildOverrides
): NitroConfig["hooks"] {
  const record = (name: string) => {
    state.counts[name]++;
    state.hookOrder.push(name);
  };
  return {
    "build:before": () => {
      record("before");
    },
    "build:config": (_nitro, context) => {
      record("config");
      const config = context.rollup || context.rolldown;
      if (!config) throw new Error("Missing primary bundler configuration");
      config.plugins = [...((config.plugins as NitroBuildPlugin[]) || []), hookVirtualPlugin()];
      if (options.wrapNitroPlugin)
        config.plugins = wrapNitroPlugin(config.plugins) as typeof config.plugins;
      if (options.hookDefine && context.rolldown) {
        context.rolldown.transform = {
          ...context.rolldown.transform,
          define: {
            ...context.rolldown.transform?.define,
            __TASK_CLI_HOOK_DEFINE__: JSON.stringify("hook define"),
          },
        };
      }
    },
    compiled: () => {
      record("compiled");
    },
    close: () => {
      record("close");
    },
  };
}
