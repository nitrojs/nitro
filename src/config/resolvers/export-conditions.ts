import type { NitroOptions } from "nitro/types";

export async function resolveExportConditionsOptions(options: NitroOptions) {
  options.exportConditions = _resolveExportConditions(options.exportConditions || [], {
    dev: options.dev,
    node: options.node,
    wasm: options.wasm !== false,
  });
}

function _resolveExportConditions(
  userConditions: string[],
  opts: { dev: boolean; node: boolean; wasm?: boolean }
) {
  const conditions: string[] = [...userConditions.filter((c) => !c.startsWith("!"))];

  conditions.push(opts.dev ? "development" : "production");

  if (opts.wasm) {
    conditions.push("wasm", "unwasm");
  }

  if (opts.node) {
    conditions.push("node");
  }

  if ("Bun" in globalThis) {
    conditions.push("bun");
  } else if ("Deno" in globalThis) {
    conditions.push("deno");
  }

  const negated = new Set(userConditions.filter((c) => c.startsWith("!")).map((c) => c.slice(1)));

  return [...new Set(conditions)].filter((c) => !negated.has(c));
}
