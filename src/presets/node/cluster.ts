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
  for (let i = 0; i < numberOfWorkers; i++) {
    cluster.fork({
      WORKER_ID: i + 1,
    });
  }

  let isShuttingDown = false;
  const forwardSignal = (signal) => {
    if (isShuttingDown) {
      process.exit(0);
      return;
    }
    isShuttingDown = true;
    for (const id in cluster.workers) {
      try {
        cluster.workers[id]?.process.kill(signal);
      } catch {}
    }
    const timeout =
      Number.parseInt(process.env.NITRO_SHUTDOWN_TIMEOUT || "") || 30_000;
    const timer = setTimeout(() => {
      for (const id in cluster.workers) {
        try {
          cluster.workers[id]?.process.kill("SIGKILL");
        } catch {}
      }
      process.exit(0);
    }, timeout);
    timer.unref?.();
  };

  process.on("SIGINT", () => forwardSignal("SIGINT"));
  process.on("SIGTERM", () => forwardSignal("SIGTERM"));

  cluster.on("exit", () => {
    if (isShuttingDown) {
      const aliveWorkers = Object.values(cluster.workers || {}).filter(
        (w) => w && !w.isDead()
      );
      if (aliveWorkers.length === 0) {
        process.exit(0);
      }
    }
  });
} else {
 import("./worker.mjs").catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
`;
}
