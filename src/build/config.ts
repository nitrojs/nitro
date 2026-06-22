import type { Nitro, NitroImportMeta } from "nitro/types";
import { defineEnv } from "unenv";
import { pkgDir } from "nitro/meta";
import { pathRegExp, toPathRegExp } from "../utils/regex.ts";

export type BaseBuildConfig = ReturnType<typeof baseBuildConfig>;

const ROOT_ALIAS = "@";

export function baseBuildConfig(nitro: Nitro) {
  // prettier-ignore
  const extensions: string[] = [".ts", ".mjs", ".js", ".json", ".node", ".tsx", ".jsx" ];

  const isNodeless = nitro.options.node === false;

  const importMetaInjections: NitroImportMeta = {
    dev: nitro.options.dev,
    preset: nitro.options.preset,
    prerender: nitro.options.preset === "nitro-prerender",
    nitro: true,
    server: true,
    client: false,
    baseURL: nitro.options.baseURL,
    _asyncContext: nitro.options.experimental.asyncContext,
    _tasks: nitro.options.experimental.tasks,
    _websocket: nitro.options.features.websocket ?? nitro.options.experimental.websocket,
  };

  const replacements = {
    ...Object.fromEntries(
      Object.entries(importMetaInjections).map(([key, val]) => [
        `import.meta.${key}`,
        JSON.stringify(val),
      ])
    ),
    ...nitro.options.replace,
  };

  const { env } = defineEnv({
    nodeCompat: isNodeless,
    resolve: true,
    presets: nitro.options.unenv,
    overrides: {
      alias: nitro.options.alias,
    },
  });

  const aliases = resolveAliases({ ...env.alias });

  const noExternal: RegExp[] = getNoExternals(nitro);

  const ignoreWarningCodes = new Set([
    "EVAL",
    "CIRCULAR_DEPENDENCY",
    "THIS_IS_UNDEFINED",
    "EMPTY_BUNDLE",
  ]);

  return {
    extensions,
    isNodeless,
    replacements,
    env,
    aliases,
    noExternal,
    ignoreWarningCodes,
  };
}

function getNoExternals(nitro: Nitro): RegExp[] {
  const noExternal: RegExp[] = [
    /\.[mc]?tsx?$/,
    /^(?:[\0#~.]|virtual:)/,
    new RegExp("^" + pathRegExp(pkgDir) + "(?!.*node_modules)"),
    ...[
      nitro.options.rootDir,
      ...[nitro.options.buildDir, ...nitro.options.scanDirs].filter(
        (dir) => dir.includes("node_modules") || !dir.startsWith(nitro.options.rootDir)
      ),
    ].map((dir) => new RegExp("^" + pathRegExp(dir) + "(?!.*node_modules)")),
  ];

  if (nitro.options.wasm !== false) {
    noExternal.push(/\.wasm$/);
  }

  if (Array.isArray(nitro.options.noExternals)) {
    noExternal.push(
      ...nitro.options.noExternals
        .filter(Boolean)
        .map((item) => toPathRegExp(item as string | RegExp))
    );
  }

  return noExternal.sort((a, b) => a.source.length - b.source.length);
}

export function resolveAliases(_aliases: Record<string, string>) {
  // Sort aliases from specific to general (ie. fs/promises before fs)
  const aliases = Object.fromEntries(
    Object.entries(_aliases).sort(
      ([a], [b]) => b.split("/").length - a.split("/").length || b.length - a.length
    )
  );
  const resolvableAliases = Object.keys(aliases).filter(isResolvableAliasKey);
  // Resolve alias values in relation to each other
  for (const key in aliases) {
    if (!isResolvableAliasValue(aliases[key])) {
      continue;
    }
    for (const alias of resolvableAliases) {
      if (alias === ROOT_ALIAS && !aliases[key].startsWith(`${ROOT_ALIAS}/`)) {
        continue;
      } // Don't resolve @foo/bar

      if (aliases[key].startsWith(alias)) {
        aliases[key] = aliases[alias] + aliases[key].slice(alias.length);
      }
    }
  }
  return aliases;
}

function isResolvableAliasKey(id: string) {
  // Internal aliases: `~`, `~~`, `@`, `@@`, `#*` (but not scoped packages like `@scope/pkg`)
  return id[0] === "~" || id[0] === "#" || /^@+$/.test(id);
}

function isResolvableAliasValue(id: string) {
  return id[0] === "~" || id[0] === "#" || /^@+\//.test(id);
}
