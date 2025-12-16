import { defineNitroPreset } from "../_utils/preset.ts";
import { writeAmplifyFiles } from "./utils.ts";

export type { AWSAmplifyOptions as PresetOptions } from "./types.ts";

const awsAmplify = defineNitroPreset(
  {
    entry: "./aws-amplify/runtime/aws-amplify",
    manifest: {
      // https://docs.aws.amazon.com/amplify/latest/userguide/environment-variables.html#amplify-console-environment-variables
      deploymentId: process.env.AWS_JOB_ID,
    },
    serveStatic: true,
    output: {
      dir: "{{ rootDir }}/.amplify-hosting",
      serverDir: "{{ output.dir }}/compute/default",
      publicDir: "{{ output.dir }}/static{{ baseURL }}",
    },
    commands: {
      preview: "node ./compute/default/server.js",
    },
    hooks: {
      async compiled(nitro) {
        await writeAmplifyFiles(nitro);
      },
    },
  },
  {
    name: "aws-amplify" as const,
    stdName: "aws_amplify",
  }
);

export default [awsAmplify] as const;
