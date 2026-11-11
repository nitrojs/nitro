import type { NitroBuildPlugin } from "nitro/types";
import { presetsDir } from "#nitro/meta";
import { join } from "pathe";
import { patches } from "./_patches.ts";

const srvxAdapter = join(presetsDir, "scriptc/runtime/_srvx");

const patchedIds = new RegExp(patches.map((p) => p.id.source).join("|"));

export function scriptcPlugin(): NitroBuildPlugin {
  return {
    name: "nitro:scriptc",
    enforce: "pre",
    resolveId: {
      order: "pre",
      filter: { id: /^srvx$/ },
      handler(id, importer) {
        if (id === "srvx") {
          return this.resolve(srvxAdapter, importer, { skipSelf: true });
        }
      },
    },
    transform: {
      filter: { id: patchedIds },
      handler(code, id) {
        const normalizedId = id.replace(/\\/g, "/");
        // Stub builds re-export the runtime from `src/`
        if (/^export \* from "[^"]+";\s*$/.test(code)) {
          return;
        }
        let patched = code;
        for (const patch of patches) {
          if (!patch.id.test(normalizedId)) {
            continue;
          }
          const next =
            typeof patch.from === "string"
              ? patched.replaceAll(patch.from, patch.to as string)
              : patched.replace(patch.from, patch.to as string);
          if (next === patched && patch.required !== false) {
            this.warn(
              `Patch for scriptc did not apply to \`${id}\` (\`${String(patch.from).slice(0, 60)}\`). The build may not compile with scriptc.`
            );
          }
          if (patch.leftover && next.includes(patch.leftover.match)) {
            this.warn(`${patch.leftover.message} (\`${id}\`)`);
          }
          patched = next;
        }
        return patched === code ? undefined : { code: patched, map: null };
      },
    },
  };
}
