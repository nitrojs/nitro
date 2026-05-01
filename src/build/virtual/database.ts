import { connectors } from "db0";
import type { Nitro } from "nitro/types";
import { camelCase } from "scule";

export default function database(nitro: Nitro) {
  return {
    id: "#nitro/virtual/database",
    template: () => {
      if (!nitro.options.experimental.database) {
        return /* js */ `export const connectionConfigs = {};`;
      }

      const dbConfigs = (nitro.options.dev && nitro.options.devDatabase) || nitro.options.database;

      const connectorsNames = [
        ...new Set(Object.values(dbConfigs || {}).map((config) => config?.connector)),
      ].filter(Boolean);

      for (const name of connectorsNames) {
        if (!connectors[name]) {
          throw new Error(`Database connector "${name}" is invalid.`);
        }
      }

      return /* js */ `
${connectorsNames
  .map((name) => /* js */ `import ${camelCase(name)}Connector from "${connectors[name]}";`)
  .join("\n")}

export const connectionConfigs = {
  ${Object.entries(dbConfigs || {})
    .filter(([, config]) => !!config?.connector)
    .map(
      ([name, { connector, options }]) => /* js */ `${name}: {
          connector: ${camelCase(connector)}Connector,
          options: ${JSON.stringify(options)}
        }`
    )
    .join(",\n")}
};
        `;
    },
  };
}
