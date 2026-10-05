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
        await writeFile(resolve(nitro.options.output.serverDir, "index.mjs"), nodeClusterEntry());
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
  const workers = [];
  for (let i = 0; i < numberOfWorkers; i++) {
    workers.push(cluster.fork({ WORKER_ID: i + 1 }));
  }
  const forwards = new Set(workers);
  cluster.on("exit", (worker) => {
    forwards.delete(worker);
    if (forwards.size === 0) {
      process.exit(0);
    }
  });
  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => {
      for (const worker of forwards) {
        worker.process.kill(signal);
      }
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
