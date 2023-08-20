import { existsSync } from "node:fs";
import { join, relative, resolve } from "pathe";
import { readPackageJSON } from "pkg-types";
import { writeFile } from "../utils";
import { defineNitroPreset } from "../preset";
import type { Nitro } from "../types";

export const firebase = defineNitroPreset({
  entry: `#internal/nitro/entries/firebase-gen-{{ firebase.gen }}`,
  commands: {
    deploy: "npx firebase-tools deploy",
  },
  firebase: {
    // we need this defined here so it's picked up by the template in firebase's entry
    gen: (Number.parseInt(process.env.NITRO_FIREBASE_GEN) || "default") as any,
  },
  hooks: {
    async compiled(nitro) {
      await writeFirebaseConfig(nitro);
      await updatePackageJSON(nitro);
    },
    "rollup:before": (nitro) => {
      const _gen = nitro.options.firebase?.gen as unknown;
      if (!_gen || _gen === "default") {
        nitro.logger.warn(
          "Neither `firebase.gen` or `NITRO_FIREBASE_GEN` is set. Nitro will default to Cloud Functions 1st generation. It is recommended to set this to the latest generation (currently `2`). Set the version to remove this warning. See https://nitro.unjs.io/deploy/providers/firebase for more information."
        );
        // Using the gen 1 makes this preset backwards compatible for people already using it
        nitro.options.firebase = { gen: 1 };
      }
      nitro.options.appConfig.nitro = nitro.options.appConfig.nitro || {};
      nitro.options.appConfig.nitro.firebase = nitro.options.firebase;
    },
  },
});

async function writeFirebaseConfig(nitro: Nitro) {
  const firebaseConfigPath = join(nitro.options.rootDir, "firebase.json");
  if (existsSync(firebaseConfigPath)) {
    return;
  }
  const firebaseConfig = {
    functions: {
      source: relative(nitro.options.rootDir, nitro.options.output.serverDir),
    },
    hosting: [
      {
        site: "<your_project_id>",
        public: relative(nitro.options.rootDir, nitro.options.output.publicDir),
        cleanUrls: true,
        rewrites: [
          {
            source: "**",
            function: "server",
          },
        ],
      },
    ],
  };
  await writeFile(firebaseConfigPath, JSON.stringify(firebaseConfig, null, 2));
}

async function updatePackageJSON(nitro: Nitro) {
  // https://cloud.google.com/functions/docs/concepts/nodejs-runtime
  // const supportedNodeVersions = new Set(["20", "18", "16"]);
  const nodeVersion: string = nitro.options.firebase?.nodeVersion || "18";

  const packageJSONPath = join(nitro.options.rootDir, "package.json");

  const packageJSON = await readPackageJSON(packageJSONPath);

  delete packageJSON.bundledDependencies;

  const newPackageJSON = {
    ...packageJSON
    private: true,
    type: "module",
    main: "./index.mjs",
    bundledDependencies: undefined,
  });

  await writeFile(
    resolve(nitro.options.output.serverDir, "package.json"),
    JSON.stringify(
      {
        private: true,
        type: "module",
        main: "./index.mjs",
        dependencies: Object.fromEntries(
          Object.entries({
            "firebase-functions-test": "latest",
            "firebase-admin": await getPackageVersion("firebase-admin"),
            "firebase-functions": await getPackageVersion("firebase-functions"),
            ...dependencies,
          }).sort(([a], [b]) => a[0].localeCompare(b[0]))
        ),
        engines: { node: nodeVersion },
      },
      null,
      2
    )
  );
}
