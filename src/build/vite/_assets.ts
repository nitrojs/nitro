import type { Plugin as VitePlugin } from "vite";
import assetsPlugin from "@hiogawa/vite-plugin-fullstack/assets";
import type { NitroPluginContext } from "./types.ts";

const NON_HOOK_KEYS = new Set(["name", "enforce", "apply", "api"]);

/**
 * `?assets` imports (`vite.assetsImport` option).
 *
 * Vite resolves its plugin list before Nitro loads its config, so the plugins are always
 * registered and their hooks are skipped when the option is disabled.
 */
export function nitroAssetsImport(ctx: NitroPluginContext): VitePlugin[] {
  const enabled = () => ctx.nitro?.options.vite?.assetsImport !== false;
  const plugins = assetsPlugin({
    experimental: {
      // See https://github.com/hi-ogawa/vite-plugins/pull/1289
      clientBuildFallback: false,
    },
  });
  return plugins.map((plugin) => _withCondition(plugin, enabled));
}

function _withCondition(plugin: VitePlugin, enabled: () => boolean): VitePlugin {
  const wrapped: VitePlugin = { ...plugin };
  for (const [key, hook] of Object.entries(plugin) as [keyof VitePlugin, any][]) {
    if (NON_HOOK_KEYS.has(key)) {
      continue;
    }
    if (typeof hook === "function") {
      (wrapped as any)[key] = function (this: unknown, ...args: unknown[]) {
        return enabled() ? hook.apply(this, args) : undefined;
      };
    } else if (typeof hook?.handler === "function") {
      const handler = hook.handler;
      (wrapped as any)[key] = {
        ...hook,
        handler(this: unknown, ...args: unknown[]) {
          return enabled() ? handler.apply(this, args) : undefined;
        },
      };
    }
  }
  return wrapped;
}
