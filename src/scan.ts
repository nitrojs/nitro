import { glob } from "tinyglobby";
import type { Nitro } from "nitro/types";
import { join, relative } from "pathe";
import { withBase, withLeadingSlash, withoutTrailingSlash } from "ufo";
import { parseScanPath } from "./utils/scan-suffix.ts";
import type { ParsedScanPath, ScanSuffixOptions } from "./utils/scan-suffix.ts";

export const GLOB_SCAN_PATTERN = "**/*.{js,mjs,cjs,ts,mts,cts,tsx,jsx}";

// Co-located tests and type declarations are never registered.
const GLOB_SCAN_IGNORE = [
  "**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,tsx,jsx}",
  "**/*.d.{ts,mts,cts}",
];

// Modules are only auto-registered from `modules/*` and `modules/*/index` (any supported
// extension) so that a module's own nested files are not registered as modules themselves.
const GLOB_MODULES_SCAN_PATTERN = [
  "*.{js,mjs,cjs,ts,mts,cts,tsx,jsx}",
  "*/index.{js,mjs,cjs,ts,mts,cts,tsx,jsx}",
];
type FileInfo = { path: string; fullPath: string };

const pluginScans = new WeakMap<Nitro, { scanned: Set<string>; added: Set<string> }>();
const taskScans = new WeakMap<
  Nitro,
  { scanned: Set<string>; added: Map<string, { handler: string; entry: boolean }> }
>();

export async function scanAndSyncOptions(nitro: Nitro) {
  await syncScannedPlugins(nitro);
  await syncScannedTasks(nitro);

  // Scan modules
  const scannedModules = await scanModules(nitro);
  nitro.options.modules = nitro.options.modules || [];
  for (const modPath of scannedModules) {
    if (!nitro.options.modules.includes(modPath)) {
      nitro.options.modules.push(modPath);
    }
  }
}

async function syncScannedPlugins(nitro: Nitro) {
  const scanned = new Set(await scanPlugins(nitro));
  let state = pluginScans.get(nitro);
  if (!state) {
    state = { scanned: new Set(), added: new Set() };
    pluginScans.set(nitro, state);
  }
  for (const plugin of state.added) {
    if (!scanned.has(plugin)) {
      state.added.delete(plugin);
      const index = nitro.options.plugins.lastIndexOf(plugin);
      if (index !== -1) {
        nitro.options.plugins.splice(index, 1);
      }
    }
  }
  const ordered = [...scanned];
  for (const [i, plugin] of ordered.entries()) {
    if (state.scanned.has(plugin) || nitro.options.plugins.includes(plugin)) {
      continue;
    }
    const isAdded = (p: string) => state.added.has(p) && nitro.options.plugins.includes(p);
    const next = ordered.slice(i + 1).find(isAdded);
    const prev = ordered.slice(0, i).reverse().find(isAdded);
    const index = next
      ? nitro.options.plugins.indexOf(next)
      : prev
        ? nitro.options.plugins.lastIndexOf(prev) + 1
        : nitro.options.plugins.length;
    nitro.options.plugins.splice(index, 0, plugin);
    state.added.add(plugin);
  }
  state.scanned = scanned;
}

async function syncScannedTasks(nitro: Nitro) {
  if (!nitro.options.experimental.tasks) {
    return;
  }
  const scannedTasks = await scanTasks(nitro);
  const scanned = new Set(scannedTasks.map((task) => task.handler));
  let state = taskScans.get(nitro);
  if (!state) {
    state = { scanned: new Set(), added: new Map() };
    taskScans.set(nitro, state);
  }
  const tasks = nitro.options.tasks;
  const removed = new Set<string>();
  for (const [name, added] of state.added) {
    if (scanned.has(added.handler)) {
      continue;
    }
    state.added.delete(name);
    removed.add(name);
    const task = Object.hasOwn(tasks, name) ? tasks[name] : undefined;
    if (task?.handler === added.handler) {
      const unchanged =
        !task.description &&
        Object.keys(task).every((key) => key === "handler" || key === "description");
      if (added.entry && unchanged) {
        delete tasks[name];
      } else {
        delete task.handler;
      }
    }
  }
  for (const { name, handler } of scannedTasks) {
    if (state.scanned.has(handler) && !removed.has(name)) {
      continue;
    }
    const task = Object.hasOwn(tasks, name) ? tasks[name] : undefined;
    if (task?.handler) {
      continue;
    }
    if (task) {
      task.handler = handler;
    } else {
      tasks[name] = { handler, description: "" };
    }
    state.added.set(name, { handler, entry: !task });
  }
  state.scanned = scanned;
}

