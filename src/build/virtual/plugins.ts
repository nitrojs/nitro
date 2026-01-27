import type { Nitro } from "nitro/types";
import { hash } from "ohash";

export default function plugins(nitro: Nitro) {
  return {
    id: "#nitro/virtual/plugins",
    template: () => {
      const nitroPlugins = [...new Set(nitro.options.plugins)];

      return /* js */ `
  ${nitroPlugins
    .map((plugin) => /* js */ `import _${hash(plugin).replace(/-/g, "")} from "${plugin}";`)
    .join("\n")}

  export const plugins = [
    ${nitroPlugins.map((plugin) => `_${hash(plugin).replace(/-/g, "")}`).join(",\n")}
  ]
      `;
    },
  };
}
