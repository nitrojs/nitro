import { parentPort, workerData } from "node:worker_threads";
import { ModuleRunner, ESModulesEvaluator } from "vite/module-runner";

// https://vite.dev/guide/api-environment-runtimes.html#modulerunner

const runner = new ModuleRunner(
  {
    transport: {
      connect(handlers) {
        const { onMessage, onDisconnection } = handlers;
        parentPort.on("message", onMessage);
        parentPort.on("close", onDisconnection);
      },
      send(payload) {
        parentPort.postMessage(payload);
      },
    },
  },
  new ESModulesEvaluator(),
  process.env.DEBUG ? console.debug : undefined
);

globalThis.__NITRO_RUNTIME_CONFIG__ = workerData.runtimeConfig;

await runner.import("__nitro_entry__");
