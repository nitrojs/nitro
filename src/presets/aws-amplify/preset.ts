import { defineNitroPreset } from "nitropack/kit";
import { writeAmplifyFiles } from "./utils";

export type { AWSAmplifyOptions as PresetOptions } from "./types";

const awsAmplify = defineNitroPreset(
  {
    extends: "node-server",
    entry: "./runtime/aws-amplify",
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
    url: import.meta.url,
  }
);

const awsAmplifyStatic = defineNitroPreset(
  {
    extends: "static",
    output: {
      dir: "{{ rootDir }}/.amplify-hosting",
      publicDir: "{{ output.dir }}/static{{ baseURL }}",
    },
    commands: {
      preview: "npx serve ./static",
    },
    hooks: {
      async compiled(nitro) {
        await writeAmplifyFiles(nitro);
      },
    },
  },
  {
    name: "aws-amplify-static",
    stdName: "aws_amplify",
    static: true,
    url: import.meta.url,
  }
);

export default [awsAmplify, awsAmplifyStatic];
