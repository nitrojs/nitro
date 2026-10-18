import type { NitroPreset, NitroPresetMeta } from "nitro/types";
import { kebabCase } from "scule";
import { provider, runtime } from "std-env";
import allPresets from "./_all.gen.ts";

export async function resolvePreset(
  name: string,
  opts: {
    static?: boolean;
    dev?: boolean;
    defaultPreset?: string | NitroPreset;
  } = {}
): Promise<(NitroPreset & { _meta?: NitroPresetMeta }) | undefined> {
  if (name === ".") {
    return undefined; // invalid input
  }

  const _name = kebabCase(name) || provider;

  const matches = allPresets.filter((preset) => {
    // prettier-ignore
    const names = [preset._meta.name, preset._meta.stdName, ...(preset._meta.aliases || [])].filter(Boolean);
    if (!names.includes(_name)) {
      return false;
    }

    // Match dev|prod
    return !!opts.dev === !!preset._meta.dev;
  });

  const preset =
    matches.find((p) => (p._meta.static || false) === (opts?.static || false)) || matches[0];

  if (typeof preset === "function") {
    // @ts-expect-error unreachable
    return preset();
  }

  // Auto-detect preset
  if (!name && !preset) {
    if (opts?.static) {
      return resolvePreset("static", opts);
    }
    // User-configured fallback preset (`defaultPreset`)
    if (opts.defaultPreset) {
      if (typeof opts.defaultPreset === "string") {
        return resolvePreset(opts.defaultPreset, { ...opts, defaultPreset: undefined });
      }
      const config =
        typeof opts.defaultPreset === "function" ? opts.defaultPreset() : opts.defaultPreset;
      return {
        ...config,
        _meta: { name: "default", ...(config as { _meta?: NitroPresetMeta })._meta },
      };
    }
    const runtimeMap = { deno: "deno", bun: "bun" } as Record<string, string>;
    return resolvePreset(runtimeMap[runtime] || "node", opts);
  }

  if (name && !preset) {
    // prettier-ignore
    const exists = allPresets.some((p) => p._meta.name === name || p._meta.stdName === name || p._meta.aliases?.includes(name));
    if (exists) {
      const err = new Error(
        `Preset "${name}" is not available in ${opts.dev ? "development" : "production"} mode.`
      );
      Error.captureStackTrace?.(err, resolvePreset);
      throw err;
    }
  }

  return preset;
}
