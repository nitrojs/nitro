import type { ConnectorName } from "db0";
import type { NitroDepsOptions, NitroOptions } from "nitro/types";
import { importDep } from "./dep.ts";
import type { LibDep } from "./dep.ts";

export interface DatabaseConnection {
  /** Logical connection name. */
  name: string;
  /** Connector name as configured by the user. */
  connector: string;
  /** Module id to import the connector from. */
  module: string;
  /** Connector options. */
  options: Record<string, any>;
  /**
   * Third-party dependencies of the connector.
   *
   * Since `db0` v0.4, they are not declared as optional peer dependencies anymore.
   */
  deps: LibDep[];
}

/** Resolve database connections that will be used for the current build (`db0` is imported on demand). */
export async function resolveDatabaseConnections(
  options: NitroOptions
): Promise<DatabaseConnection[]> {
  if (!options.experimental.database) {
    return [];
  }
  const configs = (options.dev && options.devDatabase) || options.database;
  const entries = Object.entries(configs || {}).filter(([, config]) => !!config?.connector);
  if (entries.length === 0) {
    return [];
  }
  const { connectors, connectorDependencies } = await importDb0({
    dir: options.rootDir,
    deps: options.deps,
    reason: "the `database` config",
  });
  return entries.map(([name, { connector, options: connectorOpts }]) => {
    const module = connectors[connector as ConnectorName];
    if (!module) {
      throw new Error(`Database connector "${connector}" is invalid.`);
    }
    const deps = Object.entries(connectorDependencies[connector as ConnectorName] || {}).map(
      ([option, dep]) => ({ option, ...dep })
    );
    return { name, connector, module, options: connectorOpts || {}, deps };
  });
}

/** Import `db0` from the project, installing it on demand. */
export function importDb0(opts: {
  dir: string;
  deps?: NitroDepsOptions;
  reason: string;
}): Promise<typeof import("db0")> {
  return importDep({ id: "db0", ...opts });
}
