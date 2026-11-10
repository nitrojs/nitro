import type { NitroOptions } from "nitro/types";
import { resolveDatabaseConnections } from "../../utils/database.ts";
import { ensureLibDeps } from "../../utils/dep.ts";

export async function resolveDatabaseOptions(options: NitroOptions) {
  if (!options.experimental.database) {
    return;
  }

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
  // Make sure `db0` and the ones required by the configured connections are installed.
  await ensureLibDeps(
    (await resolveDatabaseConnections(options)).map((connection) => ({
      ...connection,
      name: connection.connector,
    })),
    { dir: options.rootDir, deps: options.deps, label: "database connector" }
  );
}
