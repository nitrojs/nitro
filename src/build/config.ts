import type { Nitro, NitroImportMeta } from "nitro/types";
import { defineEnv } from "unenv";
import { runtimeDependencies, distDir } from "nitro/meta";
import { escapeRegExp } from "../utils/regex.ts";

export type BaseBuildConfig = ReturnType<typeof baseBuildConfig>;

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

  return {
    extensions,
    isNodeless,
    replacements,
    env,
    aliases,
    noExternal,
  };
}

function getNoExternals(nitro: Nitro): RegExp[] {
  const noExternal = [
    /^(?:[\0#~.]|virtual:)/,
    /nitro\/(dist|app|cache|storage|context|database|task|runtime-config|~internal)/,
    nitro.options.wasm && /\.wasm$/,
    new RegExp("^" + escapeRegExp(distDir)),
    new RegExp(
      "^" + escapeRegExp(nitro.options.rootDir) + "(?!.*node_modules)"
    ),
    ...nitro.options.scanDirs,
    ...nitro.options.handlers
      .map((m) => m.handler)
      .filter((i) => typeof i === "string"),
  ];

  if (!nitro.options.dev && nitro.options.preset !== "nitro-prerender") {
    noExternal.push(
      new RegExp(
        `node_modules/${runtimeDependencies.map((dep) => escapeRegExp(dep)).join("|")}`
      )
    );
  }

  if (Array.isArray(nitro.options.noExternals)) {
    noExternal.push(...nitro.options.noExternals);
  }

  return (
    noExternal
      .filter(Boolean)
      .map((item) =>
        typeof item === "string" ? new RegExp(escapeRegExp(item)) : item
      ) as RegExp[]
  ).sort((a, b) => a.source.length - b.source.length);
}

export function resolveAliases(_aliases: Record<string, string>) {
  // Sort aliases from specific to general (ie. fs/promises before fs)
  const aliases = Object.fromEntries(
    Object.entries(_aliases).sort(
      ([a], [b]) =>
        b.split("/").length - a.split("/").length || b.length - a.length
    )
  );
  // Resolve alias values in relation to each other
  for (const key in aliases) {
    for (const alias in aliases) {
      if (!["~", "@", "#"].includes(alias[0])) {
        continue;
      }
      if (alias === "@" && !aliases[key].startsWith("@/")) {
        continue;
      } // Don't resolve @foo/bar

      if (aliases[key].startsWith(alias)) {
        aliases[key] = aliases[alias] + aliases[key].slice(alias.length);
      }
    }
  }
  return aliases;
}
