import { defineNitroPreset } from "../_utils/preset.ts";

export type { AwsLambdaOptions as PresetOptions } from "./types.ts";

const awsLambda = defineNitroPreset(
  {
    entry: "./aws-lambda/runtime/aws-lambda",
    awsLambda: {
      streaming: false,
    },
    hooks: {
      "build:config": (nitro, buildConfig) => {
        if (!nitro.options.awsLambda?.streaming) {
          return;
        }
        if (buildConfig.builder === "rspack") {
          (buildConfig.rspack.entry as Record<string, string>).index += "-streaming";
          return;
        }
        const config = buildConfig.rollup ?? buildConfig.rolldown;
        (config.input as string) += "-streaming";
      },
    },
  },
  {
    name: "aws-lambda" as const,
  }
);

export default [awsLambda] as const;
