import type { Nitro } from "nitro/types";
import type { OutputPlugin, PluginContext } from "rollup";

export const emittedSource = '{"version":3,"sources":[],"names":[],"mappings":""}\n';

export function configureOutputBoundary(
  nitro: Nitro,
  field: "assetFileNames" | "sourcemapFileNames",
  onOverride: () => void,
  redirect = true
) {
  nitro.options.sourcemap = true;
  const pattern = field === "assetFileNames" ? "[name]-[hash][extname]" : "[name]-[hash].map";
  const plugin: OutputPlugin = {
    name: `fixture:task-cli-${field}-override`,
    outputOptions: {
      order: "post",
      handler(output) {
        if (redirect && output.dir?.replaceAll("\\", "/").endsWith("/tasks")) {
          onOverride();
          return { ...output, [field]: `changed-layout/${pattern}` };
        }
        return null;
      },
    },
  };
  const primary = nitro.options.rollupConfig?.output;
  nitro.options.rollupConfig = {
    ...nitro.options.rollupConfig,
    output: {
      ...primary,
      [field]: `primary-layout/${pattern}`,
      plugins: [primary?.plugins, plugin],
    },
  };
  nitro.options.buildPlugins.push({
    name: "fixture:task-cli-emit-boundary-asset",
    buildStart(this: Pick<PluginContext, "emitFile">) {
      this.emitFile({ type: "asset", name: "boundary-emitted.map", source: emittedSource });
    },
  });
}
