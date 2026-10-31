import type { OutputPlugin } from "rollup";
import type { NitroConfig } from "nitro/types";

export interface OutputOverrides {
  outputTransform?: boolean;
  outputOverride?: boolean;
  outputPaths?: boolean;
  outputTopology?: boolean;
  customOutput?: boolean;
}

export function fixtureOutputConfig(options: OutputOverrides): NitroConfig["rollupConfig"] {
  if (
    !options.customOutput &&
    !options.outputTransform &&
    !options.outputOverride &&
    !options.outputPaths &&
    !options.outputTopology
  )
    return;
  const plugins: OutputPlugin[] = [];
  if (options.outputTransform)
    plugins.push({
      name: "fixture:task-cli-output-transform",
      renderChunk(code) {
        return { code: code.replaceAll("OUTPUT_SENTINEL", "transformed"), map: null };
      },
    });
  if (options.outputOverride)
    plugins.push({
      name: "fixture:task-cli-output-override",
      outputOptions: {
        order: "post",
        handler(output) {
          if (output.dir?.replaceAll("\\", "/").endsWith("/tasks")) {
            return { ...output, dir: output.dir + "-redirected" };
          }
          return null;
        },
      },
    });
  if (options.outputTopology)
    plugins.push({
      name: "fixture:task-cli-output-topology",
      outputOptions: {
        order: "post",
        handler(output) {
          if (output.dir?.replaceAll("\\", "/").endsWith("/tasks")) {
            const splitting = (output as { codeSplitting?: { groups?: unknown[] } }).codeSplitting;
            if (splitting && typeof splitting === "object") {
              (splitting.groups ||= []).push({ name: "all", test: () => true });
              console.info("task CLI topology override", "codeSplitting.groups");
            } else {
              output.manualChunks = () => "all";
              console.info("task CLI topology override", "manualChunks");
            }
          }
          return null;
        },
      },
    });
  return {
    output: {
      esModule: "if-default-prop",
      ...(options.customOutput ? { entryFileNames: "entry name.mjs" } : {}),
      ...(options.outputTransform
        ? { banner: 'globalThis.__taskCLIOutputBanner = "output banner";' }
        : {}),
      ...(options.outputPaths
        ? { paths: { "task-cli-unused-external": "./must-not-be-used.mjs" } }
        : {}),
      plugins,
    },
  };
}
