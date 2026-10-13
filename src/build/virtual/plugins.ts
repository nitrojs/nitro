import type { Nitro } from "nitro/types";
import { hash } from "../../utils/hash.ts";

export default function plugins(nitro: Nitro) {
  return {
    id: "#nitro/virtual/plugins",
    template: () => {
      const nitroPlugins = [...new Set(nitro.options.plugins)];

      return /* js */ `
  ${nitroPlugins.map((plugin) => /* js */ `import _${hash(plugin)} from "${plugin}";`).join("\n")}

  export const plugins = [
    ${nitroPlugins.map((plugin) => `_${hash(plugin)}`).join(",\n")}
  ]
      `;
    },
  };
}
