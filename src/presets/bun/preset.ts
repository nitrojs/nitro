import { fileURLToPath, resolvePathSync } from "mlly";
import { defineNitroPreset } from "nitropack/kit";
import { dirname, join, normalize, parse } from "pathe";

const dirName = dirname(fileURLToPath(import.meta.url))

const bun = defineNitroPreset(
  {
    extends: "node-server",
    entry: "./runtime/bun",
    // https://bun.sh/docs/runtime/modules#resolution
    exportConditions: ["bun", "worker", "node", "import", "default"],
    commands: {
      preview: "bun --bun ./server/index.mjs",
    },
  },
  {
    name: "bun" as const,
    url: import.meta.url,
  }
);

const bunCluster = defineNitroPreset(
  {
    extends: "node-server",
    entry: "./runtime/bun-cluster",
    commands: {
      preview: "bun --bun ./server/index.mjs",
    },
    rollupConfig: {
      external: ["bun"],
      input: [join(dirName + "/runtime/bun-cluster"), join(dirName + "/runtime/bun-worker")],
    },
    hooks: {
      "rollup:before"(_nitro, rollupConfig) {
        // ensure worker and master code chunk is seperated and isolated into it's own entry-file
        // this prevents worker file importing from master file
        const manualChunks = rollupConfig.output?.manualChunks;
        if (manualChunks && typeof manualChunks === "function") {
          const workerFile = resolvePathSync("./runtime/bun-worker", {
            url: import.meta.url,
          });

          const masterFile = resolvePathSync("./runtime/bun-cluster", {
            url: import.meta.url,
          });

          rollupConfig.output.manualChunks = (id, meta) => {
            if (id.includes("bun-worker") && normalize(id) === workerFile) {
              return "nitro/bun-worker";
            }    

            if (id.includes("bun-cluster") && normalize(id) === masterFile) {
              return "nitro/bun-cluster";
            }   

            return manualChunks(id, meta)
          };
        }

        // unique name for master to find worker file.
        rollupConfig.output.entryFileNames = (chunkInfo) => {
          if (chunkInfo.name === 'bun-worker') {
            return 'bun-worker.mjs';
          } 
          return "index.mjs"
        }
      },
    },
    exportConditions: ["bun", "worker", "node", "import", "default"],
  },
  {
    name: "bun-cluster" as const,
    url: import.meta.url,
  }
);

export default [bun, bunCluster] as const;
