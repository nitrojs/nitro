import type { WranglerConfig } from "./types.ts";
import type { Nitro } from "nitro/types";

const DEFAULT_DURABLE_BINDING_NAME = "$DurableObject";

export function setupDurable(nitro: Nitro) {
  nitro.options.virtual["#nitro/virtual/cloudflare-durable"] = () =>
    `export const bindingName = ${JSON.stringify(nitro.options.cloudflare?.durable?.bindingName || DEFAULT_DURABLE_BINDING_NAME)};`;
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
