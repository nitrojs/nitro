import { parentPort, workerData } from "node:worker_threads";
import { ModuleRunner, ESModulesEvaluator } from "vite/module-runner";

// Apply globals
for (const [key, value] of Object.entries(workerData.globals || {})) {
  globalThis[key] = value;
}

const serviceEnvs = {};

class ServiceEnvironment {
  #name;
  #entryURL;
  #runner;
  #entryError;
  #entryModule;

  constructor(name, entry) {
    this.#name = name;
    this.#entryURL = entry;
    // https://vite.dev/guide/api-environment-runtimes.html#modulerunner
    this.#runner = new ModuleRunner(
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
  }

  async reload() {
    try {
      this.#entryModule = await this.#runner.import(this.#entryURL);
      this.#entryError = undefined;
    } catch (error) {
      this.#entryError = error;
    }
  }

  async fetch(req, init) {
    if (!this.#entryModule) {
      await this.reload();
    }
    if (this.#entryError) {
      throw this.#entryError;
    }
    try {
      const fetch =
        this.#entryModule?.fetch || this.#entryModule?.default?.fetch;
      if (!fetch) {
        throw new Error(
          `Missing \`fetch\` export in ${this.#name} (${workerData.#entryURL})`
        );
      }
      return await fetch(req, init);
    } catch (error) {
      return renderError(req, error);
    }
  }
}

// Local fertch support
// let rpcAddr;
// const originalFetch = globalThis.fetch;
// globalThis.fetch = (input, init) => {
//   const { viteEnv } = init || {};
//   if (!viteEnv) {
//     return originalFetch(input, init);
//   }
//   if (typeof input === "string" && input[0] === "/") {
//     input = new URL(input, "http://localhost");
//   }
//   const headers = new Headers(init?.headers || {});
//   headers.set("x-vite-env", viteEnv);
//   return fetchAddress(rpcAddr, input, { ...init, viteEnv: undefined, headers });
// };

parentPort.on("message", (payload) => {
  if (message?.type === "full-reload") {
    // TODO
  }

  if (payload.type === "custom" && payload.event === "nitro-rpc") {
    rpcAddr = payload.data;
  }
});
