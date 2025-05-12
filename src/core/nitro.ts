import { consola } from "consola";
import { createDebugger, createHooks } from "hookable";
import { runtimeDir } from "nitropack/runtime/meta";
import type {
  LoadConfigOptions,
  Nitro,
  NitroConfig,
  NitroDynamicConfig,
} from "nitropack/types";
import { join } from "pathe";
import { createUnimport } from "unimport";
import { loadOptions } from "./config/loader";
import { updateNitroConfig } from "./config/update";
import { installModules } from "./module";
import { scanAndSyncOptions, scanHandlers } from "./scan";
import { addNitroTasksVirtualFile } from "./task";
import { createStorage } from "./utils/storage";

export async function createNitro(
  config: NitroConfig = {},
  opts: LoadConfigOptions = {}
): Promise<Nitro> {
  // Resolve options
  const options = await loadOptions(config, opts);

  // Create nitro context
  const nitro: Nitro = {
    options,
    hooks: createHooks(),
    vfs: {},
    logger: consola.withTag("nitro"),
    scannedHandlers: [],
    close: () => nitro.hooks.callHook("close"),
    storage: undefined as any,
    async updateConfig(config: NitroDynamicConfig) {
      updateNitroConfig(nitro, config);
    },
  };

  // Scan dirs and sync options
  // TODO: Make it side-effect free to allow proper watching
  await scanAndSyncOptions(nitro);

  // Storage
  nitro.storage = await createStorage(nitro);
  nitro.hooks.hook("close", async () => {
    await nitro.storage.dispose();
  });

  // Debug and timing
  if (nitro.options.debug) {
    createDebugger(nitro.hooks, { tag: "nitro" });
    nitro.options.plugins.push(join(runtimeDir, "internal/debug"));
  }
  if (nitro.options.timing) {
    nitro.options.plugins.push(join(runtimeDir, "internal/timing"));
  }

  // Logger
  if (nitro.options.logLevel !== undefined) {
    nitro.logger.level = nitro.options.logLevel;
  }

  // Hooks
  nitro.hooks.addHooks(nitro.options.hooks);

  // Tasks
  addNitroTasksVirtualFile(nitro);

  // Scan and install modules
  await installModules(nitro);

  // Auto imports
  if (nitro.options.imports) {
    // Create unimport instance
    nitro.unimport = createUnimport(nitro.options.imports);
    await nitro.unimport.init();
    // Support for importing from '#imports'
    nitro.options.virtual["#imports"] = () => nitro.unimport?.toExports() || "";
    // Backward compatibility
    nitro.options.virtual["#nitro"] = 'export * from "#imports"';
  }

  // Ensure initial handlers are populated
  await scanHandlers(nitro);

  return nitro;
}
