import type { Plugin } from "rollup";
import type { BunLoader } from "./_types.ts";
import { statSync } from "node:fs";
import { isAbsolute, join } from "pathe";

export const HOOK_NAMES = [
  "buildStart",
  "resolveId",
  "load",
  "transform",
  "buildEnd",
  "renderChunk",
  "resolveFileUrl",
  "generateBundle",
  "writeBundle",
] as const;

export type HookName = (typeof HOOK_NAMES)[number];

export interface Hook {
  plugin: Plugin;
  handler: (this: any, ...args: any[]) => any;
  /** Compiled `filter.id` (only set when the hook has one). */
  id?: (id: string) => boolean;
  /** Compiled `filter.code` (only set when the hook has one). */
  code?: (code: string) => boolean;
}

export const JS_RE = /\.[cm]?[jt]sx?$/;

type StringFilter = MaybeArray<string | RegExp> | { include?: unknown; exclude?: unknown };

type MaybeArray<T> = T | T[];

const LOADERS = new Set<string>(["js", "jsx", "ts", "tsx", "json", "text", "css", "toml"]);

const EXT_LOADERS: Record<string, BunLoader> = {
  json: "json",
  css: "css",
  toml: "toml",
  txt: "text",
};

/** Hooks of the plugins named `name`, sorted by `order`, with their filters compiled. */
export function getHooks(plugins: Plugin[], name: HookName): Hook[] {
  const rank = (order: unknown) => (order === "pre" ? 0 : order === "post" ? 2 : 1);
  return plugins
    .flatMap((plugin) => {
      const hook = plugin[name] as any;
      const handler = typeof hook === "function" ? hook : hook?.handler;
      if (typeof handler !== "function") {
        return [];
      }
      // Composable filters (arrays) are not supported: handlers check their inputs too
      const filter = hook.filter && !Array.isArray(hook.filter) ? hook.filter : undefined;
      return [
        {
          plugin,
          handler,
          id: filter?.id && compileFilter(filter.id, matchGlob),
          code:
            filter?.code && compileFilter(filter.code, (pattern, code) => code.includes(pattern)),
          order: rank(hook.order),
        },
      ];
    })
    .sort((a, b) => a.order - b.order);
}

export function isFile(id: string): boolean {
  return isAbsolute(id) && !/[\0?]/.test(id) && !!statSync(id, { throwIfNoEntry: false })?.isFile();
}

export function cleanId(id: string): string {
  return id.split("?")[0]!;
}

/** File name to parse `id` with (its language), or `module.js`. */
export function parseFilename(id: string | undefined): string {
  const path = id && cleanId(id);
  return path && JS_RE.test(path) ? path : "module.js";
}

export function resolveLoader(
  id: string,
  opts: { moduleType?: string; fallback: BunLoader }
): BunLoader {
  if (opts.moduleType && LOADERS.has(opts.moduleType)) {
    return opts.moduleType as BunLoader;
  }
  const ext = /\.[cm]?(tsx?|jsx)$/.exec(cleanId(id))?.[1];
  if (ext) {
    return ext as BunLoader;
  }
  return opts.fallback;
}

/** Bun loader of a file by its extension (for files read by Nitro), defaulting to `file`. */
export function extensionLoader(id: string): BunLoader {
  if (JS_RE.test(cleanId(id))) {
    return resolveLoader(id, { fallback: "js" });
  }
  return EXT_LOADERS[/\.(\w+)$/.exec(cleanId(id))?.[1] || ""] || "file";
}

// String patterns match ids as globs and code as substrings
function compileFilter(
  filter: StringFilter,
  matchString: (pattern: string, value: string) => boolean
): (value: string) => boolean {
  const { include, exclude } = (
    typeof filter === "string" || filter instanceof RegExp || Array.isArray(filter)
      ? { include: filter }
      : filter
  ) as { include?: MaybeArray<string | RegExp>; exclude?: MaybeArray<string | RegExp> };
  const compile = (patterns?: MaybeArray<string | RegExp>) => {
    const tests = (patterns === undefined ? [] : [patterns].flat()).map((pattern) =>
      typeof pattern === "string"
        ? (value: string) => matchString(pattern, value)
        : (value: string) => {
            pattern.lastIndex = 0;
            return pattern.test(value);
          }
    );
    return tests.length > 0 ? tests : undefined;
  };
  const includes = compile(include);
  const excludes = compile(exclude);
  return (value) =>
    !excludes?.some((test) => test(value)) && (!includes || includes.some((test) => test(value)));
}

const globs = new Map<string, { match: (path: string) => boolean }>();

// Same as Rollup: relative patterns (not starting with `**`) are resolved from the working directory
function matchGlob(pattern: string, id: string): boolean {
  let glob = globs.get(pattern);
  if (!glob) {
    const { Glob } = (globalThis as any).Bun;
    glob = new Glob(
      pattern.startsWith("**") || isAbsolute(pattern) ? pattern : join(process.cwd(), pattern)
    ) as { match: (path: string) => boolean };
    globs.set(pattern, glob);
  }
  return glob.match(id);
}
