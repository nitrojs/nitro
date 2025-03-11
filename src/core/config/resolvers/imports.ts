import escapeRE from "escape-string-regexp";
import { resolveModuleExportNames } from "mlly";
import type { NitroOptions } from "nitro/types";
import { join } from "pathe";
import type { Preset } from "unimport";

export async function resolveImportsOptions(options: NitroOptions) {
  // Skip loader entirely if imports disabled
  if (options.imports === false) {
    return;
  }

  // Add nitro imports preset
  options.imports.presets ??= [];
  options.imports.presets.push(...getNitroImportsPreset());

  // Add h3 auto imports preset
  const h3Exports = await resolveModuleExportNames("h3", {
    url: import.meta.url,
  });
  options.imports.presets ??= [];
  options.imports.presets.push({
    from: "h3",
    imports: h3Exports.filter((n) => !/^[A-Z]/.test(n) && n !== "use"),
  });

  // Auto imports from utils dirs
  options.imports.dirs ??= [];
  options.imports.dirs.push(
    ...options.scanDirs.map((dir) => join(dir, "utils/**/*"))
  );

  // Normalize exclude
  if (
    Array.isArray(options.imports.exclude) &&
    options.imports.exclude.length === 0
  ) {
    // Exclude .git and buildDir by default
    options.imports.exclude.push(/[/\\]\.git[/\\]/);
    options.imports.exclude.push(options.buildDir);

    // Exclude all node modules that are not a scanDir
    const scanDirsInNodeModules = options.scanDirs
      .map((dir) => dir.match(/(?<=\/)node_modules\/(.+)$/)?.[1])
      .filter(Boolean) as string[];
    options.imports.exclude.push(
      scanDirsInNodeModules.length > 0
        ? new RegExp(
            `node_modules\\/(?!${scanDirsInNodeModules
              .map((dir) => escapeRE(dir))
              .join("|")})`
          )
        : /[/\\]node_modules[/\\]/
    );
  }
}

function getNitroImportsPreset(): Preset[] {
  return [
    {
      from: "nitro/runtime/internal/app",
      imports: ["useNitroApp"],
    },
    {
      from: "nitro/runtime/internal/config",
      imports: ["useRuntimeConfig"],
    },
    {
      from: "nitro/runtime/internal/plugin",
      imports: ["defineNitroPlugin", "nitroPlugin"],
    },
    {
      from: "nitro/runtime/internal/cache",
      imports: [
        "defineCachedFunction",
        "defineCachedEventHandler",
        "cachedFunction",
        "cachedEventHandler",
      ],
    },
    {
      from: "nitro/runtime/internal/storage",
      imports: ["useStorage"],
    },
    {
      from: "nitro/runtime/internal/renderer",
      imports: ["defineRenderHandler"],
    },
    {
      from: "nitro/runtime/internal/meta",
      imports: ["defineRouteMeta"],
    },
    {
      from: "nitro/runtime/internal/route-rules",
      imports: ["getRouteRules"],
    },
    {
      from: "nitro/runtime/internal/context",
      imports: ["useRequest"],
    },
    {
      from: "nitro/runtime/internal/task",
      imports: ["defineTask", "runTask"],
    },
    {
      from: "nitro/runtime/internal/error/utils",
      imports: ["defineNitroErrorHandler"],
    },
  ];
}
