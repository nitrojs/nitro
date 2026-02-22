import { resolve } from "pathe";
import { defineNitroPreset } from "../_utils/preset.ts";
import { writeFile } from "../_utils/fs.ts";
import { awsLambdaPreviewShim } from "./utils.ts";

export type { AwsLambdaOptions as PresetOptions } from "./types.ts";

const awsLambda = defineNitroPreset(
  {
    entry: "./aws-lambda/runtime/aws-lambda",
    commands: {
      preview: "npx srvx --prod ./",
    },
    awsLambda: {
      streaming: false,
    },
    hooks: {
      "rollup:before": (nitro, rollupConfig) => {
        if (nitro.options.awsLambda?.streaming) {
          (rollupConfig.input as string) += "-streaming";
          nitro.options.commands.preview =
            "npx srvx --prod --import ./server/aws-lambda-preview-shim.mjs ./";
        }
      },
      async compiled(nitro) {
        if (!nitro.options.awsLambda?.streaming) {
          return;
        }
        await writeFile(
          resolve(nitro.options.output.serverDir, "aws-lambda-preview-shim.mjs"),
          awsLambdaPreviewShim
        );
      },
    },
  },
  {
    name: "aws-lambda" as const,
  }
);

export default [awsLambda] as const;
