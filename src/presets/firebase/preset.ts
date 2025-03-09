import { defineNitroPreset } from "../_utils/preset";
import { writeFile } from "../_utils/fs";
import { version as nitroVersion } from "nitro/meta";
import { basename, join, relative } from "pathe";
import type { Plugin } from "rollup";
import { genSafeVariableName } from "knitwork";
import { stringifyYAML } from "confbox";
import { updatePackageJSON, writeFirebaseConfig } from "./utils";
import type {
  AppHostingOptions,
  AppHostingOutputBundleConfig,
  FirebaseFunctionsOptions,
} from "./types";

export type { FirebaseOptions as PresetOptions } from "./types";

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
              ...(nitro.options.firebase as AppHostingOptions)?.appHosting,
            },
            metadata: {
              framework: nitro.options.framework.name || "nitro",
              frameworkVersion: nitro.options.framework.version || "2.x",
              adapterPackageName: "nitro",
              adapterVersion: nitroVersion,
            },
            outputFiles: {
              serverApp: {
                include: [
                  relative(nitro.options.rootDir, nitro.options.output.dir),
                ],
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
    url: import.meta.url,
  }
);

const firebase = defineNitroPreset(
  {
    entry: `./runtime/firebase`,
    commands: {
      deploy: "npx firebase-tools deploy",
    },
    firebase: {},
    hooks: {
      async compiled(nitro) {
        await writeFirebaseConfig(nitro);
        await updatePackageJSON(nitro);
      },
      "rollup:before": (nitro, rollupConfig) => {
        // TODO: add options support back using virtual template
        // nitro.options.appConfig.nitro = nitro.options.appConfig.nitro || {};
        // nitro.options.appConfig.nitro.firebase = nitro.options.firebase;

        const { serverFunctionName } = nitro.options
          .firebase as FirebaseFunctionsOptions;
        if (
          serverFunctionName &&
          serverFunctionName !== genSafeVariableName(serverFunctionName)
        ) {
          throw new Error(
            `\`firebase.serverFunctionName\` must be a valid JS variable name: \`${serverFunctionName}\``
          );
        }

        // Replace __firebaseServerFunctionName__ to actual name in entries
        (rollupConfig.plugins as Plugin[]).unshift({
          name: "nitro:firebase",
          transform: (code, id) => {
            if (basename(id).startsWith("firebase-gen-")) {
              return {
                code: code.replace(
                  /__firebaseServerFunctionName__/g,
                  serverFunctionName || "server"
                ),
                map: null,
              };
            }
          },
        } satisfies Plugin);
      },
    },
  },
  {
    name: "firebase" as const,
    url: import.meta.url,
  }
);

export default [firebase, firebaseAppHosting] as const;
