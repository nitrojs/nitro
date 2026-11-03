import type { Nitro, NitroEventHandler } from "nitro/types";
import mime from "mime";

// prettier-ignore
const methodSuffixes = new Set(["connect", "delete", "get", "head", "options", "patch", "post", "put", "query", "trace"]);
const envSuffixes = new Set(["dev", "prod", "prerender"]);

const lastSuffixRe = /(?<=[^/])\.([a-z]+)$/;
const orderPrefixRe = /(?:^|\/)\d+$/;

export type ScanSuffixOptions = {
  /** Allow a `.<method>` suffix (e.g. `.get`). */
  method?: boolean;
  /** Allow a `.<env>` suffix (e.g. `.dev`), placed after the method suffix. */
  env?: boolean;
};

export type ParsedScanPath = {
  /** File path without its extension and Nitro suffixes. */
  name: string;
  method?: NitroEventHandler["method"];
  env?: "dev" | "prod" | "prerender";
};

/**
 * Splits Nitro suffixes (`.<method>.<env>`) from a scanned file path.
 *
 * Any other trailing lowercase suffix is reserved for Nitro, unless it is a known file extension
 * (`.json`, `.md`, ...), listed in `scanSuffixes` or the name after a numeric order prefix
 * (`middleware/1.cors.ts`). Files with a reserved suffix are rejected
 * (logged and skipped in dev, thrown in builds).
 */
export function parseScanPath(
  nitro: Nitro,
  file: { dir: string; path: string },
  opts: ScanSuffixOptions = {}
): ParsedScanPath | undefined {
  const result: ParsedScanPath = { name: file.path.replace(/\.[A-Za-z]+$/, "") };

  const env = result.name.match(lastSuffixRe)?.[1];
  if (opts.env && env && envSuffixes.has(env)) {
    result.env = env as ParsedScanPath["env"];
    result.name = result.name.slice(0, -env.length - 1);
  }

  const method = result.name.match(lastSuffixRe)?.[1];
  if (opts.method && method && methodSuffixes.has(method)) {
    result.method = method as ParsedScanPath["method"];
    result.name = result.name.slice(0, -method.length - 1);
  }

  // A method or env word before the parsed suffixes stays literal (`foo.get.get.ts` -> `/foo.get`).
  const suffix = result.name.match(lastSuffixRe)?.[1];
  if (
    !suffix ||
    (opts.method && methodSuffixes.has(suffix)) ||
    (opts.env && envSuffixes.has(suffix)) ||
    mime.getType(suffix) ||
    nitro.options.scanSuffixes?.includes(suffix) ||
    (!methodSuffixes.has(suffix) &&
      !envSuffixes.has(suffix) &&
      orderPrefixRe.test(result.name.slice(0, -suffix.length - 1)))
  ) {
    return result;
  }

  const filePath = `${file.dir}/${file.path}`;
  const message =
    methodSuffixes.has(suffix) || envSuffixes.has(suffix)
      ? `The \`.${suffix}\` suffix is not supported in \`${file.dir}/\` (\`${filePath}\`).`
      : `Unknown suffix \`.${suffix}\` in \`${filePath}\`. Nitro reserves dotted suffixes in scanned file names; known file extensions (e.g. \`.json\`, \`.md\`) are kept as-is. Add \`"${suffix}"\` to the \`scanSuffixes\` config to keep it as part of the name.`;

  if (nitro.options.dev) {
    nitro.logger.error(`${message} The file is ignored.`);
    return;
  }
  throw new Error(message);
}
