import { runtimeDir } from "nitropack/runtime/meta";
import type { NitroOptions } from "nitropack/types";
import { join } from "pathe";

export async function resolveErrorOptions(options: NitroOptions) {
  if (!options.errorHandler) {
    options.errorHandler = join(
      runtimeDir,
      `internal/error/${options.dev ? "dev" : "prod"}`
    );
  }
}
