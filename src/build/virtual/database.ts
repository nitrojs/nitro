import type { Nitro } from "nitro/types";
import { camelCase } from "scule";
import { resolveConnectorDeps, resolveDatabaseConnections } from "../../utils/database.ts";
import type { DatabaseConnection } from "../../utils/database.ts";
import { isDepInstalled, isLibOption } from "../../utils/dep.ts";

export default function database(nitro: Nitro) {
  return {
    id: "#nitro/virtual/database",
    template: () => {
      const connections = resolveDatabaseConnections(nitro.options);

      if (connections.length === 0) {
        return /* js */ `export const connectionConfigs = {};`;
      }

      const connectorImports = new Map(connections.map((c) => [c.connector, c.module]));

      return /* js */ `
${[...connectorImports]
  .map(([name, module]) => /* js */ `import ${camelCase(name)}Connector from "${module}";`)
  .join("\n")}

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
  const libs = resolveConnectorDeps(connection.connector)
    .filter(
      (dep) =>
        isLibOption(dep.option) &&
        connection.options[dep.option] === undefined &&
        isDepInstalled(dep.name, nitro.options.rootDir)
    )
    .map((dep) => `${dep.option}: () => import(${JSON.stringify(dep.name)})`);

  const options = JSON.stringify(connection.options);
  return libs.length > 0 ? `{ ...${options}, ${libs.join(", ")} }` : options;
}
