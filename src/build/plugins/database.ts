import { connectors } from "db0";
import type { Nitro } from "nitro/types";
import { camelCase } from "scule";
import { virtual } from "./virtual";

export function database(nitro: Nitro) {
  if (!nitro.options.experimental.database) {
    return virtual(
      {
        "#nitro-internal-virtual/database": () => {
          return /* js */ `export const connectionConfigs = {};`;
        },
      },
      nitro.vfs
    );
  }

  const dbConfigs =
    (nitro.options.dev && nitro.options.devDatabase) || nitro.options.database;

  const connectorsNames = [
    ...new Set(
      Object.values(dbConfigs || {}).map((config) => config?.connector)
    ),
  ].filter(Boolean);

  for (const name of connectorsNames) {
    if (!connectors[name]) {
      throw new Error(`Database connector "${name}" is invalid.`);
    }
  }

  return virtual(
    {
      "#nitro-internal-virtual/database": () => {
        return `
${connectorsNames
  .map(
    (name) => `import ${camelCase(name)}Connector from "${connectors[name]}";`
  )
  .join("\n")}

export const connectionConfigs = {
  ${Object.entries(dbConfigs || {})
    .map(
      ([name, { connector, options }]) =>
        `${name}: {
          connector: ${camelCase(connector)}Connector,
          options: ${JSON.stringify(options)}
        }`
    )
    .join(",\n")}
};
        `;
      },
    },
    nitro.vfs
  );
}
