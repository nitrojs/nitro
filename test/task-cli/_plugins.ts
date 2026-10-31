import type { NitroBuildPlugin } from "nitro/types";

export interface BuildOverrides {
  renameSidecar?: boolean;
  replaceSidecarInput?: boolean;
  wrapNitroPlugin?: boolean;
  hookDefine?: boolean;
}

export function contractPlugins(options: BuildOverrides): NitroBuildPlugin[] {
  let primaryInput: string | string[] | Record<string, string> | undefined;
  return [
    {
      name: "fixture:task-cli-contract-override",
      options(config: { input?: string | string[] | Record<string, string> }) {
        const entries =
          typeof config.input === "string" ? [config.input] : Object.values(config.input || {});
        const entry = entries.find((value) => /\/runtime\/task-cli(?:\.[cm]?[jt]s)?$/.test(value));
        if (!entry) {
          primaryInput = config.input;
          return;
        }
        if (options.replaceSidecarInput) return { ...config, input: primaryInput };
      },
      outputOptions(output: Record<string, unknown> & { dir?: string }) {
        if (options.renameSidecar && output.dir?.replaceAll("\\", "/").endsWith("/tasks")) {
          return { ...output, entryFileNames: "unexpected.mjs" };
        }
      },
    },
  ];
}

export function hookVirtualPlugin(): NitroBuildPlugin {
  return {
    name: "fixture:task-cli-hook-virtual",
    resolveId(id: string) {
      if (id === "virtual:task-cli-hook") return "\0task-cli-hook";
    },
    load(id: string) {
      if (id === "\0task-cli-hook") return 'export default "hook value"';
    },
  };
}

export function wrapNitroPlugin(plugins: unknown): unknown {
  if (Array.isArray(plugins)) return plugins.map(wrapNitroPlugin);
  if (
    plugins &&
    typeof plugins === "object" &&
    "name" in plugins &&
    plugins.name === "nitro:virtual"
  ) {
    return { ...plugins };
  }
  return plugins;
}
