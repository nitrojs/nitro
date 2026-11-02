import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { consola } from "consola";
import { clearResolveCache, resolveModulePath } from "exsolve";
import { dirname, join, normalize } from "pathe";
import { hasTTY, isAgent, isCI, isTest } from "std-env";
import { depPackageName, resolveFromDepPath } from "./_dep-path.ts";
import { getDepMeta } from "./_deps.ts";
import type { NitroDepsOptions } from "nitro/types";
import type { DepId, DepModules } from "./_deps.ts";

/**
 * Options of a dependency to resolve and install.
 *
 * Dependencies listed in the manifest (`utils/_deps.ts`) take their defaults from it.
 */
export type DepOptions = DepBaseOptions &
  ({ id: DepId; reason?: string } | { id: string; reason: string });

interface DepBaseOptions {
  /** Package name to resolve and install. */
  id: string;
  /** Directory to resolve from and install into. */
  dir: string;
  /** Human readable reason, used in prompts and errors (required if not in the manifest). */
  reason?: string;
  /**
   * Supported version range, used when installing (ignored if it is not a simple range)
   * and checked against the version of an already installed package.
   */
  version?: string;
  /** Install as a dev dependency. (default: `true`) */
  dev?: boolean;
  /** Install without prompting, also in interactive environments (never in test mode). */
  autoInstall?: boolean;
  /**
   * Only resolve from `dir`, ignoring Nitro's own dependencies.
   *
   * Required for packages that end up as an import in the generated app bundle: those have to be
   * resolvable from the user project, not only from where Nitro itself is installed.
   */
  projectOnly?: boolean;
  /**
   * The `deps` option: explicit package paths (`paths`), used instead of resolving (and
   * installing) them from `dir`, and whether missing ones may be installed (`install`).
   */
  deps?: NitroDepsOptions;
}

/**
 * Ensure a dependency is installed, prompting to install it if missing.
 *
 * Resolves to the module path or `undefined` if it is (still) not available.
 * Concurrent calls for the same dependency share one prompt (and install).
 */
export function ensureDep(depOpts: DepOptions): Promise<string | undefined> {
  const opts = _resolveDepOptions(depOpts);
  const path = opts.deps?.paths?.[opts.id];
  const key = `${path ? `path:${path}` : opts.projectOnly ? "project" : "any"}:${opts.dir}:${opts.id}`;
  let pending = _pendingDeps.get(key);
  if (!pending) {
    pending = _ensureDep(opts).finally(() => _pendingDeps.delete(key));
    _pendingDeps.set(key, pending);
  }
  return pending;
}

/** Import a dependency, installing it on demand (typed from its `id` for manifest entries). */
export function importDep<Id extends keyof DepModules>(
  opts: DepOptions & { id: Id }
): Promise<DepModules[Id]>;
export function importDep<T>(opts: DepOptions): Promise<T>;
export async function importDep(opts: DepOptions): Promise<unknown> {
  const resolved = await ensureDep(opts);
  if (!resolved) {
    throw missingDepError(opts);
  }
  return import(pathToFileURL(resolved).href);
}

/** Error for a dependency that is (still) not installed, with the command to install it. */
export function missingDepError(depOpts: DepOptions): Error {
  const opts = _resolveDepOptions(depOpts);
  if (_isInNodeModules(opts.dir)) {
    return new Error(
      `\`${opts.id}\` cannot be resolved from \`${opts.dir}\`, which is inside \`node_modules\`. It is required for ${opts.reason}. The package that configures Nitro with this \`rootDir\` must add \`${_depSpec(opts)}\` to its own dependencies (or provide it with the \`deps.paths\` option).`
    );
  }
  const dev = opts.dev === false ? "" : "dev ";
  const ci =
    opts.deps?.install === undefined && isCI && !isTest
      ? " Dependencies are not installed on demand in CI unless the `deps.install` option is enabled."
      : "";
  return new Error(
    `\`${opts.id}\` is not installed. It is required for ${opts.reason}. Please add it to your ${dev}dependencies (e.g. \`npx nypm add ${dev ? "-D " : ""}${_depSpec(opts)}\`).${ci}`
  );
}

export function isDepInstalled(
  id: string,
  opts: Pick<DepOptions, "dir" | "projectOnly" | "deps">
): boolean {
  return !!resolveDep(id, opts);
}

/**
 * Resolve a dependency (or one of its subpaths), bypassing cached failures.
 *
 * Packages with an explicit path (`paths`) are resolved from it (throwing if they cannot be).
 *
 * Failed lookups are cached (process wide) by `exsolve`: once a dependency is found after one,
 * the cache is cleared so that every later lookup sees it (installed on demand or manually).
 */
