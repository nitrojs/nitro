import { runtimeDir } from "nitropack/runtime/meta";
import type { NitroOptions } from "nitropack/types";
import { join } from "pathe";

export async function resolveErrorOptions(options: NitroOptions) {
  if (!options.errorHandler) {
    options.errorHandler = [];
  } else if (!Array.isArray(options.errorHandler)) {
    options.errorHandler = [options.errorHandler];
  }

  // Always add the default error handler as the last one
  options.errorHandler.push(
    join(runtimeDir, `internal/error/${options.dev ? "dev" : "prod"}`)
  );
}
