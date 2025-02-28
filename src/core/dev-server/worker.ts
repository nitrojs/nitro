import type { IncomingMessage, OutgoingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { createError, type H3Event } from "h3";
import type { HTTPProxy } from "./proxy";
import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "pathe";
import { Worker } from "node:worker_threads";
import consola from "consola";
import { createHTTPProxy } from "./proxy";

export type WorkerAddress = { host: string; port: number; socketPath?: string };

export interface WorkerHooks {
  onClose?: (worker: DevWorker, reason?: string) => void;
  onReady?: (worker: DevWorker, address?: WorkerAddress) => void;
}

export interface DevWorker {
  readonly ready: boolean;
  readonly closed: boolean;
  close(): Promise<void>;
  handleEvent: (event: H3Event) => Promise<void>;
  handleUpgrade: (
    req: IncomingMessage,
    socket: OutgoingMessage<IncomingMessage> | Duplex,
    head: any
  ) => void;
}

export class NodeDevWorker implements DevWorker {
  closed: boolean = false;
  #address?: WorkerAddress;
  #workerDir: string;
  #hooks: WorkerHooks;
  #proxy: HTTPProxy;
  #worker?: Worker;

  constructor(workerDir: string, hooks: WorkerHooks = {}) {
    this.#workerDir = workerDir;
    this.#hooks = hooks;
    this.#proxy = createHTTPProxy();
    this.#initWorker();
  }

  get ready() {
    return Boolean(!this.closed && this.#worker && this.#address);
  }

  handleEvent(event: H3Event) {
    if (!this.#address) {
      throw createError({
        statusCode: 503,
        message: "worker is not ready yet",
      });
    }
    return this.#proxy.handleEvent(event, { target: this.#address });
  }

  handleUpgrade(
    req: IncomingMessage,
    socket: OutgoingMessage<IncomingMessage> | Duplex,
    head: any
  ) {
    if (!this.ready) {
      return;
    }
    return this.#proxy.proxy.ws(
      req,
      socket as OutgoingMessage<IncomingMessage>,
      { target: this.#address, xfwd: true },
      head
    );
  }

  #initWorker() {
    const workerEntryPath = join(this.#workerDir, "index.mjs");

    if (!existsSync(workerEntryPath)) {
      this.close(`worker entry not found in "${workerEntryPath}".`);
      return;
    }

    const worker = new Worker(workerEntryPath, {
      env: { ...process.env, NITRO_DEV_WORKER_DIR: this.#workerDir },
    });

    worker.once("exit", (code) => {
      this.close(`worker exited with code ${code}`);
    });

    worker.once("error", (error) => {
      this.close(error.stack || error.message);
    });

    worker.on("message", (message) => {
      consola.log(message);
      if (message?.address) {
        this.#address = message.address;
        this.#hooks.onReady?.(this, this.#address);
      }
    });

    this.#worker = worker;
  }

  async close(reason?: string) {
    if (this.closed) {
      return;
    }

    this.closed = true;

    this.#hooks.onClose?.(this, reason);

    if (this.#address?.socketPath) {
      await rm(this.#address.socketPath).catch(() => {});
    }
    this.#address = undefined;

    if (this.#worker) {
      this.#worker.postMessage({ event: "shutdown" });

      await new Promise<void>((resolve) => {
        const gracefulShutdownTimeoutSec =
          Number.parseInt(process.env.NITRO_SHUTDOWN_TIMEOUT || "", 10) || 3;
        const timeout = setTimeout(() => {
          consola.warn(
            `force closing dev worker after ${gracefulShutdownTimeoutSec} seconds...`
          );
          resolve();
        }, gracefulShutdownTimeoutSec * 1000);

        this.#worker?.on("message", (message) => {
          if (message.event === "exit") {
            clearTimeout(timeout);
            resolve();
          }
        });
      });

      this.#worker.removeAllListeners();

      await this.#worker.terminate();

      consola.log("normal close....");

      this.#worker = undefined;
    }
  }
}
