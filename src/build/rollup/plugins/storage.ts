import { genImport, genSafeVariableName } from "knitwork";
import type { Nitro } from "nitro/types";
import { builtinDrivers } from "unstorage";
import { virtual } from "./virtual";

export function storage(nitro: Nitro) {
  const mounts: { path: string; driver: string; opts: object }[] = [];

  const isDevOrPrerender =
    nitro.options.dev || nitro.options.preset === "nitro-prerender";
  const storageMounts = isDevOrPrerender
    ? { ...nitro.options.storage, ...nitro.options.devStorage }
    : nitro.options.storage;

  for (const path in storageMounts) {
    const mount = storageMounts[path];
    mounts.push({
      path,
      driver:
        builtinDrivers[mount.driver as keyof typeof builtinDrivers] ||
        mount.driver,
      opts: mount,
    });
  }

  const driverImports = [...new Set(mounts.map((m) => m.driver))];

  const bundledStorageCode = `
import { prefixStorage } from 'unstorage'
import overlay from 'unstorage/drivers/overlay'
import memory from 'unstorage/drivers/memory'

const bundledStorage = ${JSON.stringify(nitro.options.bundledStorage)}
for (const base of bundledStorage) {
  storage.mount(base, overlay({
    layers: [
      memory(),
      // TODO
      // prefixStorage(storage, base),
      prefixStorage(storage, 'assets:nitro:bundled:' + base)
    ]
  }))
}`;

  return virtual(
    {
      "#nitro-internal-virtual/storage": `
import { createStorage } from 'unstorage'
import { assets } from '#nitro-internal-virtual/server-assets'

${driverImports.map((i) => genImport(i, genSafeVariableName(i))).join("\n")}

export const storage = createStorage({})

storage.mount('/assets', assets)

${mounts
  .map(
    (m) =>
      `storage.mount('${m.path}', ${genSafeVariableName(
        m.driver
      )}(${JSON.stringify(m.opts)}))`
  )
  .join("\n")}

${
  !isDevOrPrerender && nitro.options.bundledStorage.length > 0
    ? bundledStorageCode
    : ""
}
`,
    },
    nitro.vfs
  );
}
