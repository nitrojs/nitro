import type { NitroOptions, NitroServiceConfig } from "nitro/types";
import { resolveModulePath } from "exsolve";
import { isAbsolute, resolve } from "pathe";

export const SERVICE_EXTENSIONS = [".ts", ".js", ".mts", ".mjs", ".tsx", ".jsx"];

export function resolveServicesOptions(options: NitroOptions) {
  options.services = resolveServices(options, options.services);
}

/** Resolves the path entries of services (bare specifiers are resolved by the builder). */
export function resolveServices(
  options: Pick<NitroOptions, "rootDir" | "scanDirs">,
  services: Record<string, NitroServiceConfig> | undefined
): Record<string, NitroServiceConfig> {
  return Object.fromEntries(
    Object.entries(services || {}).map(([name, service]) => {
      if (typeof service?.entry !== "string") {
        throw new TypeError(`Service \`${name}\` must have an \`entry\` (path to a server entry).`);
      }
      const entry = isPath(service.entry)
        ? resolveServiceEntry(options, service.entry)
        : service.entry;
      return [name, { ...service, entry }];
    })
  );
}

/** Resolves a service entry from the root and scan directories (with or without extension). */
export function resolveServiceEntry(
  options: Pick<NitroOptions, "rootDir" | "scanDirs">,
  entry: string
): string {
  return (
    resolveModulePath(entry, {
      from: [options.rootDir, ...options.scanDirs],
      extensions: SERVICE_EXTENSIONS,
      suffixes: ["", "/index"],
      try: true,
    }) || (entry.startsWith(".") ? resolve(options.rootDir, entry) : entry)
  );
}

function isPath(entry: string): boolean {
  return entry.startsWith(".") || isAbsolute(entry);
}
