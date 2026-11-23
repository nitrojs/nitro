import type { SourceMap } from "node:module";
import type { StackFrame } from "./_stack.ts";

interface LoadedSourceMap {
  map: SourceMap;
  url: URL;
  sourceRoot?: string;
  sources: string[];
  sourcesContent: (string | null)[];
}

/**
 * Create a function that maps `app` frames to their original location using the source map of the
 * generated file (`<file>.map` or a `sourceMappingURL` comment).
 *
 * Parsed source maps are cached for the lifetime of the returned function.
 */
export function createSourceMapper(): (frame: StackFrame) => Promise<void> {
  const cache = new Map<string, Promise<LoadedSourceMap | undefined>>();
  return async (frame) => {
    if (frame.type !== "app" || !frame.file || !frame.line || !frame.col) {
      return;
    }
    let loaded = cache.get(frame.file);
    if (!loaded) {
      loaded = loadSourceMap(frame.file).catch(() => undefined);
      cache.set(frame.file, loaded);
    }
    const sourceMap = await loaded;
    if (!sourceMap) {
      return;
    }
    const entry = sourceMap.map.findEntry(frame.line - 1, frame.col - 1);
    if (
      !("originalSource" in entry) ||
      !entry.originalSource ||
      entry.generatedLine !== frame.line - 1
    ) {
      return;
    }
    frame.file = resolveSourcePath(entry.originalSource, sourceMap.sourceRoot, sourceMap.url);
    frame.line = entry.originalLine + 1;
    frame.col = entry.originalColumn + 1;
    const content = sourceMap.sourcesContent[sourceMap.sources.indexOf(entry.originalSource)];
    frame.source = typeof content === "string" ? content : undefined;
  };
}

/** Read the original source of a frame (from the source map, or from disk). */
export async function readFrameSource(frame: StackFrame): Promise<string | undefined> {
  if (frame.source !== undefined) {
    return frame.source;
  }
  if (!frame.file || frame.type === "native") {
    return;
  }
  return globalThis.process
    .getBuiltinModule("node:fs")
    .promises.readFile(frame.file.replace(/\?.*$/, ""), "utf8")
    .catch(() => undefined);
}