export function resolveDep(
  id: string,
  opts: Pick<DepOptions, "dir" | "projectOnly" | "deps">
): string | undefined {
  const path = opts.deps?.paths?.[depPackageName(id)];
  if (path) {
    return resolveFromDepPath(id, { dir: opts.dir, path });
  }
  const from = opts.projectOnly ? opts.dir : [opts.dir, import.meta.url];
  const resolved = resolveModulePath(id, { from, try: true });
  if (resolved) {
    return resolved;
  }
  const uncached = resolveModulePath(id, { from, try: true, cache: false });
  if (uncached) {
    clearResolveCache();
  }
  return uncached;
}

export interface LibDep {
  /** Option the library can be provided with (e.g. `lib`). */
  option: string;
  /** Package name. */
  name: string;
  /** Import specifier, if it differs from the package name (e.g. `mysql2/promise`). */
  import?: string;
  /** Supported version range. */
  version?: string;
  /** Only required for some of the features. */
  optional?: boolean;
}

/** Options accepting a library import (`lib`, `identityLib`, ...). */
export function isLibOption(option: string): boolean {
  return option === "lib" || option.endsWith("Lib");
}

/**
 * Ensure the third-party libraries lazily imported by the configured storage drivers or
 * database connectors are installed, prompting to install the missing ones.
 *
 * Throws for a missing library when installing is disabled (`deps.install`, off in CI).
 */
export async function ensureLibDeps(
  users: Array<{ name: string; options: Record<string, any>; deps: LibDep[] }>,
  opts: { dir: string; label: string; deps?: NitroDepsOptions }
): Promise<void> {
  const required = new Map<string, { version?: string; users: Set<string> }>();
  for (const user of users) {
    for (const dep of user.deps) {
      if (dep.optional || user.options[dep.option] !== undefined) {
        continue; // Not required or explicitly provided by the user
      }
      const entry = required.get(dep.name) || { version: dep.version, users: new Set<string>() };
      entry.users.add(user.name);
      required.set(dep.name, entry);
    }
  }

  for (const [name, { version, users: names }] of required) {
    const reason = `the ${[...names].map((n) => `\`${n}\``).join(", ")} ${opts.label}${names.size > 1 ? "s" : ""}`;
    const depOpts = {
      id: name,
      version,
      dir: opts.dir,
      // Imported by name from the bundle: explicit `deps.paths` cannot provide them
      deps: { install: opts.deps?.install },
      reason,
      dev: false,
      projectOnly: true,
    };
    if (await ensureDep(depOpts)) {
      continue;
    }
    if (!isTest && !_canInstall(opts.deps?.install) && !_isInNodeModules(opts.dir)) {
      throw missingDepError(depOpts);
    }
    consola.warn(`\`${name}\` is not installed. It is required for ${reason}.`);
  }
}

type ResolvedDepOptions = DepBaseOptions & { id: string; reason: string };

/** Apply the manifest defaults (`utils/_deps.ts`) of a dependency. */
function _resolveDepOptions(opts: DepOptions): ResolvedDepOptions {
  const meta = getDepMeta(opts.id);
  const defined = Object.fromEntries(
    Object.entries(opts).filter(([, value]) => value !== undefined)
  );
  return {
    version: meta?.version,
    dev: meta?.dev,
    autoInstall: meta?.autoInstall,
    projectOnly: meta?.projectOnly,
    ...(defined as DepOptions),
    reason: opts.reason || meta?.reason || `\`${opts.id}\``,
  };
}

const _pendingDeps = new Map<string, Promise<string | undefined>>();

