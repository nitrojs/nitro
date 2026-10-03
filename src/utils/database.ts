import { connectorDependencies, connectors } from "db0";
import type { ConnectorName } from "db0";
import type { NitroOptions } from "nitro/types";
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
}

/** Resolve database connections that will be used for the current build. */
export function resolveDatabaseConnections(options: NitroOptions): DatabaseConnection[] {
  if (!options.experimental.database) {
    return [];
  }
  const configs = (options.dev && options.devDatabase) || options.database;
  return Object.entries(configs || {})
    .filter(([, config]) => !!config?.connector)
    .map(([name, { connector, options: connectorOpts }]) => {
      const module = connectors[connector as ConnectorName];
      if (!module) {
        throw new Error(`Database connector "${connector}" is invalid.`);
      }
      return { name, connector, module, options: connectorOpts || {} };
    });
}

/**
 * Third-party dependencies of a connector.
 *
 * Since `db0` v0.4, they are not declared as optional peer dependencies anymore.
 */
export function resolveConnectorDeps(name: string): LibDep[] {
  const deps = connectorDependencies[name as ConnectorName];
  return Object.entries(deps || {}).map(([option, dep]) => ({ option, ...dep }));
}
