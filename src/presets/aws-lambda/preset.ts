import { defineNitroPreset } from "nitropack/kit";
export type { AwsLambdaOptions as PresetOptions } from "./types";

const awsLambda = defineNitroPreset(
  {
    entry: "./runtime/aws-lambda",
    awsLambda: {
      streaming: false,
    },
    hooks: {
      "rollup:before": (nitro, rollupConfig) => {
        if (nitro.options.awsLambda?.streaming) {
          (rollupConfig.input as string) += "-streaming";
        }
      },
    },
  },
  {
    name: "aws-lambda" as const,
    url: import.meta.url,
  }
);

export default [awsLambda] as const;
