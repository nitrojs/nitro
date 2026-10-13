import { defineConfig } from "nitro";
import type { NitroBuildPlugin } from "nitro/types";

export default defineConfig({
  preset: "standard",
  virtual: {
    "#order-pre": () => `export default "nitro"`,
    "#order-normal": () => `export default "nitro"`,
    "#order-post": () => `export default "nitro"`,
  },
  modules: [
    (nitro) => {
      nitro.options.buildPlugins.push(virtualModule("virtual:module", "module"));
    },
  ],
  buildPlugins: [
    virtualModule("#order-pre", "pre", "pre"),
    virtualModule("#order-normal", "normal"),
    virtualModule("#order-post", "post", "post"),
    Promise.resolve([virtualModule("virtual:promise", "promise"), false]),
  ],
});

function virtualModule(id: string, value: string, enforce?: "pre" | "post"): NitroBuildPlugin {
  const resolvedId = `\0build-plugins:${id}`;
  return {
    name: `fixture:${value}`,
    enforce,
    resolveId: {
      // Same hook order as Nitro's virtual modules: only the plugin position differs
      order: "pre",
      filter: { id: new RegExp(`^${id}$`) },
      handler: () => resolvedId,
    },
    load: {
      filter: { id: new RegExp(`^\0build-plugins:${id}$`) },
      handler: () => `export default ${JSON.stringify(value)}`,
    },
  };
}
