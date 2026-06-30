import type { Nitro } from "nitro/types";
import type { Configuration, RuleSetRule } from "@rspack/core";
import type { RspackConfig } from "../../types/build.ts";
import { defu } from "defu";
import { join } from "pathe";
import { runtimeDir } from "nitro/meta";
import { baseBuildConfig } from "../config.ts";
import { virtualTemplates } from "../virtual/_all.ts";
import { NitroVfsPlugin } from "./plugins/vfs.ts";
import { NitroRawPlugin } from "./plugins/raw.ts";
import { NitroExternalsPlugin } from "./plugins/externals.ts";

const WASM_STUB_ID = "#nitro/internal/rspack/wasm-stub";

export async function getRspackConfig(nitro: Nitro): Promise<Configuration> {
  const base = baseBuildConfig(nitro);

  const { rspack } = await import("@rspack/core");

  // In-memory VFS for nitro's virtual templates.
  const vfs = new NitroVfsPlugin({
    root: join(nitro.options.buildDir, "__nitro_vfs__"),
    modules: [
      ...virtualTemplates(nitro, [...base.env.polyfill]),
      // Stage 1: stub for `.wasm` imports — rspack's native wasm handling differs from unwasm
      // (no default `init` export). Handlers that depend on wasm fail at runtime instead of
      // blocking the build until proper unwasm-equivalent handling lands.
      {
        id: WASM_STUB_ID,
        template:
          "const noop = () => { throw new Error('[nitro:rspack] wasm imports are not yet supported in the rspack builder'); };\n" +
          "export default noop;\n",
      },
    ],
  });
  await vfs.preload();

  const rawPlugin = new NitroRawPlugin({
    vfs,
    conditions: nitro.options.exportConditions || [],
    rootDir: nitro.options.rootDir,
  });

  // Mirror rendered virtual contents into nitro.vfs for downstream tooling visibility.
  nitro.vfs ||= new Map();
  for (const [id, content] of vfs.getContents()) {
    nitro.vfs.set(id, { render: () => content });
  }

  const aliases: Record<string, string | false> = {
    ...base.aliases,
    ...vfs.getAliases(),
    "#nitro/runtime": join(runtimeDir, "internal"),
    "#nitro/virtual": join(runtimeDir, "virtual"),
  };

  const define: Record<string, string> = {};
  for (const [key, val] of Object.entries(base.replacements)) {
    define[key] = typeof val === "string" ? val : JSON.stringify(val);
  }

  const tsc = nitro.options.typescript.tsConfig?.compilerOptions;
  const swcLoaderRule: RuleSetRule = {
    test: /\.(?:ts|tsx|mts|cts|js|mjs|cjs|jsx)$/,
    loader: "builtin:swc-loader",
    options: {
      jsc: {
        parser: { syntax: "typescript", tsx: true, decorators: true },
        target: "es2022",
        transform: {
          react: {
            runtime: tsc?.jsx === "react" ? "classic" : "automatic",
            importSource: tsc?.jsxImportSource,
            pragma: tsc?.jsxFactory,
            pragmaFrag: tsc?.jsxFragmentFactory,
            development: nitro.options.dev,
          },
        },
      },
    },
    type: "javascript/auto",
  };

  const wasmStubPath = vfs.pathFor(WASM_STUB_ID);

  const externalsPlugin = buildExternalsPlugin(nitro, base.noExternal);

  let config: Configuration = {
    name: "nitro-rspack",
    mode: nitro.options.dev ? "development" : "production",
    target: nitro.options.node ? "node22" : "webworker",
    context: nitro.options.rootDir,
    entry: nitro.options.entry,
    devtool: nitro.options.sourcemap ? "source-map" : false,
    output: {
      path: nitro.options.output.serverDir,
      filename: "index.mjs",
      chunkFilename: "_chunks/[name].mjs",
      module: true,
      library: { type: "module" },
      chunkFormat: "module",
      iife: false,
      clean: !nitro.options.dev,
      // Emit absolute resource paths in source-map "sources" so runtime stack frames point to
      // real files (e.g. `test/fixture/server/routes/errors/...`) instead of `__rspack...`.
      devtoolModuleFilenameTemplate: "[absolute-resource-path]",
    },
    experiments: {
      asyncWebAssembly: true,
      // Route paths inside the VFS root through the JS inputFileSystem the plugin wraps.
      useInputFileSystem: [vfs.fsPattern],
    },
    resolve: {
      alias: aliases,
      extensions: base.extensions,
      conditionNames: nitro.options.exportConditions,
      fullySpecified: false,
    },
    externalsPresets: nitro.options.node ? { node: true } : undefined,
    externalsType: "module-import",
    externals: externalsPlugin?.externalsFunction() as Configuration["externals"],
    module: {
      rules: [swcLoaderRule],
      // Downgrade missing-export errors (e.g. wasm stubs) to warnings so the build still runs.
      parser: {
        javascript: {
          exportsPresence: "warn" as const,
          importExportsPresence: "warn" as const,
          reexportExportsPresence: "warn" as const,
        },
      },
    },
    plugins: [
      vfs,
      rawPlugin,
      ...(externalsPlugin ? [externalsPlugin] : []),
      new rspack.DefinePlugin(define),
      new rspack.NormalModuleReplacementPlugin(/\.wasm$/, wasmStubPath),
      // Entry banner: parity with rolldown's `server-main` plugin — exposes the entry
      // file's URL on `globalThis.__nitro_main__` so static-asset readers can locate
      // files relative to the bundle at runtime.
      new rspack.BannerPlugin({
        banner: "globalThis.__nitro_main__ = import.meta.url;",
        raw: true,
        entryOnly: true,
      }),
    ],
    optimization: {
      minimize: !!nitro.options.minify,
    },
    performance: false,
    stats: "errors-warnings",
    infrastructureLogging: { level: "error" },
    ignoreWarnings: [/CIRCULAR/i, /Critical dependency/i],
  };

  config = defu(nitro.options.rspackConfig as RspackConfig, config) as Configuration;

  return config;
}

function buildExternalsPlugin(
  nitro: Nitro,
  noExternal: RegExp[]
): NitroExternalsPlugin | undefined {
  if (!nitro.options.node || nitro.options.noExternals === true) {
    return undefined;
  }
  const isDevOrPrerender =
    nitro.options.dev || nitro.options.preset === "nitro-prerender";
  return new NitroExternalsPlugin({
    rootDir: nitro.options.rootDir,
    conditions: nitro.options.exportConditions || [],
    include: nitro.options.traceDeps || [],
    exclude: [...noExternal],
    trace: isDevOrPrerender
      ? false
      : {
          ...nitro.options.traceOpts,
          outDir: nitro.options.output.serverDir,
        },
  });
}
