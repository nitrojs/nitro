import type { EnvironmentModuleNode, ViteDevServer } from "vite";
import type { VitestPluginContext } from "vitest/node";
import type { NitroPluginContext } from "./types.ts";
import { normalize } from "pathe";
import { debounce } from "perfect-debounce";
import { rescanHandlers, watchScanDirs } from "./_scan-watch.ts";

// Projects can share a Vite server (and so its plugins and module graph)
const _watchedServers = new WeakSet<ViteDevServer>();

/**
 * Reruns tests in watch mode on server changes that Vitest does not track itself (no dev server
 * reload runs in Vitest mode).
 */
export function setupVitestWatch(
  ctx: NitroPluginContext,
  { vitest, project }: VitestPluginContext
): void {
  const server = project.vite;
  if (!vitest.config.watch || _watchedServers.has(server)) {
    return;
  }
  _watchedServers.add(server);
  const nitro = ctx.nitro!;
  const nitroEnv = server.environments.nitro;
  const affectedTests = (modules: Iterable<EnvironmentModuleNode>) =>
    _affectedTests(modules, {
      testFiles: () => nitroEnv.moduleGraph.fileToModulesMap.keys(),
      isTestFile: (file) => vitest.getModuleSpecifications(file).length > 0,
      isSetupFile: (file) =>
        vitest.projects.some((p) => p.vite === server && p.config.setupFiles.includes(file)),
    });

  // Edits: Vitest walks importers up to the test files, but stops at virtual modules (no `file`),
  // which are the only importers of routes, middleware and plugins
  vitest.config.watchTriggerPatterns = [
    ...(vitest.config.watchTriggerPatterns || []),
    {
      pattern: /.*/,
      testsToRun: (file) => {
        const modules = nitroEnv.moduleGraph.getModulesByFile(file);
        const result = modules && affectedTests(modules);
        if (!result?.throughVirtual || result.tests.size === 0) {
          return;
        }
        for (const dep of result.files) {
          vitest.watcher.invalidates.add(dep);
        }
        return [...result.tests];
      },
    },
  ];

  // Added or removed handlers: rescan, then rerun the tests depending on virtual modules
  const rescan = debounce(async () => {
    await rescanHandlers(nitro, nitroEnv);
    const virtualModules = [...nitroEnv.moduleGraph.idToModuleMap.values()].filter((mod) =>
      mod.id?.startsWith("#nitro/virtual/")
    );
    let specs = [...affectedTests(virtualModules).tests].flatMap((file) =>
      vitest.getModuleSpecifications(file)
    );
    // Same filter as Vitest's own watch reruns (`filenamePattern` is internal, set from the `p` prompt)
    const filenamePattern = (vitest as { filenamePattern?: string[] }).filenamePattern;
    if (Array.isArray(filenamePattern) && filenamePattern.length > 0) {
      const selected = await vitest.globTestSpecifications(filenamePattern);
      specs = specs.filter((spec) => selected.some((s) => s.moduleId === spec.moduleId));
    }
    if (specs.length > 0) {
      await vitest.waitForTestRunEnd();
      await vitest.rerunTestSpecifications(specs);
    }
  });
  watchScanDirs(nitro, server, () => {
    rescan().catch((error) => nitro.logger.error(error));
  });

  // Nitro config: Vitest only restarts on its own config files (its `restart` reruns everything)
  const configFile = nitro.options._c12.configFile;
  if (configFile) {
    const restart = debounce(() => vitest.vite.restart());
    server.watcher.add(configFile);
    server.watcher.on("change", (file) => {
      if (normalize(file) === configFile) {
        restart().catch((error) => nitro.logger.error(error));
      }
    });
  }
}

/**
 * Walks importers (virtual ones included) up to the test files. Reaching a setup file affects
 * every test file of the environment.
 */
function _affectedTests(
  modules: Iterable<EnvironmentModuleNode>,
  opts: {
    testFiles: () => Iterable<string>;
    isTestFile: (file: string) => boolean;
    isSetupFile: (file: string) => boolean;
  }
) {
  const tests = new Set<string>();
  const files = new Set<string>();
  const seen = new Set<EnvironmentModuleNode>();
  const queue = [...modules];
  let throughVirtual = false;
  let throughSetup = false;
  for (const mod of queue) {
    if (seen.has(mod)) {
      continue;
    }
    seen.add(mod);
    if (!mod.file) {
      throughVirtual = true;
    } else if (opts.isTestFile(mod.file)) {
      tests.add(mod.file);
    } else {
      files.add(mod.file);
      throughSetup ||= opts.isSetupFile(mod.file);
    }
    queue.push(...mod.importers);
  }
  if (throughSetup) {
    for (const file of opts.testFiles()) {
      if (opts.isTestFile(file)) {
        tests.add(file);
      }
    }
  }
  return { tests, files, throughVirtual };
}
