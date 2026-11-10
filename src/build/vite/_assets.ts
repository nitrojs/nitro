// Ported from @hiogawa/vite-plugin-fullstack (MIT License, Copyright (c) 2024 Hiroshi Ogawa)

import type { ResolvedConfig, Rollup, ViteDevServer, Plugin as VitePlugin } from "vite";
import { dirname, relative } from "pathe";
import type { NitroPluginContext } from "./types.ts";
import { collectDevAssets, nitroAssetsDevPatches } from "./_assets-dev.ts";
import {
  ASSETS_EMPTY_ID,
  ASSETS_MANIFEST_FILE,
  ASSETS_MANIFEST_ID,
  ASSETS_RUNTIME_CODE,
  ASSETS_RUNTIME_ID,
  EMPTY_ASSETS,
  parseIdQuery,
} from "../_assets-import.ts";

export interface AssetsImportState {
  /** `?assets` imports of each target environment, by resolved module id. */
  imports: Record<string, Record<string, AssetsImportMeta>>;
  /** Bundles written by each environment. */
  bundles: Record<string, Rollup.OutputBundle>;
}

export interface AssetsImportMeta {
  id: string;
  key: string;
  importerEnvironments: Set<string>;
  isEntry: boolean;
}

const NON_HOOK_KEYS = new Set(["name", "enforce", "apply", "api"]);

/**
 * `?assets` imports (`vite.assetsImport` option).
 *
 * Vite resolves its plugin list before Nitro loads its config, so the plugins are always
 * registered and their hooks are skipped when the option is disabled.
 */
export function nitroAssetsImport(ctx: NitroPluginContext): VitePlugin[] {
  const enabled = () => ctx.nitro?.options.vite?.assetsImport !== false;
  const state: AssetsImportState = (ctx._assetsImport = { imports: {}, bundles: {} });
  return [assetsImportPlugin(state), ...nitroAssetsDevPatches()].map((plugin) =>
    _withCondition(plugin, enabled)
  );
}

function assetsImportPlugin(state: AssetsImportState): VitePlugin {
  let server: ViteDevServer | undefined;
  let config: ResolvedConfig;

  async function assetsCode(
    environment: { name: string; mode: string },
    id: string,
    opts: { environment: string; isEntry: boolean }
  ): Promise<string> {
    if (environment.mode === "dev") {
      return JSON.stringify(await collectDevAssets(server!, config, id, opts.environment));
    }
    const imports = (state.imports[opts.environment] ??= {});
    const key = relative(config.root, id);
    imports[id] = {
      id,
      key,
      importerEnvironments: new Set(imports[id]?.importerEnvironments).add(environment.name),
      isEntry: !!(imports[id]?.isEntry || opts.isEntry),
    };
    return `__assets_manifest[${JSON.stringify(opts.environment)}][${JSON.stringify(key)}]`;
  }

  return {
    name: "nitro:assets-import",
    sharedDuringBuild: true,
    configureServer(server_) {
      server = server_;
    },
    configResolved(config_) {
      config = config_;
    },
    configEnvironment(name) {
      // Assets imported by the server (e.g. css) are copied to the client output
      if (name === "ssr") {
        return { build: { emitAssets: true } };
      }
    },
    resolveId: {
      order: "pre",
      filter: { id: [/[?&]assets/, /^virtual:nitro-assets\//] },
      handler(source) {
        if (source === ASSETS_RUNTIME_ID) {
          return "\0" + ASSETS_RUNTIME_ID;
        }
        if (source === ASSETS_MANIFEST_ID) {
          return { id: ASSETS_MANIFEST_ID, external: true };
        }
        if (this.environment.name === "client" && parseIdQuery(source).query.assets !== undefined) {
          return ASSETS_EMPTY_ID;
        }
      },
    },
    load: {
      filter: { id: [/[?&]assets/, /^\0virtual:nitro-assets\//] },
      async handler(id) {
        if (id === ASSETS_EMPTY_ID) {
          return `export default ${JSON.stringify(EMPTY_ASSETS)}`;
        }
        if (id === "\0" + ASSETS_RUNTIME_ID) {
          return ASSETS_RUNTIME_CODE;
        }
        const { filename, query } = parseIdQuery(id);
        const value = query.assets;
        if (value === undefined) {
          return;
        }
        const codes: string[] = [];
        for (const environment of value ? [value] : ["client", this.environment.name]) {
          codes.push(
            await assetsCode(this.environment, filename, {
              environment,
              isEntry: value === "client",
            })
          );
        }
        let code = `import { mergeAssets } from ${JSON.stringify(ASSETS_RUNTIME_ID)};\nexport default mergeAssets(${codes.join(", ")});\n`;
        if (this.environment.mode === "build") {
          code = `import __assets_manifest from ${JSON.stringify(ASSETS_MANIFEST_ID)};\n${code}`;
        }
        return { code, moduleSideEffects: false };
      },
    },
    buildStart() {
      if (this.environment.mode !== "build" || this.environment.name !== "client") {
        return;
      }
      for (const meta of Object.values(state.imports.client || {})) {
        if (meta.isEntry) {
          this.emitFile({ type: "chunk", id: meta.id, preserveSignature: "exports-only" });
        }
      }
    },
    renderChunk(code, chunk) {
      if (code.includes(ASSETS_MANIFEST_ID)) {
        let path = relative(dirname(chunk.fileName), ASSETS_MANIFEST_FILE);
        path = path.startsWith(".") ? path : `./${path}`;
        return { code: code.replaceAll(ASSETS_MANIFEST_ID, () => path) };
      }
    },
    writeBundle(_options, bundle) {
      state.bundles[this.environment.name] = bundle;
    },
  };
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
