import type { NitroOptions } from "nitro/types";

export async function resolveExportConditionsOptions(options: NitroOptions) {
  options.exportConditions = _resolveExportConditions(options.exportConditions || [], {
    dev: options.dev,
    node: options.node,
    wasm: options.wasm !== false,
  });
}

function _resolveExportConditions(
  conditions: string[],
  opts: { dev: boolean; node: boolean; wasm?: boolean }
) {
  const negated = new Set(conditions.filter((c) => c.startsWith("!")).map((c) => c.slice(1)));

  const resolvedConditions: string[] = [];

  // 1. Add dev or production
  resolvedConditions.push(opts.dev ? "development" : "production");

  // 2. Add user specified conditions
  resolvedConditions.push(...conditions.filter((c) => !c.startsWith("!")));

  // 3. Add unwasm conditions
  if (opts.wasm) {
    resolvedConditions.push("wasm", "unwasm");
  }

  // 4. Add default conditions
  // "module" is NOT A STANDARD CONDITION but widely used in the ecosystem adding helps with compatibility
  resolvedConditions.push("module");

  // 5. Auto detect bun and deno (builder)
  if ("Bun" in globalThis) {
    resolvedConditions.push("bun");
  } else if ("Deno" in globalThis) {
    resolvedConditions.push("deno");
  }

  // 6. Dedup and remove negated conditions
  return [...new Set(resolvedConditions)].filter((c) => !negated.has(c));
}
