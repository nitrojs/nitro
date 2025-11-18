import { defineNitroPreset } from "nitropack/kit";
import { writeAmplifyFiles } from "./utils";

export type { AWSAmplifyOptions as PresetOptions } from "./types";

const awsAmplify = defineNitroPreset(
  {
    extends: "node-server",
    entry: "./runtime/aws-amplify",
    manifest: {
      // https://docs.aws.amazon.com/amplify/latest/userguide/environment-variables.html#amplify-console-environment-variables
      deploymentId: process.env.AWS_JOB_ID,
    },
    output: {
      dir: "{{ rootDir }}/.amplify-hosting",
      serverDir: "{{ output.dir }}/compute/default",
      publicDir: "{{ output.dir }}/static{{ baseURL }}",
    },
    commands: {
      preview: "node {{ output.serverDir }}/server.js",
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
    url: import.meta.url,
  }
);

export default [awsAmplify] as const;
