import { defineNitroPreset } from "../_utils/preset.ts";
import { writeFile } from "../_utils/fs.ts";
import { version as nitroVersion } from "nitro/meta";
import { join, relative } from "pathe";
import { stringifyYAML } from "confbox";
import type { AppHostingOutputBundleConfig } from "./types.ts";

export type { FirebaseOptions as PresetOptions } from "./types.ts";

const firebaseAppHosting = defineNitroPreset(
  {
    extends: "node-server",
    serveStatic: true,
    hooks: {
      async compiled(nitro) {
        const serverEntry = join(nitro.options.output.serverDir, "index.mjs");
        await writeFile(
          join(nitro.options.rootDir, ".apphosting/bundle.yaml"),
          stringifyYAML({
            version: "v1",
            runConfig: {
              runCommand: `node ${relative(nitro.options.rootDir, serverEntry)}`,
              ...nitro.options.firebase?.appHosting,
            },
            metadata: {
              framework: nitro.options.framework.name || "nitro",
              frameworkVersion: nitro.options.framework.version || "2.x",
              adapterPackageName: "nitro",
              adapterVersion: nitroVersion,
            },
            outputFiles: {
              serverApp: {
                include: [relative(nitro.options.rootDir, nitro.options.output.dir)],
              },
            },
          } satisfies AppHostingOutputBundleConfig),
          true
        );
      },
    },
  },
  {
    name: "firebase-app-hosting" as const,
    stdName: "firebase_app_hosting",
  }
);

export default [firebaseAppHosting] as const;
