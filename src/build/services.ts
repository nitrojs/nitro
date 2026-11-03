import type { Nitro } from "nitro/types";
import { resolveModulePath } from "exsolve";
import { resolve } from "pathe";
import { runtimeDir } from "#nitro/meta";
import { SERVICE_EXTENSIONS } from "../config/resolvers/services.ts";
import { prettyPath } from "../utils/fs.ts";

/** Finds an `entry-server` file in `app/`, `src/` or the root of the root and scan directories. */
export function findSSREntry(nitro: Nitro): string | undefined {
  return resolveModulePath("./entry-server", {
    from: ["app", "src", ""].flatMap((dir) =>
      [nitro.options.rootDir, ...nitro.options.scanDirs].map((base) => resolve(base, dir) + "/")
    ),
    extensions: SERVICE_EXTENSIONS,
    try: true,
  });
}

/** The server entry is disabled when it is also the entry of the `ssr` service. */
export function checkServerEntry(nitro: Nitro): void {
  const ssrEntry = nitro.options.services.ssr?.entry;
  if (ssrEntry && nitro.options.serverEntry && nitro.options.serverEntry.handler === ssrEntry) {
    nitro.logger.warn(
      `Nitro server entry and the \`ssr\` service both set to ${prettyPath(ssrEntry)}. Use a separate SSR entry (e.g. \`src/server.ts\`).`
    );
    nitro.options.serverEntry = false;
  }
}

/** Renders pages with the `ssr` service when no renderer is set. */
export function useSSRServiceRenderer(nitro: Nitro): void {
  const renderer = nitro.options.renderer;
  if (renderer?.handler || renderer?.template || !nitro.options.services.ssr?.entry) {
    return;
  }
  (nitro.options.renderer ??= {}).handler = resolve(runtimeDir, "internal/routes/ssr-renderer");
  nitro.routing.sync();
}
