import { createSourceMapper } from "./_sourcemap.ts";

export interface StackFrame {
  raw: string;
  type: "app" | "module" | "native";
  fn?: string;
  file?: string;
  line?: number;
  col?: number;
  async?: boolean;
  /** Original source contents (from source map `sourcesContent`) */
  source?: string;
}

const framesCache = new WeakMap<object, StackFrame[]>();

/**
 * Apply source maps to the stack frames of `error` (and of its `cause` / `errors`).
 *
 * `error.stack` is rewritten with the original locations and the parsed frames are kept for renderers.
 */
export async function loadStackTrace(error: unknown): Promise<void> {
  const mapper = createSourceMapper();
  const queue: unknown[] = [error];
  const seen = new Set<unknown>();
  while (queue.length > 0) {
    const err = queue.shift();
    if (!(err instanceof Error) || seen.has(err)) {
      continue;
    }
    seen.add(err);
    queue.push(err.cause, ...(err instanceof AggregateError ? err.errors : []));
    if (framesCache.has(err) || typeof err.stack !== "string") {
      continue;
    }
    const frames = parseStack(err.stack);
    for (const frame of frames) {
      await mapper(frame).catch(() => {});
      frame.type = frameType(frame.file);
    }
    framesCache.set(err, frames);
    if (frames.length > 0) {
      const stack = err.message + "\n" + frames.map((frame) => formatFrame(frame)).join("\n");
      try {
        Object.defineProperty(err, "stack", { value: stack });
      } catch {}
    }
  }
}

/** Get the (source-mapped, when `loadStackTrace` ran) frames of an error. */
export function getFrames(error: unknown): StackFrame[] {
  if (!(error instanceof Error)) {
    return [];
  }
  return framesCache.get(error) || parseStack(error.stack || "");
}

/** Parse the frames of a V8 formatted `error.stack` (header lines are skipped). */
export function parseStack(stack: string): StackFrame[] {
  const lines = stack.split("\n");
  const start = lines.findIndex((line) => FRAME_RE.test(line));
  if (start === -1) {
    return [];
  }
  return lines
    .slice(start)
    .filter((line) => line.trim())
    .map((line) => parseFrame(line));
}

export function parseFrame(raw: string): StackFrame {
  const match = raw.match(FRAME_RE);
  if (!match) {
    return { raw, type: "native" };
  }
  const isAsync = !!match[1];
  const fn = match[2];
  let location = match[3] ?? match[4] ?? "";
  if (location.startsWith("eval at ")) {
    location = location.match(/\((.+?:\d+:\d+)\)/)?.[1] || location;
  }
  const loc = location.match(/^(.+?)(?::(\d+))?(?::(\d+))?$/);
  const frame: StackFrame = { raw, type: "native", fn, async: isAsync || undefined };
  if (loc && loc[2] && /[/\\]/.test(loc[1]!)) {
    frame.file = toPath(loc[1]!);
    frame.line = Number(loc[2]);
    frame.col = loc[3] ? Number(loc[3]) : undefined;
  }
  frame.type = frameType(frame.file);
  return frame;
}

export function formatFrame(frame: StackFrame): string {
  if (frame.type === "native" || !frame.file) {
    return frame.raw;
  }
  const location = [frame.file, frame.line, frame.col].filter((v) => v !== undefined).join(":");
  const prefix = frame.async ? "    at async " : "    at ";
  return frame.fn ? `${prefix}${frame.fn} (${location})` : `${prefix}${location}`;
}

export function frameType(file: string | undefined): StackFrame["type"] {
  if (!file || /^(node|ext|bun|deno):/.test(file)) {
    return "native";
  }
  // Dot directories (e.g. `node_modules/.nitro` build dir) hold generated app code
  return /[/\\]node_modules[/\\](?!\.)/.test(file) ? "module" : "app";
}

/** Short path for display: package-relative for dependencies, otherwise see {@link relativePath}. */
export function displayPath(file: string): string {
  const pkgPath = file.split(/[/\\]node_modules[/\\]/).pop()!;
  if (pkgPath !== file && !pkgPath.startsWith(".")) {
    return pkgPath.replace(/\\/g, "/");
  }
  return relativePath(file);
}

/** Format a path relative to the current working directory (when inside it). */
export function relativePath(file: string): string {
  const cwd = globalThis.process?.cwd?.();
  if (cwd && file.startsWith(cwd) && /^[/\\]/.test(file.slice(cwd.length))) {
    return "." + file.slice(cwd.length);
  }
  return file;
}

const FRAME_RE = /^\s*at (async )?(?:(.+?) \((.*)\)|(.*))$/;

function toPath(file: string): string {
  if (!file.startsWith("file:")) {
    return file;
  }
  try {
    const { fileURLToPath } = globalThis.process.getBuiltinModule("node:url");
    return fileURLToPath(file);
  } catch {
    return file;
  }
}
