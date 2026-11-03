import type { BunLoader as Loader } from "./_types.ts";
import type { Plugin } from "rollup";
import { readFile } from "node:fs/promises";
import { isBuiltin } from "node:module";
import { resolveModulePath } from "exsolve";
import { isAbsolute, join, resolve } from "pathe";
import { importOXC, type OXC } from "../../utils/oxc.ts";
import { pluginContext } from "./_context.ts";
import { rewriteExternalStarExports, type ExportNames } from "./_reexports.ts";
import {
  HOOK_NAMES,
  JS_RE,
  cleanId,
  extensionLoader,
  getHooks,
  isFile,
  resolveLoader,
  type Hook,
  type HookName,
} from "./_hooks.ts";

export interface ResolvedModule {
  id: string;
  external: boolean;
  [key: string]: unknown;
}

export interface PluginContainerOptions {
  rootDir: string;
  /** Explicit paths of optional dependencies (`deps.paths`). */
  depPaths?: Record<string, string>;
  conditions: string[];
  extensions: string[];
  /** Externals of the Bun config (`external` and `packages`). */
  isExternal: (id: string) => boolean;
  watchMode: boolean;
  onWarn: (message: string) => void;
}

export const VIRTUAL_NAMESPACE = "nitro";

const SCRIPT_LOADERS = new Set<string>(["js", "jsx", "ts", "tsx"]);

/**
 * Runs Rollup plugins (`resolveId`, `load` and `transform`) in a Bun plugin (see `_bun-plugin.ts`).
 *
 * Output hooks (`renderChunk`, `resolveFileUrl`, `generateBundle`, `writeBundle`) are called by
 * `writeOutput` (see `_output.ts`) on the in-memory build result.
 */
export class PluginContainer {
  readonly moduleIds = new Set<string>();
  readonly watchFiles = new Set<string>();
  /** Assets emitted by plugins, by reference id. */
  readonly emittedFiles = new Map<string, { fileName: string; source: string | Uint8Array }>();
  /** Called when a plugin emits an asset (set while `generateBundle` hooks run). */
  onEmitFile?: (file: { fileName: string; source: string | Uint8Array }) => void;
  /** Ids of virtual modules by their (escaped) path in Bun. */
  readonly virtualPaths = new Map<string, string>();

  #opts: PluginContainerOptions;
  #hooks: Record<HookName, Hook[]>;
  #conditions: { import: string[]; require: string[] };
  #oxc?: OXC;
  #exportNames = new Map<string, Promise<ExportNames>>();

