import type { WranglerConfig } from "./types.ts";
import type { Nitro } from "nitro/types";
import { resolveModulePath } from "exsolve";

const RESOLVE_EXTENSIONS = [".ts", ".js", ".mts", ".mjs"];
const DEFAULT_DURABLE_BINDING_NAME = "$DurableObject";
const DEFAULT_DURABLE_INSTANCE_NAME = "server";

export function setupDurable(nitro: Nitro) {
  nitro.options.virtual["#nitro/virtual/cloudflare-durable"] = () => {
    const bindingName =
      nitro.options.cloudflare?.durable?.bindingName || DEFAULT_DURABLE_BINDING_NAME;
    const instanceName =
      nitro.options.cloudflare?.durable?.instanceName || DEFAULT_DURABLE_INSTANCE_NAME;
    const resolver = resolveDurableResolver(nitro);

    return /* js */ `
${resolver ? `export { default as resolveInstanceName } from ${JSON.stringify(resolver)};` : "export const resolveInstanceName = undefined;"}
export const bindingName = ${JSON.stringify(bindingName)};
export const instanceName = ${JSON.stringify(instanceName)};
`;
  };
}

export function configureDurable(nitro: Nitro, config: WranglerConfig) {
  const className = "$DurableObject";
  const bindingName =
    nitro.options.cloudflare?.durable?.bindingName || DEFAULT_DURABLE_BINDING_NAME;
  const environments = Object.values(config.env || {});
  for (const env of environments) {
    env.migrations ??= config.migrations;
    env.exports ??= config.exports;
  }

  for (const scope of [config, ...environments]) {
    scope.durable_objects ??= { bindings: [] };
    scope.durable_objects.bindings ??= [];
    const binding = scope.durable_objects.bindings.find((binding) => binding.name === bindingName);
    if (binding && (binding.class_name !== className || binding.script_name)) {
      throw new Error(
        `Durable Object binding "${bindingName}" must reference the local "${className}" class.`
      );
    }
    if (!binding) {
      scope.durable_objects.bindings.push({ name: bindingName, class_name: className });
    }

    const hasDurableExports = Object.values(scope.exports || {}).some(
      (entry) => entry.type === "durable-object"
    );
    if (!scope.migrations?.length && !hasDurableExports) {
      scope.migrations = [{ tag: "v1", new_sqlite_classes: [className] }];
    } else if (scope !== config && hasDurableExports && !scope.migrations) {
      scope.migrations = [];
    }
  }
}

function resolveDurableResolver(nitro: Nitro) {
  const resolverPath = nitro.options.cloudflare?.durable?.resolver;
  if (!resolverPath) {
    return;
  }

  return resolveModulePath(resolverPath, {
    from: nitro.options.rootDir,
    extensions: RESOLVE_EXTENSIONS,
  });
}
