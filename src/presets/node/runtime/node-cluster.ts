import cluster from "node:cluster";
import os from "node:os";

function runMaster() {
  const numberOfWorkers =
    Number.parseInt(process.env.NITRO_CLUSTER_WORKERS || "") ||
    (os.cpus().length > 0 ? os.cpus().length : 1);

  for (let i = 0; i < numberOfWorkers; i++) {
    cluster.fork({
      WORKER_ID: i + 1,
    });
  }
}

function runWorker() {
  import("./node-server.ts").catch((error) => {
    console.error(error);
    // eslint-disable-next-line unicorn/no-process-exit
    process.exit(1);
  });
}

if (cluster.isPrimary) {
  runMaster();
} else {
  runWorker();
}