  constructor(plugins: Plugin[], opts: PluginContainerOptions) {
    this.#opts = opts;
    this.#hooks = Object.fromEntries(
      HOOK_NAMES.map((name) => [name, getHooks(plugins, name)])
    ) as Record<HookName, Hook[]>;
    this.#conditions = {
      import: [...opts.conditions, "import"],
      require: [...opts.conditions, "require"],
    };
  }

  async buildStart() {
    this.moduleIds.clear();
    this.watchFiles.clear();
    this.emittedFiles.clear();
    // `this.parse` is synchronous
    this.#oxc ??= await importOXC({ dir: this.#opts.rootDir, paths: this.#opts.depPaths });
    await Promise.all(this.#hooks.buildStart.map((hook) => this.#call(hook, [{}])));
  }

  async buildEnd(error?: unknown) {
    await Promise.all(this.#hooks.buildEnd.map((hook) => this.#call(hook, [error])));
  }

  /** Calls the `renderChunk` hooks in order, each with the code returned by the previous one. */
  async renderChunk(code: string, args: unknown[]): Promise<string> {
    for (const hook of this.#hooks.renderChunk) {
      const result = await this.#call(hook, [code, ...args]);
      if (result != null) {
        code = typeof result === "string" ? result : result.code;
      }
    }
    return code;
  }

  /** Calls the `generateBundle` or `writeBundle` hook of each plugin in order. */
  async callBundleHook(name: "generateBundle" | "writeBundle", args: unknown[]) {
    for (const hook of this.#hooks[name]) {
      await this.#call(hook, args);
    }
  }

  /** Result of the first `resolveFileUrl` hook returning one. */
  async resolveFileUrl(args: Record<string, unknown>): Promise<string | undefined> {
    for (const hook of this.#hooks.resolveFileUrl) {
      const result = await this.#call(hook, [args]);
      if (result != null) {
        return result;
      }
    }
  }

  /** Module id of an input of the Bun metafile (relative to the working directory). */
  moduleId(input: string): string {
    if (input.startsWith(`${VIRTUAL_NAMESPACE}:`)) {
      const path = input.slice(VIRTUAL_NAMESPACE.length + 1);
      return this.virtualPaths.get(path) || path;
    }
    return isAbsolute(input) || /^[a-z]{2,}:/.test(input) ? input : resolve(input);
  }

  /** Runs `resolveId` hooks, or returns `undefined` when none resolves `id`. */
  async resolveId(
    id: string,
    importer: string | undefined,
    opts: { kind?: string; isEntry?: boolean; custom?: unknown; skip?: Set<Plugin> } = {}
  ): Promise<ResolvedModule | undefined> {
    for (const hook of this.#hooks.resolveId) {
      if (opts.skip?.has(hook.plugin) || (hook.id && !hook.id(id))) {
        continue;
      }
      const result = await this.#call(
        hook,
        [
          id,
          importer,
          { attributes: {}, custom: opts.custom, isEntry: !!opts.isEntry, kind: opts.kind },
        ],
        { skip: opts.skip }
      );
      if (result == null) {
        continue;
      }
      if (result === false) {
        return { id, external: true };
      }
      return typeof result === "string"
        ? { id: result, external: false }
        : { ...result, external: !!result.external };
    }
  }

  defaultResolve(
    id: string,
    importer: string | undefined,
    opts: { kind?: string } = {}
  ): ResolvedModule | undefined {
    if (isBuiltin(id)) {
      return { id: id.includes(":") ? id : `node:${id}`, external: true };
    }
    const path = importer && cleanId(importer);
    const resolved = resolveModulePath(id, {
      from: path && isAbsolute(path) && !path.includes("\0") ? path : join(this.#opts.rootDir, "_"),
      conditions: this.#conditions[opts.kind === "require-call" ? "require" : "import"],
      extensions: this.#opts.extensions,
      suffixes: ["", "/index"],
      try: true,
    });
    return resolved ? { id: resolved, external: false } : undefined;
  }

  /** Runs `load` and `transform` hooks, or returns `undefined` to let Bun load the file. */
  async load(
    id: string,
    opts: { loader?: Loader; read?: boolean } = {}
  ): Promise<{ contents: string | Uint8Array; loader: Loader } | undefined> {
    this.moduleIds.add(id);
    const isJS = JS_RE.test(cleanId(id));
    let code: string | undefined;
    let moduleType: string | undefined;
    for (const hook of this.#hooks.load) {
      if (hook.id && !hook.id(id)) {
        continue;
      }
      const result = await this.#call(hook, [id], { id });
      if (result != null) {
        code = typeof result === "string" ? result : result.code;
        moduleType = result.moduleType;
        break;
      }
    }
    const loaded = code !== undefined;
    // Files are only transformed by hooks with an `id` filter matching them (Bun has its own loaders)
    const transforms =
      isJS || loaded
        ? this.#hooks.transform
        : this.#hooks.transform.filter((hook) => hook.id?.(id));
    if (!loaded) {
      const path = cleanId(id);
      // Files no `transform` hook applies to are loaded by Bun (with its own loader)
      if (!(transforms.length > 0 || opts.read) || !isFile(path)) {
        return;
      }
      // Files read for virtual modules (e.g. paths with `..`) are passed as bytes to Bun's loader
      const loader = opts.loader || extensionLoader(id);
      if (transforms.length === 0 && !SCRIPT_LOADERS.has(loader)) {
        return { contents: await readFile(path), loader };
      }
      code = await readFile(path, "utf8");
    }
    let transformed = false;
    for (const hook of transforms) {
      if ((hook.id && !hook.id(id)) || (hook.code && !hook.code(code!))) {
        continue;
      }
      const result = await this.#call(
        hook,
        [code, id, { moduleType: moduleType || resolveLoader(id, { fallback: "js" }) }],
        { id }
      );
      if (result == null) {
        continue;
      }
      transformed = true;
      code = typeof result === "string" ? result : (result.code ?? code);
      moduleType = result.moduleType || moduleType;
    }
    const loader = resolveLoader(id, {
      moduleType,
      // Unchanged files keep Bun's loader (or the one of their extension for virtual modules)
      fallback: loaded || transformed ? "js" : opts.loader || extensionLoader(id),
    });
    if (SCRIPT_LOADERS.has(loader)) {
      code =
        (await rewriteExternalStarExports(code!, {
          id,
          filename: `module.${loader}`,
          oxc: this.#oxc!,
          names: this.#exportNames,
          resolveExternal: (specifier) => this.#resolveExternal(specifier, id),
        })) || code;
    }
    return { contents: code!, loader };
  }

  /** Path (or specifier) to import an external module with, or `undefined` if bundled. */
  async #resolveExternal(specifier: string, importer: string): Promise<string | undefined> {
    const resolved = await this.resolveId(specifier, importer);
    if (resolved && !resolved.external) {
      return;
    }
    const path = this.defaultResolve(specifier, importer);
    if (path?.external) {
      return path.id;
    }
    if (resolved?.external || this.#opts.isExternal(specifier)) {
      // Ids of externals can be placeholders (e.g. traced dependencies)
      return path?.id || resolved?.id || specifier;
    }
  }

  #call(hook: Hook, args: unknown[], opts: { skip?: Set<Plugin>; id?: string } = {}) {
    const context = pluginContext(this, {
      plugin: hook.plugin,
      skip: opts.skip,
      id: opts.id,
      oxc: this.#oxc,
      watchMode: this.#opts.watchMode,
      onWarn: this.#opts.onWarn,
    });
    return hook.handler.call(context, ...args);
  }
}
