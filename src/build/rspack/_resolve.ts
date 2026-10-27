import type { Compilation, ExternalItemFunctionData } from "@rspack/core";
import { builtinModules } from "node:module";
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

const BARE_IMPORT_RE = /^(?![./#\0]|[a-z]:[\\/]|[a-z][\w+.-]*:)/i;

export interface ModuleResolverOptions {
  host: PluginHost;
  virtual: VirtualPlaceholders;
  /** Current compilation (to resolve with Rspack). */
  compilation: () => Compilation | undefined;
  /** Externals that are not resolved (builtins and `external` of the preset). */
  externals?: string[];
}

/** Resolution of the build plugins (`resolveId`) and externals, cached per compilation. */
export class ModuleResolver {
  readonly opts: ModuleResolverOptions;
  /** Externals that are not resolved (builtins and `external` of the preset). */
  readonly staticExternals: Set<string>;
  /** `resolveId` results by issuer and request, shared by `externals` and `beforeResolve`. */
  resolveCache = new Map<string, Promise<ResolvedId | undefined>>();
  /** `unresolvedExternal` results by resolve directory and request. */
  unresolvedCache = new Map<string, Promise<string | undefined>>();

  constructor(opts: ModuleResolverOptions) {
    this.opts = opts;
    this.staticExternals = new Set(opts.externals);
  }

  clear() {
    this.resolveCache.clear();
    this.unresolvedCache.clear();
  }

  /** `externals` function: externals resolved by the build plugins. */
  async externals(data: ExternalItemFunctionData): Promise<string | string[] | undefined> {
    const { request, dependencyType, contextInfo } = data;
    if (!request || request.includes("!")) {
      return;
    }
    const kind: ImportKind = dependencyType === "commonjs" ? "require-call" : "import-statement";
    let id: string | undefined;
    if (this.staticExternals.has(request)) {
      // Like the externals plugin (workerd only resolves builtins by their `node:` id)
      id = isBareBuiltin(request) ? `node:${request}` : request;
    } else {
      const resolved = await this.resolve(request, contextInfo?.issuer, kind);
      id = resolved
        ? resolved.external
          ? resolved.id
          : undefined
        : await this.unresolvedExternal(request, contextInfo?.issuer);
    }
    // `require()` from bundled CommonJS gets `module.exports` (not the namespace) with Node.js
    if (id && kind === "require-call") {
      if (this.opts.host.nitro.options.node) {
        return `node-commonjs ${id.startsWith("file:") ? fileURLToPath(id) : id}`;
      }
      // Externals are ES modules: the default export of a builtin is its `module.exports`
      if (id.startsWith("node:")) {
        return [id, "default"];
      }
    }
    return id;
  }

  /** Like Rollup, bare imports that cannot be resolved are kept external (with a warning). */
  unresolvedExternal(request: string, issuer: string | undefined): Promise<string | undefined> {
    if (!BARE_IMPORT_RE.test(request)) {
      return NOT_RESOLVED;
    }
    const importer = issuer ? this.opts.virtual.toId(issuer) : undefined;
    const key = `${this.resolveDir(importer)}\0${request}`;
    let result = this.unresolvedCache.get(key);
    if (!result) {
      result = this.resolveWithRspack(request, importer, "require-call").then(async (resolved) => {
        if (resolved || (await this.resolveWithRspack(request, importer))) {
          return;
        }
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
      const importer = issuer ? this.opts.virtual.toId(issuer) : undefined;
      resolved = this.opts.host.resolveId(request, importer, { isEntry: !issuer, kind });
      this.resolveCache.set(key, resolved);
    }
    return resolved;
  }

  async resolveWithRspack(source: string, importer: string | undefined, kind?: ImportKind) {
    const compiler = this.opts.compilation()?.compiler;
    if (!compiler) {
      return;
    }
    const resolver = compiler.resolverFactory.get("normal", {
      dependencyType: kind === "require-call" ? "commonjs" : "esm",
    });
    return new Promise<string | undefined>((resolve) => {
      resolver.resolve({}, this.resolveDir(importer), source, {}, (error, result) => {
        resolve(error || !result ? undefined : result);
      });
    });
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
