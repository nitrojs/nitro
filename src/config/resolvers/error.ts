import { runtimeDir } from "nitro/meta";
import type { NitroOptions } from "nitro/types";
import { join } from "pathe";
import { resolveNitroPath } from "../../utils/fs.ts";

export async function resolveErrorOptions(options: NitroOptions) {
  if (!options.errorHandler) {
    options.errorHandler = [];
  } else if (!Array.isArray(options.errorHandler)) {
    options.errorHandler = [options.errorHandler];
  }

  options.errorHandler = options.errorHandler.map((h) => resolveNitroPath(h, options));

  // Always add the default error handler as the last one
  options.errorHandler.push(join(runtimeDir, `internal/error/${options.dev ? "dev" : "prod"}`));
}
