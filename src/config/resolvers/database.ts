import type { NitroOptions } from "nitro/types";
import { resolveConnectorDeps, resolveDatabaseConnections } from "../../utils/database.ts";
import { ensureLibDeps } from "../../utils/dep.ts";

export async function resolveDatabaseOptions(options: NitroOptions) {
  if (!options.experimental.database || !options.imports) {
    return;
  }

  options.imports.presets ??= [];
  options.imports.presets.push({
    from: "nitro/database",
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

  // Database connectors lazily import their third-party dependencies.
  // Make sure the ones required by the configured connections are installed.
  await ensureLibDeps(
    resolveDatabaseConnections(options).map((connection) => ({
      name: connection.connector,
      options: connection.options,
      deps: resolveConnectorDeps(connection.connector),
    })),
    { dir: options.rootDir, label: "database connector" }
  );
}
