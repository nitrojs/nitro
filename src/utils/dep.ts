import { consola } from "consola";
import { resolveModulePath } from "exsolve";
import { isCI, isTest } from "std-env";

export interface DepOptions {
  /** Package name to resolve and install. */
  id: string;
  /** Directory to resolve from and install into. */
  dir: string;
  /** Human readable reason, used in prompts and errors. */
  reason: string;
  /** Version range used when installing (ignored if it is not a simple range). */
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
  return (await import(resolved)) as T;
}

export function isDepInstalled(id: string, dir: string): boolean {
  return !!resolveModulePath(id, { from: [dir, import.meta.url], try: true });
}
