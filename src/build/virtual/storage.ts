import { genImport, genSafeVariableName } from "knitwork";
import type { Nitro } from "nitro/types";
import { isDepInstalled, isLibOption } from "../../utils/dep.ts";
import { resolveDriverDeps, resolveStorageMounts } from "../../utils/storage.ts";

export default function storage(nitro: Nitro) {
  return {
    id: "#nitro/virtual/storage",
    template: () => {
      const mounts = resolveStorageMounts(nitro.options);

      const driverImports = [...new Set(mounts.map((m) => m.driver))];

      const tracingEnabled = !!(
        typeof nitro.options.tracingChannel === "object" && nitro.options.tracingChannel?.unstorage
      );

      return /* js */ `
import { createStorage } from 'unstorage'
${tracingEnabled ? `import { withTracing } from 'unstorage/tracing'` : ""}
import { assets } from '#nitro/virtual/server-assets'

${driverImports.map((i) => genImport(i, genSafeVariableName(i))).join("\n")}

export function initStorage() {
  const storage = createStorage({})
  storage.mount('/assets', assets)
  ${mounts
    .map(
      (m) =>
        `storage.mount('${m.path}', ${genSafeVariableName(m.driver)}(${genDriverOptions(nitro, m)}))`
    )
    .join("\n")}
  return ${tracingEnabled ? "withTracing(storage)" : "storage"}
}
`;
    },
  };
}

/**
 * Explicitly provide third-party libraries used by the driver via the `lib` option
 * so that they are statically analyzable by the bundler.
 */
function genDriverOptions(nitro: Nitro, mount: ReturnType<typeof resolveStorageMounts>[number]) {
  const libs = resolveDriverDeps(mount.name)
    .filter(
      (dep) =>
        isLibOption(dep.option) &&
        mount.options[dep.option] === undefined &&
        isDepInstalled(dep.name, nitro.options.rootDir)
    )
    .map((dep) => `${dep.option}: () => import(${JSON.stringify(dep.name)})`);

  const options = JSON.stringify(mount.options);
  return libs.length > 0 ? `{ ...${options}, ${libs.join(", ")} }` : options;
}
