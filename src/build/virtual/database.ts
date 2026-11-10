import type { Nitro } from "nitro/types";
import { camelCase } from "scule";
import { resolveDatabaseConnections } from "../../utils/database.ts";
import type { DatabaseConnection } from "../../utils/database.ts";
import { isDepInstalled, isLibOption } from "../../utils/dep.ts";

export default function database(nitro: Nitro) {
  return {
    id: "#nitro/virtual/database",
    template: async () => {
      const connections = await resolveDatabaseConnections(nitro.options);

      if (connections.length === 0) {
        return /* js */ `export const connectionConfigs = {};\nexport const traceDatabase = (db) => db;`;
      }

      const tracingEnabled =
        typeof nitro.options.tracingChannel === "object" && !!nitro.options.tracingChannel.db0;

      const connectorImports = new Map(connections.map((c) => [c.connector, c.module]));

      return /* js */ `
${[...connectorImports]
  .map(([name, module]) => /* js */ `import ${camelCase(name)}Connector from "${module}";`)
  .join("\n")}
${
  tracingEnabled
    ? /* js */ `export { withTracing as traceDatabase } from "db0/tracing";`
    : /* js */ `export const traceDatabase = (db) => db;`
}

export const connectionConfigs = {
  ${connections
    .map(
      (c) => /* js */ `${c.name}: {
          connector: ${camelCase(c.connector)}Connector,
          options: ${genConnectorOptions(nitro, c)}
        }`
    )
    .join(",\n")}
};
        `;
    },
  };
}

/**
 * Explicitly provide third-party libraries used by the connector via the `lib` option
 * so that they are statically analyzable by the bundler.
 */
function genConnectorOptions(nitro: Nitro, connection: DatabaseConnection) {
  const libs = connection.deps
    .filter(
      (dep) =>
        isLibOption(dep.option) &&
        connection.options[dep.option] === undefined &&
        isDepInstalled(dep.name, { dir: nitro.options.rootDir, projectOnly: true })
    )
    .map((dep) => `${dep.option}: () => import(${JSON.stringify(dep.import || dep.name)})`);

  const options = JSON.stringify(connection.options);
  return libs.length > 0 ? `{ ...${options}, ${libs.join(", ")} }` : options;
}
