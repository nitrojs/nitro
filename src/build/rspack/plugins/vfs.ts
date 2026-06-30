import type { Compiler, RspackPluginInstance } from "@rspack/core";

// Minimal local mirror of rspack's `util/fs.InputFileSystem` (not re-exported from the
// package entry). Only the methods we actually wrap are typed strictly.
type ErrCb<T> = (err: NodeJS.ErrnoException | null, data?: T) => void;
type IStats = {
  isFile: () => boolean;
  isDirectory: () => boolean;
  isBlockDevice: () => boolean;
  isCharacterDevice: () => boolean;
  isSymbolicLink: () => boolean;
  isFIFO: () => boolean;
  isSocket: () => boolean;
  dev: number;
  ino: number;
  mode: number;
  nlink: number;
  uid: number;
  gid: number;
  rdev: number;
  size: number;
  blksize: number;
  blocks: number;
  atimeMs: number;
  mtimeMs: number;
  ctimeMs: number;
  birthtimeMs: number;
  atime: Date;
  mtime: Date;
  ctime: Date;
  birthtime: Date;
};
type InputFileSystem = {
  readFile: (path: string, callback: ErrCb<string | Buffer>) => void;
  readFileSync?: (path: string) => string | Buffer;
  stat: (path: string, callback: ErrCb<IStats>) => void;
  statSync?: (path: string) => IStats;
  lstat?: (path: string, callback: ErrCb<IStats>) => void;
  lstatSync?: (path: string) => IStats;
  realpath?: (path: string, callback: ErrCb<string>) => void;
  realpathSync?: (path: string) => string;
  [key: string]: unknown;
};

export type VfsTemplate = string | (() => string | Promise<string>);

export interface VfsModule {
  id: string;
  template: VfsTemplate;
}

export interface VfsPluginOptions {
  modules: VfsModule[];
  /** Filesystem prefix used for virtual module paths. Should be a path inside the project root. */
  root: string;
}

const PLUGIN_NAME = "NitroVfsPlugin";

/**
 * In-memory virtual file system plugin for rspack.
 *
 * Each registered module is exposed under `<root>/<safe-id>.js` and served by intercepting
 * `compiler.inputFileSystem`. Pair with `experiments.useInputFileSystem` so rspack's native
 * (Rust) filesystem layer also routes matching paths through the JS overrides.
 *
 * Aliases (`<id>$ → vfs path`) returned by `getAliases()` should be added to `resolve.alias`
 * so virtual ids resolve directly to the VFS-backed paths.
 */
export class NitroVfsPlugin implements RspackPluginInstance {
  readonly root: string;
  private modules: Map<string, VfsModule>;
  private cache = new Map<string, string>();

  constructor(opts: VfsPluginOptions) {
    this.root = opts.root;
    this.modules = new Map(opts.modules.map((m) => [m.id, m]));
  }

