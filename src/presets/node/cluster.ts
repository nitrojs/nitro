import { resolve } from "pathe";
import { writeFile } from "../../utils/fs.ts";
import { defineNitroPreset } from "../_utils/preset.ts";

export const nodeCluster = defineNitroPreset(
  {
    extends: "node-server",
    serveStatic: true,
    entry: "./node/runtime/node-cluster",
    rollupConfig: {
      output: {
        entryFileNames: "worker.mjs",
      },
    },
    hooks: {
      async compiled(nitro) {
        await writeFile(
          resolve(nitro.options.output.serverDir, "index.mjs"),
          nodeClusterEntry()
        );
      },
    },
  },
  {
    name: "node-cluster" as const,
  }
);

function nodeClusterEntry() {
  return /* js */ `
import cluster from "node:cluster";
import os from "node:os";

if (cluster.isPrimary) {
  const numberOfWorkers =
    Number.parseInt(process.env.NITRO_CLUSTER_WORKERS || "") ||
    (os.cpus().length > 0 ? os.cpus().length : 1);
  for (let i = 0; i < numberOfWorkers; i++) {
    cluster.fork({
      WORKER_ID: i + 1,
    });
  }
} else {
 import("./worker.mjs").catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
`;
}
