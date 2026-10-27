import type { Plugin } from "rollup";

const HOOK_ORDER = { pre: 0, post: 2 } as Record<string, number>;

/** Hooks of Nitro's (Rollup) build plugins run by the `rspack` builder. */
export const SUPPORTED_HOOKS = new Set([
  "buildStart",
  "resolveId",
  "load",
  "transform",
  "buildEnd",
  "renderChunk",
  "closeBundle",
]);

export type HookName =
  | "buildStart"
  | "resolveId"
  | "load"
  | "transform"
  | "buildEnd"
  | "renderChunk"
  | "closeBundle";

export type Hook = { plugin: Plugin; handler: (...args: any[]) => any; filter?: any };

export function sortedHooks(plugins: Plugin[], name: string): Hook[] {
  const hooks: (Hook & { order: number })[] = [];
  for (const plugin of plugins) {
    const hook = plugin[name as keyof Plugin] as any;
    if (!hook) {
      continue;
    }
    const handler = typeof hook === "function" ? hook : hook.handler;
    hooks.push({ plugin, handler, filter: hook.filter, order: HOOK_ORDER[hook.order] ?? 1 });
  }
  return hooks.sort((a, b) => a.order - b.order);
}

export function isHook(value: unknown): boolean {
  return (
    typeof value === "function" ||
    (!!value && typeof value === "object" && typeof (value as any).handler === "function")
  );
}

export function isUnsupportedHook(key: string) {
  return (
    !SUPPORTED_HOOKS.has(key) &&
    // Only hooks affecting the output (watch and options hooks are harmless)
    !/^(options|outputOptions|watchChange|closeWatcher|onLog)$/.test(key)
  );
}

// Rollup hook filters (`{ id, code }`), see https://rollupjs.org/plugin-development/#hook-filters

type Pattern = string | RegExp | readonly (string | RegExp)[];

export function matchFilter(
  filter: Pattern | { include?: Pattern; exclude?: Pattern } | undefined,
  value: string,
  contains?: boolean
): boolean {
  if (!filter) {
    return true;
  }
  if (typeof filter === "string" || filter instanceof RegExp || Array.isArray(filter)) {
    return matchPattern(filter as Pattern, value, contains);
  }
  const { include, exclude } = filter as { include?: Pattern; exclude?: Pattern };
  if (exclude && matchPattern(exclude, value, contains)) {
    return false;
  }
  return include ? matchPattern(include, value, contains) : true;
}

// String patterns match ids exactly (no globs) and are searched in code
function matchPattern(pattern: Pattern, value: string, contains?: boolean): boolean {
  if (Array.isArray(pattern)) {
    return pattern.some((p) => matchPattern(p, value, contains));
  }
  if (pattern instanceof RegExp) {
    pattern.lastIndex = 0;
    return pattern.test(value);
  }
  return contains ? value.includes(pattern as string) : pattern === value;
}
