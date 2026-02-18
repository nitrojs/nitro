import type { IncomingMessage } from "node:http";
import type { Socket } from "node:net";
import type { HTTPProxy } from "./proxy.ts";
import type { RunnerMessageListener, EnvRunner, WorkerAddress, WorkerHooks } from "nitro/types";

import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { Worker } from "node:worker_threads";
import consola from "consola";
import { proxyFetch } from "httpxy";
import { isCI, isTest } from "std-env";
import { createHTTPProxy } from "./proxy.ts";

export interface EnvRunnerData {
  name?: string;
  [key: string]: unknown;
}

export class NodeEnvRunner implements EnvRunner {
  closed: boolean = false;

  #name: string;
  #entry: string;
  #data?: EnvRunnerData;
  #hooks: Partial<WorkerHooks>;
  #worker?: Worker & { _exitCode?: number };
  #address?: WorkerAddress;
  #proxy?: HTTPProxy;
  #messageListeners: Set<(data: unknown) => void>;

  constructor(opts: { name: string; entry: string; hooks?: WorkerHooks; data?: EnvRunnerData }) {
    this.#name = opts.name;
    this.#entry = opts.entry;
    this.#data = opts.data;
    this.#hooks = opts.hooks || {};

    this.#proxy = createHTTPProxy();
    this.#messageListeners = new Set();
    this.#initWorker();
  }

  get ready() {
    return Boolean(!this.closed && this.#address && this.#proxy && this.#worker);
  }

  // #region Public methods

  async fetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
    for (let i = 0; i < 5 && !(this.#address && this.#proxy); i++) {
      await new Promise((r) => setTimeout(r, 100 * Math.pow(2, i)));
    }
    if (!(this.#address && this.#proxy)) {
      return new Response("Node env runner worker is unavailable", {
        status: 503,
      });
    }
    return proxyFetch(this.#address, input, init);
  }

  upgrade(req: IncomingMessage, socket: Socket, head: any) {
    if (!this.ready) {
      return;
    }
    return this.#proxy!.proxy
      .ws(req, socket, { target: this.#address, xfwd: true }, head)
      .catch((error) => {
        consola.error("WebSocket proxy error:", error);
      });
  }

  sendMessage(message: unknown) {
    if (!this.#worker) {
      throw new Error("Node env worker should be initialized before sending messages.");
    }
    this.#worker.postMessage(message);
  }

  onMessage(listener: RunnerMessageListener) {
    this.#messageListeners.add(listener);
  }

  offMessage(listener: RunnerMessageListener) {
    this.#messageListeners.delete(listener);
  }

  async close(cause?: unknown) {
    if (this.closed) {
      return;
    }
    this.closed = true;
    this.#hooks.onClose?.(this, cause);
    this.#hooks = {};
    const onError = (error: unknown) => consola.error(error);
    await this.#closeWorker().catch(onError);
    await this.#closeProxy().catch(onError);
    await this.#closeSocket().catch(onError);
  }

  [Symbol.for("nodejs.util.inspect.custom")]() {
    // eslint-disable-next-line unicorn/no-nested-ternary
    const status = this.closed ? "closed" : this.ready ? "ready" : "pending";
    return `NodeEnvRunner#${this.#name}(${status})`;
  }

  // #endregion

  // #region Private methods

  #initWorker() {
    if (!existsSync(this.#entry)) {
      this.close(`worker entry not found in "${this.#entry}".`);
      return;
    }

    const worker = new Worker(this.#entry, {
      env: {
        ...process.env,
      },
      workerData: {
        name: this.#name,
        ...this.#data,
      },
    }) as Worker & { _exitCode?: number };

    worker.once("exit", (code) => {
      worker._exitCode = code;
      this.close(`worker exited with code ${code}`);
    });

    worker.once("error", (error) => {
      consola.error(`Worker error:`, error);
      this.close(error);
    });

    worker.on("message", (message) => {
      if (message?.address) {
        this.#address = message.address;
        this.#hooks.onReady?.(this, this.#address);
      }
      for (const listener of this.#messageListeners) {
        listener(message);
      }
    });

    this.#worker = worker;
  }

  async #closeProxy() {
    this.#proxy?.proxy?.close(() => {
      // TODO: it will be never called! Investigate why and then await on it.
    });
    this.#proxy = undefined;
  }

  async #closeSocket() {
    const socketPath = this.#address?.socketPath;
    if (socketPath && socketPath[0] !== "\0" && !socketPath.startsWith(String.raw`\\.\pipe`)) {
      await rm(socketPath).catch(() => {});
    }
    this.#address = undefined;
  }

  async #closeWorker() {
    if (!this.#worker) {
      return;
    }
    this.#worker.postMessage({ event: "shutdown" });

    if (!this.#worker._exitCode && !isTest && !isCI) {
      await new Promise<void>((resolve) => {
        const gracefulShutdownTimeoutMs =
          Number.parseInt(process.env.NITRO_SHUTDOWN_TIMEOUT || "", 10) || 5000;
        const timeout = setTimeout(() => {
          consola.warn(`force closing node env runner worker...`);
          resolve();
        }, gracefulShutdownTimeoutMs);

        this.#worker?.on("message", (message) => {
          if (message.event === "exit") {
            clearTimeout(timeout);
            resolve();
          }
        });
      });
    }
    this.#worker.removeAllListeners();
    await this.#worker.terminate().catch((error) => {
      consola.error(error);
    });
    this.#worker = undefined;
  }

  // #endregion
}
