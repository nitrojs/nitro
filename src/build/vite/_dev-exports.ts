import type { DevEnvironment } from "vite";
import type { NitroPluginContext } from "./types.ts";
import { isAbsolute } from "pathe";
import { rolldown } from "rolldown";

export const SERVER_ENTRY_EXPORTS_ID = "#nitro/virtual/server-entry-exports";

const WORKERD_BUILTIN_RE = /^(?:cloudflare|workerd):/;

/**
 * Bundle the server entry exports for the miniflare runner, which registers them as named worker
 * exports at startup. Modules are resolved and loaded by the Vite environment (aliases, conditions
 * and plugins), and files are tracked as they resolve so that a failed build still watches them.
 */
export async function buildDevServerExports(
  ctx: NitroPluginContext,
  env: DevEnvironment
): Promise<string> {
  const files = (ctx._serverEntryExportFiles ??= new Set());
  const bundle = await rolldown({
    input: SERVER_ENTRY_EXPORTS_ID,
    cwd: ctx.nitro!.options.rootDir,
    platform: "neutral",
    tsconfig: false,
    transform: {
      define: Object.fromEntries(
        Object.entries(env.config.define || {}).map(([key, value]) => [
          key,
          typeof value === "string" ? value : JSON.stringify(value),
        ])
      ),
    },
    plugins: [
      {
        name: "nitro:dev-exports",
        resolveId: {
          order: "pre",
          async handler(id, importer) {
            if (WORKERD_BUILTIN_RE.test(id)) {
              return { id, external: true };
            }
            const resolved = await env.pluginContainer.resolveId(id, importer);
            if (!resolved) {
              return null;
            }
            if (!resolved.external && isAbsolute(resolved.id)) {
              files.add(resolved.id.replace(/\?.*$/, ""));
            }
            return { id: resolved.id, external: !!resolved.external };
          },
        },
        load: (id) => env.pluginContainer.load(id) as any,
      },
    ],
  });
  try {
    const { output } = await bundle.generate({
      format: "esm",
      codeSplitting: false,
      sourcemap: "inline",
    });
    ctx._serverEntryExportFiles = new Set((await bundle.watchFiles).filter((f) => isAbsolute(f)));
    return output[0].code;
  } finally {
    await bundle.close();
  }
}
