import type { Nitro } from "nitro/types";
import { snakeCase } from "scule";
import { virtual } from "./virtual.ts";

export function runtimeConfig(nitro: Nitro) {
  return virtual(
    {
      "#nitro-internal-virtual/runtime-config": () => {
        // Generate code to set process.env from runtime config at runtime
        const envSetters: string[] = [];

        function generateEnvSetters(
          obj: Record<string, any>,
          prefix: string,
          parentKey = ""
        ) {
          for (const key in obj) {
            // Skip nitro internal config and app config
            if (key === "nitro" || key === "app") {
              continue;
            }

            const subKey = parentKey ? `${parentKey}_${key}` : key;
            const envKey = `${prefix}${snakeCase(subKey).toUpperCase()}`;

            if (
              obj[key] &&
              typeof obj[key] === "object" &&
              !Array.isArray(obj[key]) &&
              obj[key].constructor === Object
            ) {
              generateEnvSetters(obj[key], prefix, subKey);
            } else if (obj[key] !== undefined && obj[key] !== "") {
              const value =
                typeof obj[key] === "string"
                  ? JSON.stringify(obj[key])
                  : String(obj[key]);
              envSetters.push(`  process.env[${JSON.stringify(envKey)}] = ${value};`);
            }
          }
        }

        const envPrefix =
          nitro.options.runtimeConfig.nitro?.envPrefix ||
          process.env?.NITRO_ENV_PREFIX ||
          "NITRO_";

        generateEnvSetters(nitro.options.runtimeConfig, envPrefix);

        return /* js */ `
// Sync runtime config values to process.env at runtime
export function setupRuntimeEnv() {
${envSetters.join("\n")}
}
`;
      },
    },
    nitro.vfs
  );
}
