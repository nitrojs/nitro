import { defineNitroPreset } from "nitropack/kit";
import { basename } from "pathe";
import type { Plugin } from "rollup";
import { genSafeVariableName } from "knitwork";
import { updatePackageJSON, writeFirebaseConfig } from "./utils";

export type { FirebaseOptions as PresetOptions } from "./types";

const firebase = defineNitroPreset(
  {
    entry: `./runtime/firebase-gen-{{ firebase.gen }}`,
    commands: {
      deploy: "npx firebase-tools deploy",
    },
    firebase: {
      // we need this defined here so it's picked up by the template in firebase's entry
      gen: (Number.parseInt(process.env.NITRO_FIREBASE_GEN || "") ||
        "default") as any,
    },
    hooks: {
      async compiled(nitro) {
        await writeFirebaseConfig(nitro);
        await updatePackageJSON(nitro);
      },
      "rollup:before": (nitro, rollupConfig) => {
        const _gen = nitro.options.firebase?.gen as unknown;
        if (!_gen || _gen === "default") {
          nitro.logger.warn(
            "Neither `firebase.gen` or `NITRO_FIREBASE_GEN` is set. Nitro will default to Cloud Functions 1st generation. It is recommended to set this to the latest generation (currently `2`). Set the version to remove this warning. See https://nitro.build/deploy/providers/firebase for more information."
          );
          // Using the gen 1 makes this preset backwards compatible for people already using it
          nitro.options.firebase = { gen: 1 };
        }
        nitro.options.appConfig.nitro = nitro.options.appConfig.nitro || {};
        nitro.options.appConfig.nitro.firebase = nitro.options.firebase;

        const { serverFunctionName } = nitro.options.firebase;
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

export default [firebase] as const;
