import { consola } from "consola";
import { Hookable, createDebugger } from "hookable";
import type {
  LoadConfigOptions,
  Nitro,
  NitroConfig,
  NitroDynamicConfig,
  NitroBuildConfig,
  NitroHooks,
  RollupConfig,
} from "nitro/types";
import { version as nitroVersion } from "#nitro/meta";
import { loadOptions } from "./config/loader.ts";
import { updateNitroConfig } from "./config/update.ts";
import { installModules } from "./module.ts";
import { scanAndSyncOptions, scanHandlers } from "./scan.ts";
import { initNitroRouting } from "./routing.ts";
import { registerNitroInstance } from "./global.ts";

export async function createNitro(
  config: NitroConfig = {},
  opts: LoadConfigOptions = {}
): Promise<Nitro> {
  // Resolve options
  const options = await loadOptions(config, opts);

  // Create nitro context
  const hooks = new Hookable<NitroHooks>();
  hooks.deprecateHooks({ "rollup:reload": { to: "build:reload" } });
  hooks.hook("build:config", callRollupBeforeHooks);
  let closePromise: Promise<void> | undefined;
  const nitro: Nitro = {
    meta: {
      version: nitroVersion,
      majorVersion: 3,
    },
    options,
    hooks,
    vfs: new Map(),
    routing: {} as any,
    logger: consola.withTag("nitro"),
    scannedHandlers: [],
    fetch: () => {
      throw new Error("no dev server attached!");
    },
    close: () => (closePromise ??= Promise.resolve(nitro.hooks.callHook("close"))),
    async updateConfig(config: NitroDynamicConfig) {
      updateNitroConfig(nitro, config);
    },
  };

  // Global setup
  registerNitroInstance(nitro);

  // Init routers
  initNitroRouting(nitro);

  // Scan dirs (plugins, tasks, modules) and sync options
  // TODO: Make it side-effect free to allow proper watching
  await scanAndSyncOptions(nitro);

  // Debug
  if (nitro.options.debug) {
    createDebugger(hooks, { tag: "nitro" });
  }

  // Logger
  if (nitro.options.logLevel !== undefined) {
    nitro.logger.level = nitro.options.logLevel;
  }

  // Hooks
  nitro.hooks.addHooks(nitro.options.hooks);

  // Scan and install modules
  await installModules(nitro);

  // Ensure initial handlers are populated
  await scanHandlers(nitro);

  // Sync routers
  nitro.routing.sync();

  return nitro;
}

let _rollupBeforeWarned = false;
let _rollupBeforeBunWarned = false;

function callRollupBeforeHooks(nitro: Nitro, config: NitroBuildConfig) {
  return nitro.hooks.callHookWith(
    async (fns, args) => {
      if (fns.length === 0) {
        return;
      }
      if (config.bun) {
        if (!_rollupBeforeBunWarned) {
          _rollupBeforeBunWarned = true;
          nitro.logger.warn(
            "The deprecated `rollup:before` hook is not called with the `bun` builder. Use `build:config` instead."
          );
        }
        return;
      }
      if (!_rollupBeforeWarned) {
        _rollupBeforeWarned = true;
        nitro.logger.warn(
          "The `rollup:before` hook is deprecated. Use `build:config` instead (the config is passed as `{ rollup }` or `{ rolldown }`)."
        );
      }
      for (const fn of fns) {
        await fn(...args);
      }
    },
    "rollup:before",
    [nitro, (config.rollup ?? config.rolldown) as RollupConfig]
  );
}
