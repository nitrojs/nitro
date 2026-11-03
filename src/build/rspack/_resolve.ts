import type { Compiler, ExternalItemFunctionData } from "@rspack/core";
import { builtinModules } from "node:module";
import { normalize as nativeNormalize } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname, isAbsolute } from "pathe";
import type { PluginHost } from "./_host.ts";
import type { VirtualPlaceholders } from "./_virtual.ts";

/** Import kind (Rolldown's `kind` resolve option): `require()` resolves with `require` conditions. */
export type ImportKind = "import-statement" | "require-call";

export interface ResolvedId {
  id: string;
  external: boolean;
}

const NOT_RESOLVED = Promise.resolve(undefined);

const RESOLVER_OPTIONS = {
  esm: { dependencyType: "esm" },
  commonjs: { dependencyType: "commonjs" },
};

const BARE_IMPORT_RE = /^(?![./#\0]|[a-z]:[\\/]|[a-z][\w+.-]*:)/i;

export interface ModuleResolverOptions {
  host: PluginHost;
  virtual: VirtualPlaceholders;
  /** Compiler (to resolve with Rspack). */
  compiler: () => Compiler | undefined;
  /** Externals that are not resolved, by request (builtins, aliases of builtins and `external` of the preset). */
  externals?: Map<string, string>;
  /** `node:` builtins the runtime provides (`external` of the preset). */
  runtimeBuiltins?: string[];
  /** `external` option of `rollupConfig` (matched before the request is resolved). */
  isExternal?: (source: string, importer: string | undefined) => Promise<boolean>;
}

/** Resolution of the build plugins (`resolveId`) and externals, cached per compilation. */
export class ModuleResolver {
  readonly opts: ModuleResolverOptions;
  /** Externals that are not resolved, by request (builtins, aliases of builtins and `external` of the preset). */
  readonly staticExternals: Map<string, string>;
  /** `node:` builtins the runtime provides. */
  readonly runtimeBuiltins: Set<string>;
  /** `resolveId` results by issuer and request, shared by `externals` and `beforeResolve`. */
  resolveCache = new Map<string, Promise<ResolvedId | undefined>>();
  /** `unresolvedExternal` results by resolve directory and request. */
  unresolvedCache = new Map<string, Promise<string | undefined>>();

  constructor(opts: ModuleResolverOptions) {
    this.opts = opts;
    this.staticExternals = opts.externals || new Map();
    this.runtimeBuiltins = new Set(opts.runtimeBuiltins);
  }

  clear() {
    this.resolveCache.clear();
    this.unresolvedCache.clear();
  }

  /** `externals` function: externals resolved by the build plugins. */
  async externals(data: ExternalItemFunctionData): Promise<string | string[] | undefined> {
    const { request, dependencyType, contextInfo, context } = data;
    if (!request || request.includes("!")) {
      return;
    }
    const kind: ImportKind = dependencyType === "commonjs" ? "require-call" : "import-statement";
    let id = this.staticExternals.get(request);
    if (id) {
      // Like the externals plugin (workerd only resolves builtins by their `node:` id)
      id = isBareBuiltin(id) ? `node:${id}` : id;
    } else if (
      this.opts.isExternal &&
      (await this.opts.isExternal(request, this.importer(contextInfo?.issuer)))
    ) {
      id = request;
    } else {
      const resolved = await this.resolve(request, contextInfo?.issuer, kind);
      id = resolved
        ? resolved.external
          ? resolved.id
          : undefined
        : await this.unresolvedExternal(request, { context, issuer: contextInfo?.issuer });
    }
    // `require()` from bundled CommonJS gets `module.exports` (not the namespace) with Node.js
    if (id && kind === "require-call") {
      if (this.opts.host.nitro.options.node) {
        return `node-commonjs ${id.startsWith("file:") ? fileURLToPath(id) : id}`;
      }
      // Externals are ES modules: the default export of a builtin is its `module.exports`. Other
      // builtins are kept as a `require()` call, so that a guarded one only fails when called.
      if (id.startsWith("node:")) {
        return this.runtimeBuiltins.has(id) ? [id, "default"] : `commonjs ${id}`;
      }
    }
    return id;
  }

  /**
   * Like Rollup, bare imports that cannot be resolved are kept external (with a warning).
   * Resolved once per directory (`context` is the one Rspack resolves from).
   */
  unresolvedExternal(
    request: string,
    opts: { context?: string; issuer?: string }
  ): Promise<string | undefined> {
    if (!BARE_IMPORT_RE.test(request)) {
      return NOT_RESOLVED;
    }
    const dir = opts.context || this.resolveDir(this.importer(opts.issuer));
    const key = `${dir}\0${request}`;
    let result = this.unresolvedCache.get(key);
    if (!result) {
      result = this.resolveInDir(dir, request, "require-call").then(async (resolved) => {
        if (resolved || (await this.resolveInDir(dir, request))) {
          return;
        }
        const importer = this.importer(opts.issuer);
        this.opts.host.nitro.logger.warn(
          `Could not resolve \`${request}\`${importer ? ` (imported by \`${importer}\`)` : ""}, treating it as external.`
        );
        return request;
      });
      this.unresolvedCache.set(key, result);
    }
    return result;
  }

  /** Runs the `resolveId` hooks once per issuer, request and import kind. */
  resolve(
    request: string,
    issuer: string | undefined,
    kind?: ImportKind
  ): Promise<ResolvedId | undefined> {
    if (!this.opts.host.mayResolveId(request)) {
      return NOT_RESOLVED;
    }
    // `beforeResolve` has no import kind: its requests resolve as imports (like ESM externals)
    const key = `${issuer || ""}\0${request}\0${kind || "import-statement"}`;
    let resolved = this.resolveCache.get(key);
    if (!resolved) {
      resolved = this.opts.host.resolveId(request, this.importer(issuer), {
        isEntry: !issuer,
        kind,
      });
      this.resolveCache.set(key, resolved);
    }
    return resolved;
  }

  resolveWithRspack(source: string, importer: string | undefined, kind?: ImportKind) {
    return this.resolveInDir(this.resolveDir(importer), source, kind);
  }

  resolveInDir(dir: string, source: string, kind?: ImportKind): Promise<string | undefined> {
    const compiler = this.opts.compiler();
    if (!compiler) {
      return NOT_RESOLVED;
    }
    const resolver = compiler.resolverFactory.get(
      "normal",
      kind === "require-call" ? RESOLVER_OPTIONS.commonjs : RESOLVER_OPTIONS.esm
    );
    return new Promise<string | undefined>((resolve) => {
      resolver.resolve({}, dir, source, {}, (error, result) => {
        // Module ids have native separators (like with Rollup), Rspack keeps the `/` of `C:/` on Windows
        resolve(error || !result ? undefined : nativeNormalize(result));
      });
    });
  }

  /** Plugin id of an issuer. */
  importer(issuer: string | undefined): string | undefined {
    return issuer ? this.opts.virtual.toId(issuer) : undefined;
  }

  /** Directory imports of a module resolve from (the root directory for virtual modules). */
  resolveDir(importer: string | undefined): string {
    const path = importer?.split("?")[0];
    return path && isAbsolute(path) ? dirname(path) : this.opts.host.nitro.options.rootDir;
  }
}

function isBareBuiltin(id: string) {
  return !id.startsWith("node:") && builtinModules.includes(id);
}
