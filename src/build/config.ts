import type { Nitro, NitroStaticBuildFlags } from "nitro/types";
import { pathToFileURL } from "node:url";
import { join, resolve } from "pathe";
import { isWindows } from "std-env";
import { defineEnv } from "unenv";
import { runtimeDir } from "nitro/runtime/meta";

export type BaseBuildConfig = ReturnType<typeof baseBuildConfig>;

export function baseBuildConfig(nitro: Nitro) {
  const buildServerDir = join(nitro.options.buildDir, "dist/server");
  const presetsDir = resolve(runtimeDir, "../presets");

  // prettier-ignore
  const extensions: string[] = [".ts", ".mjs", ".js", ".json", ".node", ".tsx", ".jsx" ];

  const isNodeless = nitro.options.node === false;

  // Build-time environment variables
  let NODE_ENV = nitro.options.dev ? "development" : "production";
  if (nitro.options.preset === "nitro-prerender") {
    NODE_ENV = "prerender";
  }

  const buildEnvVars = {
    NODE_ENV,
    prerender: nitro.options.preset === "nitro-prerender",
    server: true,
    client: false,
    dev: String(nitro.options.dev),
    DEBUG: nitro.options.dev,
  };

  const staticFlags: NitroStaticBuildFlags = {
    dev: nitro.options.dev,
    preset: nitro.options.preset,
    prerender: nitro.options.preset === "nitro-prerender",
    server: true,
    client: false,
    nitro: true,
    baseURL: nitro.options.baseURL,
    // @ts-expect-error
    "versions.nitro": "",
    "versions?.nitro": "",
    // Internal
    _asyncContext: nitro.options.experimental.asyncContext,
    _websocket: nitro.options.experimental.websocket,
    _tasks: nitro.options.experimental.tasks,
  };

  // https://github.com/rollup/plugins/tree/master/packages/replace#delimiters
  const replaceDelimiters: [string, string] = [
    String.raw`\b`,
    String.raw`(?![\w.$])`,
  ];

  const replacements = {
    "typeof window": '"undefined"',
    _import_meta_url_: "import.meta.url",
    "globalThis.process.": "process.",
    "process.env.RUNTIME_CONFIG": () =>
      JSON.stringify(nitro.options.runtimeConfig, null, 2),
    ...Object.fromEntries(
      Object.entries(buildEnvVars).map(([key, val]) => [
        `process.env.${key}`,
        JSON.stringify(val),
      ])
    ),
    ...Object.fromEntries(
      Object.entries(buildEnvVars).map(([key, val]) => [
        `import.meta.env.${key}`,
        JSON.stringify(val),
      ])
    ),
    ...Object.fromEntries(
      Object.entries(staticFlags).map(([key, val]) => [
        `process.${key}`,
        JSON.stringify(val),
      ])
    ),
    ...Object.fromEntries(
      Object.entries(staticFlags).map(([key, val]) => [
        `import.meta.${key}`,
        JSON.stringify(val),
      ])
    ),
    ...nitro.options.replace,
  };

  const { env } = defineEnv({
    nodeCompat: isNodeless,
    npmShims: true,
    resolve: true,
    presets: nitro.options.unenv,
    overrides: {
      alias: nitro.options.alias,
    },
  });

  const aliases = resolveAliases({
    "#internal/nitro": runtimeDir,
    "nitro/runtime": runtimeDir,
    "nitropack/runtime": runtimeDir, // Backwards compatibility
    ...env.alias,
  });

  return {
    buildServerDir,
    presetsDir,
    extensions,
    isNodeless,
    buildEnvVars,
    staticFlags,
    replaceDelimiters,
    replacements,
    env,
    aliases,
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
