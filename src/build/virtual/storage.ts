import { genImport, genSafeVariableName } from "knitwork";
import type { Nitro } from "nitro/types";
import { builtinDrivers } from "unstorage";

export default function storage(nitro: Nitro) {
  return {
    id: "#nitro/virtual/storage",
    template: () => {
      const mounts: { path: string; driver: string; opts: object }[] = [];

      const isDevOrPrerender = nitro.options.dev || nitro.options.preset === "nitro-prerender";
      const storageMounts = isDevOrPrerender
        ? { ...nitro.options.storage, ...nitro.options.devStorage }
        : nitro.options.storage;

      for (const path in storageMounts) {
        const { driver: driverName, ...driverOpts } = storageMounts[path];
        mounts.push({
          path,
          driver: builtinDrivers[driverName as keyof typeof builtinDrivers] || driverName,
          opts: driverOpts,
        });
      }

      const driverImports = [...new Set(mounts.map((m) => m.driver))];

      return /* js */ `
import { createStorage } from 'unstorage'
import { assets } from '#nitro/virtual/server-assets'

${driverImports.map((i) => genImport(i, genSafeVariableName(i))).join("\n")}

export function initStorage() {
  const storage = createStorage({})
  storage.mount('/assets', assets)
  ${mounts
    .map(
      (m) =>
        `storage.mount('${m.path}', ${genSafeVariableName(m.driver)}(${JSON.stringify(m.opts)}))`
    )
    .join("\n")}
  return storage
}
`;
    },
  };
}
