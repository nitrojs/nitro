import type { NitroOptions } from "nitro/types";
import { escapeRegExp } from "./regex.ts";

type SourceExtensionOptions = Pick<NitroOptions, "sourceExtensions">;

const moduleExtensions = {
  js: [".js", ".mjs", ".cjs", ".jsx"],
  ts: [".ts", ".mts", ".cts", ".tsx"],
};

export const TS_SOURCE_EXTENSIONS = [...moduleExtensions.ts];

export const BASE_SOURCE_EXTENSIONS = [...moduleExtensions.js, ...moduleExtensions.ts];

export function normalizeSourceExtensions(extensions: string[] = []) {
  return extensions
    .map((ext) => ext.trim())
    .filter((ext) => {
      const trimmedExt = ext.trim();
      const isEmpty = trimmedExt.length === 0;
      const isInvalid = isEmpty || trimmedExt === ".";
      return !isInvalid;
    })
    .map((ext) => (ext.startsWith(".") ? ext : `.${ext}`));
}

export function getSourceExtensions(
  { sourceExtensions }: SourceExtensionOptions,
  baseExtensions = BASE_SOURCE_EXTENSIONS
) {
  return [...new Set([...baseExtensions, ...normalizeSourceExtensions(sourceExtensions)])];
}

export function getSourceExtensionPattern(
  { sourceExtensions }: SourceExtensionOptions,
  baseExtensions = BASE_SOURCE_EXTENSIONS
) {
  return getSourceExtensions({ sourceExtensions }, baseExtensions)
    .map((ext) => escapeRegExp(ext.slice(1)))
    .join("|");
}

export function getScanPattern(options: SourceExtensionOptions) {
  const extensionPattern = getSourceExtensions(options)
    .map((ext) => ext.slice(1))
    .join(",");
  return `**/*.{${extensionPattern}}`;
}

export function stripSourceExtension(
  id: string,
  options: SourceExtensionOptions,
  baseExtensions = BASE_SOURCE_EXTENSIONS
) {
  const ext = getSourceExtensions(options, baseExtensions)
    .sort((a, b) => b.length - a.length)
    .find((ext) => id.endsWith(ext));
  return ext ? id.slice(0, -ext.length) : id;
}
