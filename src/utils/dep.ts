import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { consola } from "consola";
import { clearResolveCache, resolveModulePath } from "exsolve";
import { dirname, join } from "pathe";
import { hasTTY, isAgent, isCI, isTest } from "std-env";

export interface DepOptions {
  /** Package name to resolve and install. */
  id: string;
  /** Directory to resolve from and install into. */
  dir: string;
  /** Human readable reason, used in prompts and errors. */
  reason: string;
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
}

/**
 * Ensure a dependency is installed, prompting to install it if missing.
 *
 * Resolves to the module path or `undefined` if it is (still) not available.
 * Concurrent calls for the same dependency share one prompt (and install).
 */
export function ensureDep(opts: DepOptions): Promise<string | undefined> {
  const key = `${opts.projectOnly ? "project" : "any"}:${opts.dir}:${opts.id}`;
  let pending = _pendingDeps.get(key);
  if (!pending) {
    pending = _ensureDep(opts).finally(() => _pendingDeps.delete(key));
    _pendingDeps.set(key, pending);
  }
  return pending;
}

export async function importDep<T>(opts: DepOptions): Promise<T> {
  const resolved = await ensureDep(opts);
  if (!resolved) {
    throw missingDepError(opts);
  }
  return (await import(pathToFileURL(resolved).href)) as T;
}

/** Error for a dependency that is (still) not installed, with the command to install it. */
export function missingDepError(opts: DepOptions): Error {
  const dev = opts.dev === false ? "" : "dev ";
  return new Error(
    `\`${opts.id}\` is not installed. It is required for ${opts.reason}. Please add it to your ${dev}dependencies (e.g. \`npx nypm add ${dev ? "-D " : ""}${_depSpec(opts)}\`).`
  );
}

export function isDepInstalled(id: string, opts: Pick<DepOptions, "dir" | "projectOnly">): boolean {
  return !!resolveDep(id, opts);
}

/**
 * Resolve a dependency (or one of its subpaths), bypassing cached failures.
 *
 * Failed lookups are cached (process wide) by `exsolve`: once a dependency is found after one,
 * the cache is cleared so that every later lookup sees it (installed on demand or manually).
 */
export function resolveDep(
  id: string,
  opts: Pick<DepOptions, "dir" | "projectOnly">
): string | undefined {
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
 */
export async function ensureLibDeps(
  users: Array<{ name: string; options: Record<string, any>; deps: LibDep[] }>,
  opts: { dir: string; label: string }
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
    const resolved = await ensureDep({
      id: name,
      version,
      dir: opts.dir,
      reason,
      dev: false,
      projectOnly: true,
    });
    if (!resolved) {
      consola.warn(`\`${name}\` is not installed. It is required for ${reason}.`);
    }
  }
}

const _pendingDeps = new Map<string, Promise<string | undefined>>();

async function _ensureDep(opts: DepOptions): Promise<string | undefined> {
  const resolved = resolveDep(opts.id, opts);
  if (resolved) {
    _checkVersion(opts, resolved);
    return resolved;
  }

  let shouldInstall: boolean | undefined;
  if (isTest) {
    shouldInstall = false; // Do not install dependencies in test mode
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
  const { addDependency, addDevDependency } = await import("nypm");
  await (opts.dev === false ? addDependency : addDevDependency)(_depSpec(opts), { cwd: opts.dir });

  const installed = resolveDep(opts.id, opts);
  if (installed) {
    consola.success(`Installed \`${opts.id}\` in ${opts.dir} (${Date.now() - start}ms).`);
  } else {
    consola.warn(`Installed \`${opts.id}\` in ${opts.dir}, but it cannot be resolved from there.`);
  }
  return installed;
}

/** Package spec to install (with the version range if it is a simple one). */
function _depSpec(opts: DepOptions): string {
  return opts.version && !opts.version.includes(" ") ? `${opts.id}@${opts.version}` : opts.id;
}

const _checkedVersions = new Set<string>();

/** Warn if the installed version of a dependency is outside of its supported range (checked once per entry). */
function _checkVersion(opts: DepOptions, entry: string): void {
  const key = `${entry}@${opts.version}`;
  if (!opts.version || _checkedVersions.has(key)) {
    return;
  }
  _checkedVersions.add(key);
  const version = _installedVersion(opts.id, entry);
  if (!version || _isSupportedVersion(version, opts.version)) {
    return;
  }
  consola.warn(
    `\`${opts.id}@${version}\` is installed in \`${opts.dir}\` but ${opts.reason} requires \`${opts.version}\`. Please update it if you run into issues.`
  );
}

/** Read the version of the package `entry` belongs to (walking up to its `package.json`). */
function _installedVersion(id: string, entry: string): string | undefined {
  let dir = dirname(entry);
  for (let depth = 0; depth < 10; depth++) {
    const pkgPath = join(dir, "package.json");
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
        if (pkg.name === id) {
          return typeof pkg.version === "string" ? pkg.version : undefined;
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
