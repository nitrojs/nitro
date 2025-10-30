import { defineNitroPreset } from "../_utils/preset.ts";
import { writeAmplifyFiles } from "./utils.ts";

export type { AWSAmplifyOptions as PresetOptions } from "./types.ts";

const awsAmplify = defineNitroPreset(
  {
    entry: "./aws-amplify/runtime/aws-amplify",
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
