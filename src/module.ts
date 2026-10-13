import type { Nitro, NitroModule, NitroModuleInput } from "nitro/types";
import { resolveModuleURL } from "exsolve";

// Modules already installed for a Nitro instance, keyed by resolved URL (string inputs)
// or by `setup` identity (inline modules) to keep `installModules` idempotent.
// (config loading clones module objects, but keeps the `setup` reference)
const installedModules = new WeakMap<Nitro, Set<unknown>>();

export async function installModules(nitro: Nitro, moduleInputs?: NitroModuleInput[]) {
  const _modules = [...(moduleInputs ?? nitro.options.modules ?? [])];
  const modules = await Promise.all(_modules.map((mod) => _resolveNitroModule(mod, nitro.options)));
  let _installed = installedModules.get(nitro);
  if (!_installed) {
    _installed = new Set();
    installedModules.set(nitro, _installed);
  }
  for (const mod of modules) {
    const key = mod._url ?? mod.setup;
    if (_installed.has(key)) {
      continue;
    }
    _installed.add(key);
    await mod.setup(nitro);
  }
}

async function _resolveNitroModule(
  mod: NitroModuleInput,
  nitroOptions: Nitro["options"]
): Promise<NitroModule & { _url?: string }> {
  let _url: string | undefined;

  if (typeof mod === "string") {
    _url = resolveModuleURL(mod, {
      from: [nitroOptions.rootDir],
      extensions: [".mjs", ".cjs", ".js", ".mts", ".cts", ".ts"],
    });
    mod = (await import(_url).then((m: any) => m.default || m)) as NitroModule;
  }

  if (typeof mod === "function") {
    mod = { setup: mod };
  }

  if ("nitro" in mod) {
    mod = mod.nitro;
  }

  if (!mod.setup) {
    throw new Error("Invalid Nitro module: missing setup() function.");
  }

  return {
    _url,
    ...mod,
  };
}
