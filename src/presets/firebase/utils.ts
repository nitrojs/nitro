import { existsSync } from "node:fs";
import { writeFile, getDefaultNodeVersion } from "nitropack/kit";
import type { Nitro } from "nitropack/types";
import { join, relative } from "pathe";
import { readPackageJSON, writePackageJSON } from "pkg-types";

/**
 * Supported Node.js versions for Firebase Functions.
 * @link https://cloud.google.com/functions/docs/runtime-support#node.js
 */
const supportedNodeVersions = new Set([18, 20]);

export async function writeFirebaseConfig(nitro: Nitro) {
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

export async function updatePackageJSON(nitro: Nitro) {
  const packageJSONPath = join(nitro.options.output.serverDir, "package.json");
  const packageJSON = await readPackageJSON(packageJSONPath);
  await writePackageJSON(packageJSONPath, {
    ...packageJSON,
    main: "index.mjs",
    dependencies: Object.fromEntries(
      Object.entries({
        // Default to "latest" normally they should be overridden with user versions
        "firebase-admin": "latest",
        "firebase-functions": "latest",
        ...packageJSON.dependencies,
      })
        .filter((e) => e[0] !== "fsevents")
        .sort(([a], [b]) => a.localeCompare(b))
    ),
    engines: {
      // https://cloud.google.com/functions/docs/concepts/nodejs-runtime
      node:
        nitro.options.firebase?.nodeVersion ||
        getDefaultNodeVersion(supportedNodeVersions),
    },
  });
}