  pathFor(id: string): string {
    const safe = id.replace(/^#nitro\//, "").replace(/[^a-zA-Z0-9/_.-]/g, "_");
    return `${this.root}/${safe}.js`;
  }

  /**
   * Eagerly register a rendered module. Unlike `setModule` + `preload`, this fills the
   * in-memory cache immediately so the result is readable from the next `inputFileSystem`
   * call — useful for hooks (e.g. raw: scheme) that synthesize modules mid-build.
   *
   * Returns the VFS path the rendered content is served from.
   */
  setRendered(id: string, content: string): string {
    this.modules.set(id, { id, template: content });
    const path = this.pathFor(id);
    this.cache.set(path, content);
    return path;
  }

  /** Render all templates into memory. Call before the first compilation. */
  async preload(): Promise<void> {
    this.cache.clear();
    for (const [id, mod] of this.modules) {
      const content = typeof mod.template === "function" ? await mod.template() : mod.template;
      this.cache.set(this.pathFor(id), content || "");
    }
  }

  /** Add a (or overwrite an existing) module — useful for dev mode hot updates. */
  setModule(id: string, template: VfsTemplate): void {
    this.modules.set(id, { id, template });
  }

  getAliases(): Record<string, string> {
    const aliases: Record<string, string> = {};
    for (const id of this.modules.keys()) {
      aliases[`${id}$`] = this.pathFor(id);
    }
    return aliases;
  }

  /** Snapshot of rendered contents (id → source). Useful to seed `nitro.vfs`. */
  getContents(): Map<string, string> {
    const out = new Map<string, string>();
    for (const id of this.modules.keys()) {
      out.set(id, this.cache.get(this.pathFor(id)) ?? "");
    }
    return out;
  }

  /** Returns true if the given path is owned by this VFS. */
  has(path: string): boolean {
    return this.cache.has(path);
  }

  /** Read the rendered content for a path. Undefined if the path is not in this VFS. */
  read(path: string): string | undefined {
    return this.cache.get(path);
  }

  /** Regex usable for `experiments.useInputFileSystem` so rspack routes matching paths to JS FS. */
  get fsPattern(): RegExp {
    return new RegExp("^" + escapeRegex(this.root) + "(?:/|$)");
  }

  apply(compiler: Compiler): void {
    compiler.hooks.beforeRun.tapPromise(PLUGIN_NAME, () => this.preload());
    compiler.hooks.watchRun.tapPromise(PLUGIN_NAME, () => this.preload());

    const original = compiler.inputFileSystem as unknown as InputFileSystem | null;
    if (!original) return;

    compiler.inputFileSystem = wrapInputFileSystem(
      original,
      this
    ) as unknown as Compiler["inputFileSystem"];
  }
}

function wrapInputFileSystem(original: InputFileSystem, vfs: NitroVfsPlugin): InputFileSystem {
  const isVfs = (p: unknown): p is string => typeof p === "string" && p.startsWith(vfs.root);

  const stat = (path: string): IStats => statFor(vfs.read(path) ?? "");

  const enoent = (path: string): NodeJS.ErrnoException => {
    const err = new Error(`ENOENT: no such file or directory, '${path}'`) as NodeJS.ErrnoException;
    err.code = "ENOENT";
    err.errno = -2;
    err.syscall = "stat";
    err.path = path;
    return err;
  };

  const wrapped: InputFileSystem = {
    ...original,
    readFile: ((path: any, ...rest: any[]) => {
      const cb = rest[rest.length - 1] as (
        err: NodeJS.ErrnoException | null,
        data?: string | Buffer
      ) => void;
      if (isVfs(path)) {
        const content = vfs.read(path);
        if (content !== undefined) {
          return cb(null, Buffer.from(content, "utf8"));
        }
        return cb(enoent(path));
      }
      return original.readFile.apply(original, [path, ...rest] as Parameters<
        InputFileSystem["readFile"]
      >);
    }) as InputFileSystem["readFile"],
    stat: ((path: any, ...rest: any[]) => {
      const cb = rest[rest.length - 1] as (
        err: NodeJS.ErrnoException | null,
        stats?: IStats
      ) => void;
      if (isVfs(path)) {
        return vfs.has(path) ? cb(null, stat(path)) : cb(enoent(path));
      }
      return original.stat.apply(original, [path, ...rest] as Parameters<InputFileSystem["stat"]>);
    }) as InputFileSystem["stat"],
  };

  if (original.readFileSync) {
    wrapped.readFileSync = ((path: any, ...rest: any[]) => {
      if (isVfs(path)) {
        const content = vfs.read(path);
        if (content !== undefined) return Buffer.from(content, "utf8");
        throw enoent(path);
      }
      return (original.readFileSync as any).apply(original, [path, ...rest]);
    }) as InputFileSystem["readFileSync"];
  }

  if (original.statSync) {
    wrapped.statSync = ((path: any, ...rest: any[]) => {
      if (isVfs(path)) {
        if (vfs.has(path)) return stat(path);
        throw enoent(path);
      }
      return (original.statSync as any).apply(original, [path, ...rest]);
    }) as InputFileSystem["statSync"];
  }

  if (original.lstat) {
    wrapped.lstat = ((path: any, ...rest: any[]) => {
      const cb = rest[rest.length - 1] as (
        err: NodeJS.ErrnoException | null,
        stats?: IStats
      ) => void;
      if (isVfs(path)) {
        return vfs.has(path) ? cb(null, stat(path)) : cb(enoent(path));
      }
      return (original.lstat as any).apply(original, [path, ...rest]);
    }) as InputFileSystem["lstat"];
  }

  if (original.lstatSync) {
    wrapped.lstatSync = ((path: any, ...rest: any[]) => {
      if (isVfs(path)) {
        if (vfs.has(path)) return stat(path);
        throw enoent(path);
      }
      return (original.lstatSync as any).apply(original, [path, ...rest]);
    }) as InputFileSystem["lstatSync"];
  }

  if (original.realpath) {
    wrapped.realpath = ((path: any, ...rest: any[]) => {
      const cb = rest[rest.length - 1] as (
        err: NodeJS.ErrnoException | null,
        resolvedPath?: string
      ) => void;
      if (isVfs(path)) return cb(null, path);
      return (original.realpath as any).apply(original, [path, ...rest]);
    }) as InputFileSystem["realpath"];
  }

  if (original.realpathSync) {
    wrapped.realpathSync = ((path: any, ...rest: any[]) => {
      if (isVfs(path)) return path;
      return (original.realpathSync as any).apply(original, [path, ...rest]);
    }) as InputFileSystem["realpathSync"];
  }

  return wrapped;
}

function statFor(content: string): IStats {
  const size = Buffer.byteLength(content, "utf8");
  const now = new Date(0);
  return {
    isFile: () => true,
    isDirectory: () => false,
    isBlockDevice: () => false,
    isCharacterDevice: () => false,
    isSymbolicLink: () => false,
    isFIFO: () => false,
    isSocket: () => false,
    dev: 0,
    ino: 0,
    mode: 0o100_644,
    nlink: 1,
    uid: 0,
    gid: 0,
    rdev: 0,
    size,
    blksize: 4096,
    blocks: 0,
    atimeMs: 0,
    mtimeMs: 0,
    ctimeMs: 0,
    birthtimeMs: 0,
    atime: now,
    mtime: now,
    ctime: now,
    birthtime: now,
  };
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
