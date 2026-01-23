import { consola } from "consola";
import { resolveModulePath } from "exsolve";
import { isCI, isTest } from "std-env";

export async function importDep<T>(
  opts: {
    id: string;
    dir: string;
    reason: string;
  },
  _retry?: boolean
): Promise<T> {
  const resolved = resolveModulePath(opts.id, {
    from: [opts.dir, import.meta.url],
    cache: _retry ? false : true,
    try: true,
  });

  if (resolved) {
    return (await import(resolved)) as Promise<T>;
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
    throw new Error(
      `\`${opts.id}\` is not installed. Please add it to your dependencies for ${opts.reason}.`
    );
  }

  const start = Date.now();
  consola.start(`Installing \`${opts.id}\` in \`${opts.dir}\`...`);
  const { addDevDependency } = await import("nypm");
  await addDevDependency(opts.id, { cwd: opts.dir });
  consola.success(`Installed \`${opts.id}\` in ${opts.dir} (${Date.now() - start}ms).`);

  return importDep<T>(opts, true);
}
