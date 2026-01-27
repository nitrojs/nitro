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
  const resolvedConditions: string[] = [];

  // 1. Add dev or production
  resolvedConditions.push(opts.dev ? "development" : "production");

  // 2. Add user specified conditions
  resolvedConditions.push(...conditions);

  // 3. Add runtime conditions (node or web)
  if (opts.node) {
    resolvedConditions.push("node");
  } else {
    // https://runtime-keys.proposal.wintercg.org/
    resolvedConditions.push(
      "wintercg",
      "worker",
      "web",
      "browser",
      "workerd",
      "edge-light",
      "netlify",
      "edge-routine",
      "deno"
    );
  }

  // 4. Add unwasm conditions
  if (opts.wasm) {
    resolvedConditions.push("wasm", "unwasm");
  }

  // 5. Add default conditions
  // "module" is NOT A STANDARD CONDITION but widely used in the ecosystem adding helps with compatibility
  resolvedConditions.push("import", "default", "module");

  // 6. Auto detect bun and deno (builder)
  if ("Bun" in globalThis) {
    resolvedConditions.push("bun");
  } else if ("Deno" in globalThis) {
    resolvedConditions.push("deno");
  }

  // Dedup with preserving order
  return resolvedConditions.filter((c, i) => resolvedConditions.indexOf(c) === i);
}
