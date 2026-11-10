import type { Plugin } from "rollup";
import _replace from "@rollup/plugin-replace";
import { escapeRegExp } from "../../utils/regex.ts";
import { RESOLVED_RE as rawModulesRE } from "./raw.ts";

export function replace(values: Record<string, string | ((id: string) => string)>): Plugin {
  const plugin = (_replace as unknown as typeof _replace.default)({
    preventAssignment: true,
    values,
    // Raw modules hold file contents as string literals; replacing inside them
    // corrupts the content (and can break the syntax with quoted values)
    exclude: rawModulesRE,
  });

  // The plugin re-applies replacements on whole chunks, where raw module contents
  // can no longer be excluded by id. All replaceable code goes through `transform`.
  delete plugin.renderChunk;

  // Modules without any of the keys are left unchanged (skipped natively by Rolldown)
  const keys = Object.keys(values);
  if (keys.length > 0 && typeof plugin.transform === "function") {
    plugin.transform = {
      filter: { code: new RegExp(keys.map((key) => escapeRegExp(key)).join("|")) },
      handler: plugin.transform,
    };
  }

  return plugin;
}
