import { consola } from "consola";
import { Hookable, createDebugger } from "hookable";
import type {
  LoadConfigOptions,
  Nitro,
  NitroConfig,
  NitroDynamicConfig,
} from "nitro/types";
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
  const nitro: Nitro = {
    options,
    hooks: new Hookable(),
    vfs: new Map(),
    routing: {} as any,
    logger: consola.withTag("nitro"),
    scannedHandlers: [],
    fetch: () => {
      throw new Error("no dev server attached!");
    },
    close: () => Promise.resolve(nitro.hooks.callHook("close")),
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
    createDebugger(nitro.hooks, { tag: "nitro" });
  }

  // Logger
  if (nitro.options.logLevel !== undefined) {
    nitro.logger.level = nitro.options.logLevel;
  }

  // Hooks
  nitro.hooks.addHooks(nitro.options.hooks);

  // Scan and install modules
  await installModules(nitro);

  // Auto imports
  if (nitro.options.imports) {
    // Create unimport instance
    const { createUnimport } = await import("unimport");
    nitro.unimport = createUnimport(nitro.options.imports);
    await nitro.unimport.init();
    // Support for importing from '#imports'
    nitro.options.virtual["#imports"] = () => nitro.unimport?.toExports() || "";
    // Backward compatibility
    nitro.options.virtual["#nitro"] = 'export * from "#imports"';
  }

  // Ensure initial handlers are populated
  await scanHandlers(nitro);

  // Sync routers
  nitro.routing.sync();

  return nitro;
}
