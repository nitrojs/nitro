import { resolveCompatibilityDatesFromEnv, formatCompatibilityDate } from "compatx";
import type { CompatibilityDateSpec, PlatformName } from "compatx";
import type { NitroPreset, NitroPresetMeta } from "nitro/types";
import { kebabCase } from "scule";
import { provider, runtime } from "std-env";
import type { ProviderName } from "std-env";
import allPresets from "./_all.gen.ts";

// std-env has more specific keys for providers than compatx
const _stdProviderMap: Partial<Record<ProviderName, PlatformName>> = {
  aws_amplify: "aws",
  azure_static: "azure",
  cloudflare_pages: "cloudflare",
};

export async function resolvePreset(
  name: string,
  opts: {
    static?: boolean;
    compatibilityDate?: false | CompatibilityDateSpec;
    dev?: boolean;
  } = {}
): Promise<(NitroPreset & { _meta?: NitroPresetMeta }) | undefined> {
  if (name === ".") {
    return undefined; // invalid input
  }

  const _name = kebabCase(name) || provider;

  const _compatDates = opts.compatibilityDate
    ? resolveCompatibilityDatesFromEnv(opts.compatibilityDate)
    : false;

  const matches = allPresets
    .filter((preset) => {
      // prettier-ignore
      const names = [preset._meta.name, preset._meta.stdName, ...(preset._meta.aliases || [])].filter(Boolean);
      if (!names.includes(_name)) {
        return false;
      }

      // Match dev|prod
      if ((opts.dev && !preset._meta.dev) || (!opts.dev && preset._meta.dev)) {
        return false;
      }

      if (_compatDates) {
        const _date =
          _compatDates[_stdProviderMap[preset._meta.stdName!] as PlatformName] ||
          _compatDates[preset._meta.stdName as PlatformName] ||
          _compatDates[preset._meta.name as PlatformName] ||
          _compatDates.default;

        if (
          _date &&
          preset._meta.compatibilityDate &&
          new Date(preset._meta.compatibilityDate) > new Date(_date)
        ) {
          return false;
        }
      }

      return true;
    })
    .sort((a, b) => {
      const aDate = new Date(a._meta.compatibilityDate || 0);
      const bDate = new Date(b._meta.compatibilityDate || 0);
      return bDate > aDate ? 1 : -1;
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
    const runtimeMap = { deno: "deno", bun: "bun" } as Record<string, string>;
    return resolvePreset(runtimeMap[runtime] || "node", opts);
  }

  if (name && !preset) {
    // prettier-ignore
    const options = allPresets
      .filter((p) =>p._meta.name === name ||p._meta.stdName === name ||p._meta.aliases?.includes(name) )
      .sort((a, b) => (a._meta.compatibilityDate || 0) > (b._meta.compatibilityDate || 0) ? 1 : -1);
    if (options.length > 0) {
      let msg = `Preset "${name}" cannot be resolved with current compatibilityDate: ${formatCompatibilityDate(_compatDates || "")}.\n\n`;
      for (const option of options) {
        msg += `\n- ${option._meta.name} (requires compatibilityDate >= ${option._meta.compatibilityDate})`;
      }
      const err = new Error(msg);
      Error.captureStackTrace?.(err, resolvePreset);
      throw err;
    }
  }

  return preset;
}
