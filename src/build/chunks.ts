import type { Nitro } from "nitro/types";
import { presetsDir, runtimeDir } from "nitro/meta";

const virtualRe = /^(?:\0|#|virtual:)/;

export const NODE_MODULES_RE = /node_modules[/\\][^.]/;

export function libChunkName(id: string) {
  const pkgName = id.match(
    /.*(?:[/\\])node_modules(?:[/\\])(?<package>@[^/\\]+[/\\][^/\\]+|[^/\\.][^/\\]*)/
  )?.groups?.package;
  return `_libs/${pkgName || "common"}`;
}

export function getChunkName(
  chunk: { name: string; moduleIds: string[] },
  nitro: Nitro
) {
  // Known groups
  if (chunk.name === "rolldown-runtime") {
    return "_runtime.mjs";
  }

  // Library chunks
  if (chunk.moduleIds.every((id) => id.includes("node_modules"))) {
    const pkgNames = [
      ...new Set(
        chunk.moduleIds
          .map(
            (id) =>
              id.match(
                /.*[/\\]node_modules[/\\](?<package>@[^/\\]+[/\\][^/\\]+|[^/\\]+)/
              )?.groups?.package
          )
          .filter(Boolean)
          .map((name) => name!.split(/[/\\]/).pop()!)
          .filter(Boolean)
      ),
    ].sort((a, b) => a.length - b.length);
    let chunkName = "";
    for (const name of pkgNames) {
      const separator = chunkName ? "+" : "";
      if ((chunkName + separator + name).length > 30) {
        return `_libs/_[hash].mjs`;
      }
      chunkName += separator + name;
    }
    return `_libs/${chunkName || "_"}.mjs`;
  }

  // No moduleIds
  if (chunk.moduleIds.length === 0) {
    return `_chunks/${chunk.name}.mjs`;
  }

  const ids = chunk.moduleIds.filter((id) => !virtualRe.test(id));

  // All virtual
  if (ids.length === 0) {
    if (chunk.moduleIds.every((id) => id.includes("virtual:raw"))) {
      return `_raw/[name].mjs`;
    }
    return `_virtual/[name].mjs`;
  }

  // WASM chunk
  if (ids.every((id) => id.endsWith(".wasm"))) {
    return `_wasm/[name].mjs`;
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
    return `_nitro/[name].mjs`;
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

  return `_chunks/[name].mjs`;
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
