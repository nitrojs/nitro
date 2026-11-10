import type { Compiler, Module, Stats } from "@rspack/core";
import type { NitroRsbuildContext } from "./_context.ts";
import { relative } from "pathe";
import { joinURL } from "ufo";
import { useNitro } from "./_context.ts";
import {
  ASSETS_RUNTIME_CODE,
  EMPTY_ASSETS,
  parseIdQuery,
  type AssetsResult,
} from "../_assets-import.ts";

/** Assets of the client modules (entries and dynamic imports), by environment and module key. */
export type ClientAssets = Record<string, Record<string, AssetsResult>>;

/** Client assets of the `?assets` imports (shared with services in development). */
export const ASSETS_ID = "#nitro/virtual/rsbuild-assets";

const NAME = "nitro:assets-import";

const ASSETS_QUERY_RE = /\?(?:.*&)?assets(?:[=&]|$)/;

/**
 * `?assets` imports of the server environments (`nitro` and services): the default export is the
 * scripts and styles of a module in a client environment (`?assets=<env>`, `client` is the
 * environment owning pages, which `?assets` also targets). Imports are replaced by a module reading
 * the assets collected from the client build ({@link ASSETS_ID}), so that server environments do not
 * wait for the client.
 */
export function setupAssetsImport(ctx: NitroRsbuildContext, compilers: Compiler[]) {
  const nitro = useNitro(ctx);
  const imports = new Map<string, { envs: string[]; key: string; request: string }>();
  for (const compiler of compilers) {
    const isClient = ctx.clientEnvs.includes(compiler.name!);
    compiler.hooks.normalModuleFactory.tap(NAME, (nmf) => {
      nmf.hooks.beforeResolve.tapPromise({ name: NAME, stage: -100 }, async (data) => {
        if (data.request.includes("!") || !ASSETS_QUERY_RE.test(data.request)) {
          return;
        }
        if (isClient) {
          data.request = jsDataURI(`export default ${JSON.stringify(EMPTY_ASSETS)};`);
          return;
        }
        const { filename, query } = parseIdQuery(data.request);
        const path = await resolve(compiler, data.context, filename);
        const key = relative(nitro.options.rootDir, path);
        const envs = targetEnvs(ctx, query.assets || "client");
        imports.set(`${envs}:${key}`, { envs, key, request: data.request });
        data.request = jsDataURI(
          `import { assets } from ${JSON.stringify(ASSETS_ID)};\nexport default assets(${JSON.stringify(envs)}, ${JSON.stringify(key)});`
        );
      });
    });
  }

  // Imports of modules that are neither an entry nor a dynamic import of the client (in development,
  // dynamic imports are compiled when loaded by default)
  const warned = new Set<string>();
  const isLazy = (env: string) =>
    ctx.dev && !!compilers.find((c) => c.name === env)?.options.lazyCompilation;
  ctx.compiler?.hooks.done.tap(NAME, () => {
    for (const [id, { envs, key, request }] of imports) {
      for (const env of envs) {
        if (
          ctx.clientAssets?.[env] &&
          !ctx.clientAssets[env][key] &&
          !warned.has(id) &&
          !isLazy(env)
        ) {
          warned.add(id);
          nitro.logger.warn(
            `\`${request}\`: \`${key}\` is not an entry or a dynamic import of the \`${env}\` environment, its assets are empty.`
          );
        }
      }
    }
  });
}

/** Code of the {@link ASSETS_ID} module. */
export function assetsTemplate(ctx: NitroRsbuildContext): string {
  return /* js */ `${ASSETS_RUNTIME_CODE}
const clientAssets = ${JSON.stringify(ctx.clientAssets || {})};
export function assets(envs, key) {
  return mergeAssets(...envs.map((env) => clientAssets[env]?.[key] || { js: [], css: [] }));
}
`;
}

/**
 * Scripts and styles of the entries and dynamically imported modules of a client build, by module
 * path (relative to the root directory). Scripts are in load order, the last one is the `entry`.
 */
export function collectClientAssets(stats: Stats, rootDir: string): Record<string, AssetsResult> {
  const { compilation } = stats;
  const { publicPath } = stats.toJson({ all: false, publicPath: true });
  const base = publicPath && publicPath !== "auto" ? publicPath : "/";
  const { moduleGraph, chunkGraph } = compilation;
  const assets: Record<string, AssetsResult> = {};
  const add = (module: Module | null, group: { getFiles(): string[] } | null | undefined) => {
    const path = module?.nameForCondition();
    if (!path || !group) {
      return;
    }
    const key = relative(rootDir, path);
    if (assets[key]) {
      return;
    }
    const files = group
      .getFiles()
      .filter((file) => !file.includes(".hot-update."))
      .map((file) => joinURL(base, file));
    const js = files.filter((file) => /\.[cm]?js$/.test(file));
    assets[key] = {
      entry: js.at(-1),
      js: js.map((href) => ({ href })),
      css: files.filter((file) => file.endsWith(".css")).map((href) => ({ href })),
    };
  };
  for (const [name, entry] of compilation.entries) {
    for (const dependency of entry.dependencies) {
      add(moduleGraph.getModule(dependency), compilation.entrypoints.get(name));
    }
  }
  for (const module of compilation.modules) {
    for (const block of module.blocks) {
      for (const dependency of block.dependencies) {
        add(moduleGraph.getModule(dependency), chunkGraph.getBlockChunkGroup(block));
      }
    }
  }
  return Object.fromEntries(Object.entries(assets).sort(([a], [b]) => a.localeCompare(b)));
}

/** Client environments of an `?assets` query value (none for server environments). */
function targetEnvs(ctx: NitroRsbuildContext, value: string): string[] {
  if (ctx.clientEnvs.includes(value)) {
    return [value];
  }
  return value === "client" && ctx.clientEnvs[0] ? [ctx.clientEnvs[0]] : [];
}

function resolve(compiler: Compiler, context: string, request: string): Promise<string> {
  const resolver = compiler.resolverFactory.get("normal", { dependencyType: "esm" });
  return new Promise((resolve, reject) => {
    resolver.resolve({}, context, request, {}, (error, result) =>
      error || !result
        ? reject(error || new Error(`Cannot resolve \`${request}\` from \`${context}\`.`))
        : resolve(result)
    );
  });
}

function jsDataURI(code: string): string {
  return `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
}