async function loadSourceMap(file: string): Promise<LoadedSourceMap | undefined> {
  const { promises: fs } = globalThis.process.getBuiltinModule("node:fs");
  const { pathToFileURL } = globalThis.process.getBuiltinModule("node:url");
  const fileURL = pathToFileURL(file);
  let url = new URL(fileURL.href + ".map");
  let raw = await fs.readFile(url, "utf8").catch(() => undefined);
  if (!raw) {
    const code = await fs.readFile(fileURL, "utf8").catch(() => "");
    const ref = code.match(/\/\/[#@] sourceMappingURL=(\S+)\s*$/)?.[1];
    if (!ref) {
      return;
    }
    if (ref.startsWith("data:")) {
      url = fileURL;
      raw = decodeDataURL(ref);
    } else {
      url = new URL(ref, fileURL);
      raw = await fs.readFile(url, "utf8");
    }
  }
  const payload = JSON.parse(raw);
  const { SourceMap } = globalThis.process.getBuiltinModule("node:module");
  return {
    map: new SourceMap(payload),
    url,
    sourceRoot: payload.sourceRoot,
    sources: payload.sources || [],
    sourcesContent: payload.sourcesContent || [],
  };
}

const LEADING_C0_SPACE_RE = /^[\u0000-\u0020]+/;
const WINDOWS_DRIVE_RE = /^[a-z]:(?:[\\/]|$)/i;
const WINDOWS_PATH_RE = /^(?:[a-z]:[\\/]|\\\\)/i;
const UNC_ROOT_RE = /^[\\/]{2}([^\\/]+)(?:[\\/]([^\\/]+))?([\\/].*)?$/;
const DOUBLE_SLASH_RE = /^[\\/]{2}/;
const URL_SCHEME_RE = /^[a-z][a-z\d+\-.]+:/i;
const HIERARCHICAL_URL_RE = /^[a-z][a-z\d+\-.]+:\/\//i;
const FILE_SCHEME_RE = /^file:/i;

function resolveSourcePath(source: string, sourceRoot: string | undefined, mapURL: URL): string {
  if (source.startsWith("\0")) {
    return source;
  }
  const cleanSource =
    source.charCodeAt(0) <= 0x20 ? source.replace(LEADING_C0_SPACE_RE, "") : source;
  if (WINDOWS_PATH_RE.test(cleanSource)) {
    return cleanSource;
  }
  if (URL_SCHEME_RE.test(cleanSource)) {
    return FILE_SCHEME_RE.test(cleanSource)
      ? (safeFileURLToPath(cleanSource) ?? cleanSource)
      : cleanSource;
  }
  if (sourceRoot?.startsWith("\0")) {
    return (
      (sourceRoot.endsWith(":") || sourceRoot.endsWith("/") ? sourceRoot : `${sourceRoot}/`) +
      source
    );
  }
  const root =
    sourceRoot && sourceRoot.charCodeAt(0) <= 0x20
      ? sourceRoot.replace(LEADING_C0_SPACE_RE, "")
      : sourceRoot;
  if (root && URL_SCHEME_RE.test(root) && !FILE_SCHEME_RE.test(root)) {
    if (!HIERARCHICAL_URL_RE.test(root)) {
      return (root.endsWith(":") || root.endsWith("/") ? root : `${root}/`) + source;
    }
    try {
      return new URL(cleanSource, toBaseURL(root)).href;
    } catch {
      return withTrailingSlash(root) + source;
    }
  }
  if (DOUBLE_SLASH_RE.test(cleanSource)) {
    return cleanSource;
  }
  if (root && WINDOWS_DRIVE_RE.test(root)) {
    return resolvePrefixedPath(root.slice(0, 2), root.slice(2) || "/", cleanSource, source);
  }
  const uncMatch = root ? UNC_ROOT_RE.exec(root) : null;
  if (uncMatch) {
    const prefix = uncMatch[2] ? `//${uncMatch[1]}/${uncMatch[2]}` : `//${uncMatch[1]}`;
    return resolvePrefixedPath(prefix, uncMatch[3] || "/", cleanSource, source);
  }
  let base = mapURL;
  let rootFallback: string | undefined;
  if (root) {
    try {
      if (FILE_SCHEME_RE.test(root)) {
        base = toBaseURL(root);
      } else {
        rootFallback = withTrailingSlash(root, true);
        base = new URL(escapeURLPath(rootFallback), mapURL);
      }
      if (base.protocol !== "file:") {
        return (rootFallback ?? withTrailingSlash(root, true)) + source;
      }
    } catch {
      return (rootFallback ?? withTrailingSlash(root, true)) + source;
    }
  }
  try {
    const resolved = new URL(escapeURLPath(cleanSource), base);
    return resolved.protocol === "file:"
      ? (safeFileURLToPath(resolved) ?? (root ? resolved.href : source))
      : source;
  } catch {
    return root ? (rootFallback ?? withTrailingSlash(root, true)) + source : source;
  }
}

function resolvePrefixedPath(
  prefix: string,
  rootPath: string,
  cleanSource: string,
  rawSource: string
): string {
  const normalizedRoot = withTrailingSlash(rootPath.replace(/\\/g, "/").replace(/^\/+/, "/"));
  try {
    const resolved = new URL(
      escapeURLPath(cleanSource.replace(/\\/g, "/")),
      new URL(escapeURLPath(normalizedRoot), "file:///")
    );
    return resolved.protocol === "file:" && !resolved.hostname
      ? prefix + decodeURIComponent(resolved.pathname)
      : rawSource;
  } catch {
    return prefix + normalizedRoot + rawSource;
  }
}

function withTrailingSlash(path: string, allowBackslash = false): string {
  let end = path.length;
  while (
    end > 0 &&
    (path.charCodeAt(end - 1) === 47 || (allowBackslash && path.charCodeAt(end - 1) === 92))
  ) {
    end--;
  }
  return path.slice(0, end) + "/";
}

function toBaseURL(url: string): URL {
  const base = new URL(url);
  base.search = "";
  base.hash = "";
  if (!base.pathname.endsWith("/")) {
    base.pathname += "/";
  }
  return base;
}

function safeFileURLToPath(url: string | URL): string | undefined {
  try {
    return globalThis.process?.getBuiltinModule?.("node:url")?.fileURLToPath(url);
  } catch {
    return undefined;
  }
}

// Sources may contain URL special chars (e.g. `#nitro/virtual/app`)
function escapeURLPath(path: string): string {
  return path.replace(/[%#?\t\n\r]/g, (c) => encodeURIComponent(c));
}

function decodeDataURL(url: string): string {
  const comma = url.indexOf(",");
  const data = url.slice(comma + 1);
  if (!url.slice(0, comma).endsWith(";base64")) {
    return decodeURIComponent(data);
  }
  return new TextDecoder().decode(Uint8Array.from(atob(data), (c) => c.charCodeAt(0)));
}
