import type { Compiler, RspackPluginInstance } from "@rspack/core";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import mime from "mime";
import { hash } from "ohash";
import { isAbsolute, resolve as resolvePath } from "pathe";
import { resolveModulePath } from "exsolve";
import type { NitroVfsPlugin } from "./vfs.ts";

const PLUGIN_NAME = "NitroRawPlugin";
const RAW_PREFIX = "raw:";

export interface NitroRawPluginOptions {
  /** VFS plugin used to serve synthesized raw modules from memory. */
  vfs: NitroVfsPlugin;
  /** Module resolution conditions. */
  conditions: string[];
  /** Project root for fallback resolution. */
  rootDir: string;
}

/**
 * Replicates the rollup `raw` plugin for rspack: `raw:foo` imports resolve to the underlying
 * file and are emitted as a default export — a `string` for text mimetypes and a `Uint8Array`
 * (base64-decoded) for everything else.
 *
 * Implementation: `beforeResolve` resolves the target, reads it, renders a tiny JS module into
 * the in-memory VFS, and rewrites the request to that VFS path. No on-disk artifacts, no
 * loader file, no module rules — rspack's standard pipeline picks it up via `inputFileSystem`.
 */
export class NitroRawPlugin implements RspackPluginInstance {
  private opts: NitroRawPluginOptions;

  constructor(opts: NitroRawPluginOptions) {
    this.opts = opts;
  }

  apply(compiler: Compiler): void {
    compiler.hooks.normalModuleFactory.tap(PLUGIN_NAME, (factory) => {
      factory.hooks.beforeResolve.tapPromise(PLUGIN_NAME, async (data) => {
        if (!data.request || !data.request.startsWith(RAW_PREFIX)) return;
        const resolved = this.resolveRawTarget(data.request.slice(RAW_PREFIX.length), data.context);
        if (!resolved) return;
        data.request = await this.renderToVfs(resolved);
      });
    });
  }

  private async renderToVfs(absPath: string): Promise<string> {
    const id = `#nitro/raw/${hash(absPath)}`;
    const existing = this.opts.vfs.read(this.opts.vfs.pathFor(id));
    if (existing !== undefined) return this.opts.vfs.pathFor(id);

    const buf = await readFile(absPath);
    const code = isBinary(absPath)
      ? `const _b = Uint8Array.from(atob(${JSON.stringify(buf.toString("base64"))}), (c) => c.charCodeAt(0));\nexport default _b;\n`
      : `export default ${JSON.stringify(buf.toString("utf8"))};\n`;
    return this.opts.vfs.setRendered(id, code);
  }

  private resolveRawTarget(target: string, context: string | undefined): string | undefined {
    if (target.startsWith("file://")) return fileURLToPath(target);
    if (isAbsolute(target)) return target;
    if (target.startsWith("./") || target.startsWith("../")) {
      return context ? resolvePath(context, target) : undefined;
    }
    return (
      resolveModulePath(target, {
        try: true,
        from: context && isAbsolute(context) ? context : this.opts.rootDir,
        conditions: this.opts.conditions,
      }) || undefined
    );
  }
}

function isBinary(filePath: string): boolean {
  const t = mime.getType(filePath) || "";
  if (t.startsWith("text/")) return false;
  if (/application\/(json|sql|xml|yaml)/.test(t)) return false;
  return true;
}
