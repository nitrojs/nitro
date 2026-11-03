import type { Nitro } from "nitro/types";
import { importDep } from "../../utils/dep.ts";

/**
 * Import `rollup` from the user project.
 *
 * Nitro does not depend on `rollup` itself: the `rollup` builder is opt-in and
 * the version installed next to the app is the version that runs.
 */
export function importRollup(nitro: Nitro): Promise<typeof import("rollup")> {
  return importDep({
    id: "rollup",
    dir: nitro.options.rootDir,
    deps: nitro.options.deps,
  });
}
