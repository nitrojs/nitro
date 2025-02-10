import { createJiti } from "jiti";
import type { Nitro, NitroModule, NitroModuleInput } from "nitropack/types";

export async function installModules(nitro: Nitro) {
  const _modules = [...(nitro.options.modules || [])];
  const modules = await Promise.all(
    _modules.map((mod) => _resolveNitroModule(mod, nitro.options))
  );
  const _installedURLs = new Set<string>();
  for (const mod of modules) {
    if (mod._url) {
      if (_installedURLs.has(mod._url)) {
        continue;
      }
      _installedURLs.add(mod._url);
    }
    await mod.setup(nitro);
  }
}

async function _resolveNitroModule(
  mod: NitroModuleInput,
  nitroOptions: Nitro["options"]
): Promise<NitroModule & { _url?: string }> {
  let _url: string | undefined;

  if (typeof mod === "string") {
    // @ts-ignore
    globalThis.defineNitroModule =
      // @ts-ignore
      globalThis.defineNitroModule || ((mod) => mod);

    const jiti = createJiti(nitroOptions.rootDir, {
      alias: nitroOptions.alias,
    });
    const _modPath = jiti.esmResolve(mod);
    _url = _modPath;
    const _mod = await jiti.import(_modPath, { default: true });

    if (
      typeof _mod === "function" &&
      _mod.name &&
      nitroOptions.ignoreModules.includes(_mod.name)
    ) {
      return { _url, setup: () => {} };
    }

    mod = _mod as NitroModule;
  }

  if (typeof mod === "function") {
    if (mod.name && nitroOptions.ignoreModules.includes(mod.name)) {
      return { _url, setup: () => {} };
    }

    mod = { setup: mod };
  }

  if (!mod.setup) {
    // TODO: Warn?
    mod.setup = () => {};
  }

  return {
    _url,
    ...mod,
  };
}
