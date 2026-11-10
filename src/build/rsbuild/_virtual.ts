import type { NitroRsbuildContext } from "./_context.ts";
import { ASSETS_ID } from "./_assets.ts";

/** Nitro plugin passing the runtime modules to the services (development). */
export const RUNTIME_MODULES_ID = "#nitro/virtual/rsbuild-runtime-modules";

/** Runtime modules shared with services (one instance, from the Nitro server). */
export const NITRO_RUNTIME_IDS = [
  ASSETS_ID,
  "nitro",
  "nitro/app",
  "nitro/cache",
  "nitro/context",
  "nitro/database",
  "nitro/kv",
  "nitro/runtime-config",
  "nitro/services",
  "nitro/storage",
  "nitro/task",
];

/**
 * In development, the service outputs are imported from disk, with the runtime modules they use
 * passed with a global (`__nitro_rsbuild_modules__`), set up by this plugin before any request.
 */
export function runtimeModulesTemplate(ctx: NitroRsbuildContext): string {
  // Every module when no service import is known yet (e.g. from a persistent build cache)
  const ids = ctx.runtimeIds.size > 0 ? [...ctx.runtimeIds] : NITRO_RUNTIME_IDS;
  return /* js */ `
${ids.map((id, i) => `import * as _m${i} from ${JSON.stringify(id)};`).join("\n")}
globalThis.__nitro_rsbuild_modules__ = { ${ids.map((id, i) => `${JSON.stringify(id)}: _m${i}`).join(", ")} };
export default function rsbuildRuntimeModules() {}
`;
}
