import type { Nitro, NitroImportMeta } from "nitro/types";
import { dirname } from "pathe";
import { defineEnv } from "unenv";
import { pkgDir, runtimeDependencies, presetsDir } from "nitro/meta";

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

  const noExternal: (string | RegExp | ((id: string) => boolean))[] = [
    "#",
    "~",
    "@/",
    "~~",
    "@@/",
    "virtual:",
    "nitro",
    pkgDir,
    nitro.options.serverDir,
    nitro.options.buildDir,
    dirname(nitro.options.entry),
    ...(nitro.options.wasm === false
      ? []
      : [(id: string) => id.endsWith(".wasm")]),
    ...nitro.options.handlers
      .map((m) => m.handler)
      .filter((i) => typeof i === "string"),
    ...(nitro.options.dev || nitro.options.preset === "nitro-prerender"
      ? []
      : runtimeDependencies),
  ].filter(Boolean) as string[];

  const { env } = defineEnv({
    nodeCompat: isNodeless,
    resolve: true,
    presets: nitro.options.unenv,
    overrides: {
      alias: nitro.options.alias,
    },
  });

  const aliases = resolveAliases({ ...env.alias });

  return {
    presetsDir,
    extensions,
    isNodeless,
    replacements,
    env,
    aliases,
    noExternal,
  };
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