export async function scanHandlers(nitro: Nitro) {
  await syncScannedPlugins(nitro);
  await syncScannedTasks(nitro);

  const middleware = await scanMiddleware(nitro);

  const handlers = await Promise.all([
    scanServerRoutes(nitro, nitro.options.apiDir || "api", nitro.options.apiBaseURL || "/api"),
    scanServerRoutes(nitro, nitro.options.routesDir || "routes"),
  ]).then((r) => r.flat());

  const seenHandlers = new Set<string>();
  nitro.scannedHandlers = [
    ...middleware,
    ...handlers.filter((h) => {
      const key = `${h.route}\0${h.method}\0${h.ws}\0${h.env}`;
      return seenHandlers.has(key) ? false : (seenHandlers.add(key), true);
    }),
  ];

  nitro.routing.sync();

  return handlers;
}

export async function scanMiddleware(nitro: Nitro) {
  const files = await scanFiles(nitro, "middleware");
  return files.map((file) => {
    return {
      route: "/**",
      middleware: true,
      handler: file.fullPath,
    };
  });
}

export async function scanServerRoutes(nitro: Nitro, dir: string, prefix = "/") {
  const files = await scanFiles(nitro, dir, { suffixes: { method: true, env: true } });
  return files.map((file) => {
    const paramName = (name: string) => {
      const sanitized = name.replace(/\W/g, "_");
      if (name.includes("-")) {
        nitro.logger.warn(
          `Route param \`[${name}]\` in \`${file.path}\` is available as \`params.${sanitized}\`, since param names cannot contain \`-\`. Rename it to silence this warning.`
        );
      }
      return sanitized;
    };
    let route = file.name
      .replace(/\(([^(/\\]+)\)[/\\]/g, "")
      .replace(/\[[^/\]]*]|[:*?+(){}]/g, (m) => (m[0] === "[" ? m : `\\${m}`))
      .replace(/\[\.{3}]/g, "**")
      .replace(/\[\.{3}([^\]]+)]/g, (_, p) => ":" + paramName(p) + "(.*)")
      .replace(/\[([^/\]]+)]/g, (_, p) => ":" + paramName(p));
    route = withLeadingSlash(withoutTrailingSlash(withBase(route, prefix)));
    route = route.replace(/\/index$/, "") || "/";

    return {
      handler: file.fullPath,
      lazy: true,
      middleware: false,
      route,
      method: file.method,
      ws: file.ws,
      env: file.env,
    };
  });
}

export async function scanPlugins(nitro: Nitro) {
  const files = await scanFiles(nitro, "plugins");
  return files.map((f) => f.fullPath);
}

export async function scanTasks(nitro: Nitro) {
  const files = await scanFiles(nitro, "tasks");
  return files.map((f) => {
    const name = f.path
      .replace(/\/index$/, "")
      .replace(/\.[A-Za-z]+$/, "")
      .replace(/\//g, ":");
    return { name, handler: f.fullPath };
  });
}

export async function scanModules(nitro: Nitro) {
  const files = await scanFiles(nitro, "modules", { pattern: GLOB_MODULES_SCAN_PATTERN });
  return files.map((f) => f.fullPath);
}

async function scanFiles(
  nitro: Nitro,
  name: string,
  opts: { pattern?: string | string[]; suffixes?: ScanSuffixOptions } = {}
): Promise<(FileInfo & ParsedScanPath)[]> {
  const files = await Promise.all(
    nitro.options.scanDirs.map((dir) =>
      scanDir(nitro, dir, name, opts.pattern || GLOB_SCAN_PATTERN)
    )
  ).then((r) => r.flat());
  return files.flatMap((file) => {
    const parsed = parseScanPath(nitro, { dir: name, path: file.path }, opts.suffixes);
    return parsed ? [{ ...file, ...parsed }] : [];
  });
}

async function scanDir(
  nitro: Nitro,
  dir: string,
  name: string,
  pattern: string | string[]
): Promise<FileInfo[]> {
  const patterns = (Array.isArray(pattern) ? pattern : [pattern]).map((p) => join(name, p));
  const fileNames = await glob(patterns, {
    cwd: dir,
    dot: true,
    ignore: [...GLOB_SCAN_IGNORE, ...(nitro.options.ignore || [])],
    absolute: true,
  }).catch((error) => {
    if (error?.code === "ENOTDIR") {
      nitro.logger.warn(`Ignoring \`${join(dir, name)}\`. It must be a directory.`);
      return [];
    }
    throw error;
  });
  return fileNames
    .map((fullPath) => {
      return {
        fullPath,
        path: relative(join(dir, name), fullPath),
      };
    })
    .sort((a, b) => a.path.localeCompare(b.path));
}
