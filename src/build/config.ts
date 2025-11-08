import type { Nitro, NitroStaticBuildFlags } from "nitro/types";
import { dirname, resolve } from "pathe";
import { defineEnv } from "unenv";
import { pkgDir, runtimeDependencies, runtimeDir } from "nitro/meta";

export type BaseBuildConfig = ReturnType<typeof baseBuildConfig>;

export function baseBuildConfig(nitro: Nitro) {
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

  const noExternal = [
    "#",
    "~",
    "@/",
    "~~",
    "@@/",
    "virtual:",
    "nitro",
    pkgDir,
    nitro.options.serverDir,
    dirname(nitro.options.entry),
    ...(nitro.options.experimental.wasm
      ? [(id: string) => id?.endsWith(".wasm")]
      : []),
    ...nitro.options.handlers
      .map((m) => m.handler)
      .filter((i) => typeof i === "string"),
    ...(nitro.options.dev || nitro.options.preset === "nitro-prerender"
      ? []
      : runtimeDependencies),
  ].filter(Boolean) as string[];

  const { env } = defineEnv({
    nodeCompat: isNodeless,
    npmShims: true,
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
    buildEnvVars,
    staticFlags,
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
