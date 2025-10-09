import { defineNitroPreset } from "../_utils/preset";
export type { AwsLambdaOptions as PresetOptions } from "./types";

const awsLambda = defineNitroPreset(
  {
    entry: "./aws-lambda/runtime/aws-lambda",
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
  }
);

export default [awsLambda] as const;
