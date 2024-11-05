import cluster from "node:cluster";
import os from "node:os";
import {
  getGracefulShutdownConfig,
  trapUnhandledNodeErrors,
} from "nitropack/runtime/internal";

function runMaster() {
  const numberOfWorkers =
    Number.parseInt(process.env.NITRO_CLUSTER_WORKERS || "") ||
    (os.cpus().length > 0 ? os.cpus().length : 1);

  for (let i = 0; i < numberOfWorkers; i++) {
    cluster.fork();
  }

  // Restore worker on exit
  let isShuttingDown = false;
  cluster.on("exit", () => {
    if (!isShuttingDown) {
      cluster.fork();
    }
  });

  // Graceful shutdown
  const shutdownConfig = getGracefulShutdownConfig();
  if (!shutdownConfig.disabled) {
    async function onShutdown() {
      if (isShuttingDown) {
        return;
      }
      isShuttingDown = true;
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          console.warn(
            "[nitro] [cluster] Timeout reached for graceful shutdown. Forcing exit."
          );
          resolve();
        }, shutdownConfig.timeout);

        cluster.on("exit", () => {
          if (
            Object.values(cluster.workers || {}).every((w) => !w || w.isDead())
          ) {
            clearTimeout(timeout);
            resolve();
          } else {
            // Wait for other workers to die...
          }
        });
      });

      if (shutdownConfig.forceExit) {
        // eslint-disable-next-line unicorn/no-process-exit
        process.exit(0);
      }
    }
    for (const signal of shutdownConfig.signals) {
      process.once(signal, onShutdown);
    }
  }
}

function runWorker() {
  import("./node-server").catch((error) => {
    console.error(error);
    // eslint-disable-next-line unicorn/no-process-exit
    process.exit(1);
  });
}

// Trap unhandled errors
trapUnhandledNodeErrors();

if (cluster.isPrimary) {
  runMaster();
} else {
  runWorker();
}
