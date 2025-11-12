import type { Nitro } from "nitro/types";
import { presetsDir, runtimeDir } from "../runtime/meta.ts";
import { parseNodeModulePath } from "mlly";

const virtualRe = /^\0|^virtual:/;

export function getChunkName(nitro: Nitro, moduleIds: string[]) {
  const ids = moduleIds.filter((id) => !virtualRe.test(id));

  // All virtual
  if (ids.length === 0) {
    if (moduleIds.every((id) => id.includes("virtual:raw"))) {
      return `_raw/[name].mjs`;
    }
    return `_virtual/[name].mjs`;
  }

  // WASM chunk
  if (ids.every((id) => id.endsWith(".wasm"))) {
    return `_wasm/[name].wasm`;
  }

  // Chunks generate by other vite environments (we assume SSR for simplicity)
  if (ids.every((id) => id.includes("vite/services"))) {
    return `_ssr/[name].mjs`;
  }

  // Chunks from generated code
  if (ids.every((id) => id.startsWith(nitro.options.buildDir))) {
    return `_build/[name].mjs`;
  }

  // Only nitro runtime
  if (
    ids.every((id) => id.startsWith(runtimeDir) || id.startsWith(presetsDir))
  ) {
    return `_runtime/[name].mjs`;
  }

  // Try to match user defined routes or tasks
  const mainId = ids.at(-1);
  if (mainId) {
    const routeHandler = nitro.routing.routes.routes
      .flatMap((h) => h.data)
      .find((h) => h.handler === mainId);
    if (routeHandler?.route) {
      return `_routes/${routeToFsPath(routeHandler.route)}.mjs`;
    }

    const taskHandler = Object.entries(nitro.options.tasks).find(
      ([_, task]) => task.handler === mainId
    );
    if (taskHandler) {
      return `_tasks/[name].mjs`;
    }
  }

  // Only node_modules
  if (ids.every((id) => id.includes("node_modules"))) {
    if (ids.length > 3) {
      return `_lib/[hash].mjs`;
    }
    const pkgNames = [
      ...new Set(
        ids
          .map((id) => parseNodeModulePath(id)?.name?.replace(/^@.+\//, ""))
          .filter((id) => id && !id.startsWith("."))
          .sort()
      ),
    ].join("+");
    return `_lib/${pkgNames.length < 50 ? pkgNames : "[hash]"}.mjs`;
  }

  // Mixed chunk
  return `_/[hash].mjs`;
}

function routeToFsPath(route: string) {
  return (
    route
      .split("/")
      .slice(1)
      .map(
        (s) =>
          `${s.replace(/[:*]+/g, "$").replace(/[^$a-zA-Z0-9_.[\]/]/g, "_")}`
      )
      .join("/") || "index"
  );
}
