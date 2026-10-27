import type { RuleSetRule, RuleSetUseItem } from "@rspack/core";
import type { Filter, Hook } from "./_hooks.ts";
import { isWindows } from "std-env";
import { escapeRegExp } from "../../utils/regex.ts";

/**
 * Pre-loader rule with native conditions derived from the `load` and `transform` hook filters:
 * - Virtual module placeholders and modules with a query always run the loader.
 * - Modules matching an `id` filter of a `load` hook, or of a `transform` hook without `code` filter, run it.
 * - Other modules run it only when their code matches a `code` filter (`codeFilter`, Rspack >= 2.3).
 *
 * Falls back to running the loader on every module when a hook filter cannot be evaluated natively
 * (and on Windows, where native conditions see `\` separators while `id` filters expect `/`).
 */
export function loaderRule(opts: {
  test: RegExp;
  loader: string;
  options: Record<string, unknown>;
  virtualDir: string;
  hooks: { load: Hook[]; transform: Hook[] };
  rspackVersion: string;
}): RuleSetRule {
  const use: RuleSetUseItem = { loader: opts.loader, options: opts.options };
  const fallback: RuleSetRule = { test: opts.test, enforce: "pre", use: [use] };
  if (isWindows || !supportsCodeFilter(opts.rspackVersion)) {
    return fallback;
  }
  const idIncludes: RegExp[] = [];
  const codeIncludes: RegExp[] = [];
  for (const hook of opts.hooks.load) {
    const ids = nativePatterns(hook.filter?.id);
    if (!ids) {
      return fallback;
    }
    idIncludes.push(...ids);
  }
  for (const hook of opts.hooks.transform) {
    const code = nativePatterns(hook.filter?.code, true);
    if (code) {
      codeIncludes.push(...code);
      continue;
    }
    const ids = nativePatterns(hook.filter?.id);
    if (!ids) {
      return fallback;
    }
    idIncludes.push(...ids);
  }
  const codeFilter = unionRegExp(codeIncludes);
  if (codeIncludes.length > 0 && !codeFilter) {
    return fallback;
  }
  const virtualDir = new RegExp(
    `^${escapeRegExp(opts.virtualDir).replace(/\//g, String.raw`[\\/]`)}[\\\\/]`
  );
  const rules: RuleSetRule[] = [
    { include: virtualDir, use: [use] },
    { resourceQuery: /./, use: [use] },
    ...(idIncludes.length > 0 ? [{ include: idIncludes, use: [use] }] : []),
    ...(codeFilter ? [{ use: [{ ...use, codeFilter } as RuleSetUseItem] }] : []),
  ];
  // `enforce` is not inherited by nested rules
  return { test: opts.test, oneOf: rules.map((rule) => ({ ...rule, enforce: "pre" as const })) };
}

/** Loader `codeFilter` (https://github.com/web-infra-dev/rspack/pull/16073). */
function supportsCodeFilter(version: string) {
  const [major, minor] = version.split(".").map(Number);
  return major! > 2 || (major === 2 && minor! >= 3);
}

/** Include patterns of a filter as RegExps (`undefined` if they cannot be matched natively). */
function nativePatterns(filter: Filter, code?: boolean): RegExp[] | undefined {
  if (!filter) {
    return;
  }
  if (typeof filter === "string" || filter instanceof RegExp || Array.isArray(filter)) {
    const patterns = (Array.isArray(filter) ? filter : [filter]) as (string | RegExp)[];
    const res: RegExp[] = [];
    for (const p of patterns) {
      if (p instanceof RegExp) {
        res.push(p);
      } else if (code) {
        res.push(new RegExp(escapeRegExp(p)));
      } else {
        return; // `id` strings are globs
      }
    }
    return res;
  }
  // Excludes only narrow the match (the host checks the full filter again)
  return nativePatterns((filter as { include?: Filter }).include, code);
}

/** Single RegExp matching any of the patterns (`undefined` if they cannot be combined). */
function unionRegExp(patterns: RegExp[]): RegExp | undefined {
  if (patterns.length === 0) {
    return;
  }
  for (const p of patterns) {
    if (/[^gyd]/.test(p.flags) || /\\[1-9]|\\k<|\(\?<(?![=!])/.test(p.source)) {
      return; // Flags and back-references are not preserved in a union
    }
  }
  return new RegExp(patterns.map((p) => `(?:${p.source})`).join("|"));
}
