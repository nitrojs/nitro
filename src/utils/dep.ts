import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { consola } from "consola";
import { resolveModulePath } from "exsolve";
import { dirname, join } from "pathe";
import { isCI, isTest } from "std-env";

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
}

/**
 * Ensure a dependency is installed, prompting to install it if missing.
 *
 * Resolves to the module path or `undefined` if it is (still) not available.
 */
export async function ensureDep(opts: DepOptions, _retry?: boolean): Promise<string | undefined> {
  const resolved = resolveModulePath(opts.id, {
    from: [opts.dir, import.meta.url],
    cache: _retry ? false : true,
    try: true,
  });

  if (resolved) {
    _checkVersion(opts, resolved);
    return resolved;
  }

  let shouldInstall: boolean | undefined;
  if (_retry || isTest) {
    shouldInstall = false; // Do not install dependencies in test mode
  } else if (isCI) {
    consola.info(
      `\`${opts.id}\` is required for ${opts.reason}. Installing automatically in CI environment...`
    );
    shouldInstall = true; // Auto install in CI environments
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
  const spec = opts.version && !opts.version.includes(" ") ? `${opts.id}@${opts.version}` : opts.id;
  await (opts.dev === false ? addDependency : addDevDependency)(spec, { cwd: opts.dir });
  consola.success(`Installed \`${opts.id}\` in ${opts.dir} (${Date.now() - start}ms).`);

  return ensureDep(opts, true);
}

export async function importDep<T>(opts: DepOptions): Promise<T> {
  const resolved = await ensureDep(opts);
  if (!resolved) {
    throw new Error(
      `\`${opts.id}\` is not installed. Please add it to your dependencies for ${opts.reason}.`
    );
  }
  return (await import(pathToFileURL(resolved).href)) as T;
}

export function isDepInstalled(id: string, dir: string): boolean {
  return !!resolveModulePath(id, { from: [dir, import.meta.url], try: true });
}

export interface LibDep {
  /** Option the library can be provided with (e.g. `lib`). */
  option: string;
  /** Package name. */
  name: string;
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
    const resolved = await ensureDep({ id: name, version, dir: opts.dir, reason, dev: false });
    if (!resolved) {
      consola.warn(`\`${name}\` is not installed. It is required for ${reason}.`);
    }
  }
}

const _versionWarnings = new Set<string>();

/** Warn once if the installed version of a dependency is outside of its supported range. */
function _checkVersion(opts: DepOptions, entry: string): void {
  if (!opts.version || _versionWarnings.has(`${opts.id}@${opts.version}`)) {
    return;
  }
  const version = _installedVersion(opts.id, entry);
  if (!version || _isSupportedVersion(version, opts.version)) {
    return;
  }
  _versionWarnings.add(`${opts.id}@${opts.version}`);
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
 * Check a version against a simple caret range (`^8`, `^7 || ^8`).
 *
 * Ranges in any other format (and `0.x` versions, for which caret is minor scoped) are not
 * checked. Prerelease versions match their own major (`8.0.0-beta.1` satisfies `^8`).
 */
function _isSupportedVersion(version: string, range: string): boolean {
  const major = Number.parseInt(version, 10);
  if (!major) {
    return true;
  }
  const ranges = range.split("||").map((r) => r.trim());
  if (!ranges.every((r) => /^\^\d+(\.\d+)*$/.test(r))) {
    return true;
  }
  return ranges.some((r) => Number.parseInt(r.slice(1), 10) === major);
}