async function _ensureDep(opts: ResolvedDepOptions): Promise<string | undefined> {
  const resolved = resolveDep(opts.id, opts);
  if (resolved) {
    _checkVersion(opts, resolved);
    return resolved;
  }

  if (_isInNodeModules(opts.dir)) {
    return undefined; // Never install into a package managed by the package manager
  }

  let shouldInstall: boolean | undefined;
  if (isTest || !_canInstall(opts.deps?.install)) {
    shouldInstall = false;
  } else if (opts.autoInstall) {
    consola.info(`\`${opts.id}\` is required for ${opts.reason}. Installing automatically...`);
    shouldInstall = true;
  } else if (isCI || isAgent || !hasTTY) {
    const env = isCI ? "CI" : isAgent ? "agent" : "non-interactive";
    consola.info(
      `\`${opts.id}\` is required for ${opts.reason}. Installing automatically in ${env} environment...`
    );
    shouldInstall = true; // Auto install in non-interactive environments (CI, AI agents, no TTY)
  } else {
    shouldInstall = await consola.prompt(
      `\`${opts.id}\` is required for ${opts.reason}, but it is not installed. Would you like to install it?`,
      { type: "confirm", default: true, cancel: "undefined" }
    );
  }

  if (!shouldInstall) {
    return undefined;
  }

  const start = Date.now();
  consola.start(`Installing \`${opts.id}\` in \`${opts.dir}\`...`);
  const { addDependency, addDevDependency, detectPackageManager } = await import("nypm");
  // Projects without a lockfile (or `packageManager` field) use the package manager of the runtime
  const packageManager = (await detectPackageManager(opts.dir)) ? undefined : _runtimePM();
  await (opts.dev === false ? addDependency : addDevDependency)(_depSpec(opts), {
    cwd: opts.dir,
    packageManager,
    // Builds set `NODE_ENV=production`, which makes package managers skip (and prune) dev dependencies
    env: { NODE_ENV: "development" },
  });

  const installed = resolveDep(opts.id, opts);
  if (installed) {
    consola.success(`Installed \`${opts.id}\` in ${opts.dir} (${Date.now() - start}ms).`);
  } else {
    consola.warn(`Installed \`${opts.id}\` in ${opts.dir}, but it cannot be resolved from there.`);
  }
  return installed;
}

/** Whether missing dependencies may be installed (the `deps.install` option, off in CI by default). */
function _canInstall(install: boolean | undefined): boolean {
  return install ?? !isCI;
}

/** Whether a directory is inside `node_modules` (e.g. the `rootDir` of a framework built on Nitro). */
function _isInNodeModules(dir: string): boolean {
  return `${normalize(dir)}/`.includes("/node_modules/");
}

function _runtimePM(): "bun" | "deno" | "npm" {
  return process.versions.bun ? "bun" : process.versions.deno ? "deno" : "npm";
}

/** Package spec to install (with the version range if it is a simple one). */
function _depSpec(opts: ResolvedDepOptions): string {
  return opts.version && !opts.version.includes(" ") ? `${opts.id}@${opts.version}` : opts.id;
}

const _checkedVersions = new Set<string>();

/** Warn if the installed version of a dependency is outside of its supported range (checked once per entry). */
function _checkVersion(opts: ResolvedDepOptions, entry: string): void {
  const key = `${entry}@${opts.version}`;
  if (!opts.version || _checkedVersions.has(key)) {
    return;
  }
  _checkedVersions.add(key);
  const pkg = _installedPackage(opts.id, entry);
  if (!pkg?.version || _isSupportedVersion(pkg.version, opts.version)) {
    return;
  }
  // Not `opts.dir`: an explicit path (or the `vite` running `nitro/vite`) can be outside of it
  consola.warn(
    `\`${opts.id}@${pkg.version}\` is used from \`${pkg.dir}\` but ${opts.reason} requires \`${opts.version}\`. Please update it if you run into issues.`
  );
}

/** Find the package `entry` belongs to and read its version (walking up to its `package.json`). */
function _installedPackage(
  id: string,
  entry: string
): { dir: string; version?: string } | undefined {
  let dir = dirname(entry);
  for (let depth = 0; depth < 10; depth++) {
    const pkgPath = join(dir, "package.json");
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
        if (pkg.name === id) {
          return { dir, version: typeof pkg.version === "string" ? pkg.version : undefined };
        }
      } catch {
        // Ignore unreadable or invalid `package.json` files
      }
    }
    const parent = dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
}

/**
 * Check a version against caret ranges (`^8`, `^7 || ^8`, `^2.0.0-rc.1`, `^0.4.1`).
 *
 * Only the compatibility scope of the caret is checked: the major, or the minor for `0.x`
 * ranges. Prerelease versions and ranges match their own scope (`2.0.0-alpha.1` satisfies
 * `^2.0.0-rc.1`). Ranges in any other format are not checked.
 */
function _isSupportedVersion(version: string, range: string): boolean {
  const installed = _parseVersion(version);
  const ranges = range.split("||").map((r) => r.trim());
  if (!installed || !ranges.every((r) => r.startsWith("^") && _parseVersion(r.slice(1)))) {
    return true;
  }
  return ranges.some((r) => {
    const { major, minor } = _parseVersion(r.slice(1))!;
    return (
      major === installed.major && (major > 0 || minor === undefined || minor === installed.minor)
    );
  });
}

function _parseVersion(version: string): { major: number; minor?: number } | undefined {
  const match = /^(\d+)(?:\.(\d+))?(?:\.\d+)?(?:-[\w.]+)?$/.exec(version);
  if (!match) {
    return;
  }
  return { major: Number(match[1]), minor: match[2] === undefined ? undefined : Number(match[2]) };
}
