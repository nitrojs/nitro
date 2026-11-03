import type { Plugin as VitePlugin } from "vite";
import type { NitroPluginContext } from "./types.ts";
import { normalizeAliases, resolveAlias } from "pathe/utils";

/**
 * Resolves server environment ids aliased to `node:` builtins (externalized when Vite cannot
 * resolve them). `resolveAlias` re-normalizes a plain alias map on each call, so the map is
 * normalized once per bundler config instead, as this hook runs for every module id.
 */
export function nitroServerAliases(ctx: NitroPluginContext): VitePlugin {
  let source: Record<string, string> | undefined;
  let aliases: Record<string, string> = {};
  return {
    name: "nitro:server-aliases",
    enforce: "pre",
    applyToEnvironment: (env) => env.name !== "client" && env.config?.consumer !== "client",

    async resolveId(id, importer, options) {
      if (!ctx.bundlerConfig) {
        return;
      }
      if (source !== ctx.bundlerConfig.base.aliases) {
        source = ctx.bundlerConfig.base.aliases;
        aliases = normalizeAliases(source);
      }
      const resolved = resolveAlias(id, aliases);
      if (resolved !== id && resolved.startsWith("node:")) {
        return (
          (await this.resolve(resolved, importer, { ...options, skipSelf: true })) || {
            id: resolved,
            external: true,
          }
        );
      }
    },
  };
}
