import type { PackageJson } from "pkg-types";
import { resolve, relative } from "pathe";
import { defineNitroPreset } from "../preset";
import { writeFile } from "../utils";

/**
 * Both function_id and organization_id fields are required but only used when deploying the function
 * Ref: https://github.com/lagonapp/lagon/blob/06093d051898d7603f356b9cae5e3f14078d480a/crates/cli/src/utils/deployments.rs#L34
 */
export interface LagonFunctionConfig {
  function_id: string;
  organization_id: string;
  index: string;
  client?: string;
  assets?: string;
}

export const lagon = defineNitroPreset({
  extends: "base-worker",
  entry: "#internal/nitro/entries/lagon",
  exportConditions: ["lagon"],
  commands: {
    preview: "npm run dev --prefix ./",
    deploy: "npm run deploy --prefix ./",
  },
  rollupConfig: {
    output: {
      entryFileNames: "index.mjs",
      format: "esm",
    },
  },

  hooks: {
    async compiled(nitro) {
      // Write Lagon config
      const root = nitro.options.output.dir;
      const indexPath = relative(
        root,
        resolve(nitro.options.output.serverDir, "index.mjs")
      );
      const assetsDir = relative(root, nitro.options.output.publicDir);

      await writeFile(
        resolve(root, ".lagon", "config.json"),
        JSON.stringify(<LagonFunctionConfig>{
          function_id: "",
          organization_id: "",
          index: indexPath,
          client: null,
          assets: assetsDir,
        })
      );

      // Write package.json for deployment
      await writeFile(
        resolve(nitro.options.output.dir, "package.json"),
        JSON.stringify(
          <PackageJson>{
            private: true,
            scripts: {
              dev: "npx -p esbuild -p @lagon/cli lagon dev",
              deploy: "npx -p esbuild -p @lagon/cli lagon deploy",
            },
          },
          null,
          2
        )
      );
    },
  },
});
