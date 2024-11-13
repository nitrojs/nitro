import type { NitroOptions } from "nitropack/types";

export async function resolveDatabaseOptions(options: NitroOptions) {
  if (options.experimental.database && options.imports) {
    options.imports.presets.push({
      from: "nitropack/runtime/internal/database",
      imports: ["useDatabase"],
    });
    if (options.dev && !options.database && !options.devDatabase) {
      options.devDatabase = {
        default: {
          connector: "sqlite",
          options: {
            cwd: options.rootDir,
          },
        },
      };
    } else if (options.node && !options.database) {
      options.database = {
        default: {
          connector: "sqlite",
          options: {},
        },
      };
    }
  }
}
