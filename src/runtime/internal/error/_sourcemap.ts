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
    const root = sourceMap.sourceRoot ? sourceMap.sourceRoot.replace(/\/?$/, "/") : "";
    frame.file = /^[a-z]:[\\/]/i.test(entry.originalSource)
      ? entry.originalSource
      : globalThis.process
          .getBuiltinModule("node:url")
          .fileURLToPath(new URL(escapeURLPath(root + entry.originalSource), sourceMap.url));
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

// Sources may contain URL special chars (e.g. `#nitro/virtual/app`)
function escapeURLPath(path: string): string {
  return path.replace(/[%#?]/g, (c) => encodeURIComponent(c));
}

function decodeDataURL(url: string): string {
  const comma = url.indexOf(",");
  const data = url.slice(comma + 1);
  if (!url.slice(0, comma).endsWith(";base64")) {
    return decodeURIComponent(data);
  }
  return new TextDecoder().decode(Uint8Array.from(atob(data), (c) => c.charCodeAt(0)));
}
