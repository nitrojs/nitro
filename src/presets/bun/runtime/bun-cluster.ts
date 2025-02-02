import { spawn, type Subprocess } from 'bun';
import { fileURLToPath } from 'mlly';
import {
  getGracefulShutdownConfig,
  trapUnhandledNodeErrors,
} from 'nitropack/runtime/internal';
import { join, dirname } from 'pathe';

const numberOfWorkers =
  Number.parseInt(process.env.NITRO_CLUSTER_WORKERS || "") ||
  navigator.hardwareConcurrency;

const workers: Subprocess[] = Array.from({ length: numberOfWorkers })
const dirName = dirname(fileURLToPath(import.meta.url))
const workerFile = join(dirName, "./bun-worker")

for (let i = 0; i < numberOfWorkers; i++) {
  workers[i] = createWorker(i)
}

let isShuttingDown = false;
let isTimedOut = false

const shutdownConfig = getGracefulShutdownConfig();

if (!shutdownConfig.disabled) {
  for (const signal of shutdownConfig.signals) {
    process.once(signal, onShutdown);
  }
}

trapUnhandledNodeErrors();

function createWorker(workerIndex: number): Subprocess {
  return spawn({
    cmd: ["bun", "--bun", workerFile],
    stdout: "inherit",
    stderr: "inherit",
    stdin: "inherit",
    onExit: () => {
      if (!isShuttingDown)
        workers[workerIndex] = createWorker(workerIndex)
    }
  });
}

async function onShutdown() {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;

  killWorkers()

  const workersKilled = Promise.all(workers.map(i => i.exited))

  await Promise.any([setTimeout(), workersKilled])

  if (isTimedOut) {
    console.warn(
      "[nitro] [cluster] Timeout reached for graceful shutdown. Forcing exit."
    );
  }

  if (shutdownConfig.forceExit) {
    process.exit(0);
  }
}

async function setTimeout() {
  isTimedOut = false
  await Bun.sleep(shutdownConfig.timeout)
  isTimedOut = true
}

function killWorkers() {
  for (const bun of workers) {
    bun.kill();
  }
}

