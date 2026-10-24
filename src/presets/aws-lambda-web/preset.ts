import { defineNitroPreset } from "../_utils/preset.ts";

const awsLambdaWeb = defineNitroPreset(
  {
    extends: "node-server",
    entry: "./aws-lambda-web/runtime/aws-lambda-web",
  },
  {
    name: "aws-lambda-web" as const,
  }
);

export default [awsLambdaWeb] as const;
