import type { Nitro } from "nitro/types";
import type { RolldownPlugin } from "rolldown";

import { builtinModules } from "node:module";
import { resolveModulePath } from "exsolve";
import { isAbsolute } from "pathe";

const RESOLVE_SKIP_RE = /^(?:[\0#~.]|[a-z0-9]{2,}:)|\?/;
const BUILTIN_MODULE_SET = new Set([
  ...builtinModules,
  ...builtinModules.map((id) => `node:${id}`),
]);

export function getRequireConditionNames(exportConditions: string[]) {
  return [
    ...new Set([
      "require",
      ...exportConditions.filter((condition) => condition !== "import"),
      "default",
    ]),
  ];
}

export function resolveRequireCallPath(options: {
  id: string;
  importer?: string;
  rootDir: string;
  conditionNames: string[];
}) {
  if (RESOLVE_SKIP_RE.test(options.id) || BUILTIN_MODULE_SET.has(options.id)) {
    return;
  }
  return resolveModulePath(options.id, {
    try: true,
    from: options.importer && isAbsolute(options.importer) ? options.importer : options.rootDir,
    conditions: options.conditionNames,
  });
}

export function requireConditionResolver(nitro: Nitro): RolldownPlugin {
  const conditionNames = getRequireConditionNames(nitro.options.exportConditions || []);

  return {
    name: "nitro:rolldown-require-conditions",
    resolveId: {
      order: "pre",
      handler(source, importer, resolveOptions) {
        if (resolveOptions.kind !== "require-call") {
          return null;
        }
        const resolved = resolveRequireCallPath({
          id: source,
          importer,
          rootDir: nitro.options.rootDir,
          conditionNames,
        });
        if (!resolved) {
          return null;
        }
        return { id: resolved };
      },
    },
  };
}
