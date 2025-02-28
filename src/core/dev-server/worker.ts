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
  #id: number;
  #workerDir: string;
  #hooks: WorkerHooks;

  #address?: WorkerAddress;
  #proxy?: HTTPProxy;
  #worker?: Worker;

  constructor(id: number, workerDir: string, hooks: WorkerHooks = {}) {
    this.#id = id;
    this.#workerDir = workerDir;
    this.#hooks = hooks;
    this.#proxy = createHTTPProxy();
    this.#initWorker();
  }

  get ready() {
    return Boolean(
      !this.closed && this.#address && this.#proxy && this.#worker
    );
  }

  handleEvent(event: H3Event) {
    if (!this.#address || !this.#proxy) {
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
    return this.#proxy!.proxy.ws(
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
      env: {
        ...process.env,
        NITRO_DEV_WORKER_ID: String(this.#id),
        NITRO_DEV_WORKER_DIR: this.#workerDir,
      },
    });

    worker.once("exit", (code) => {
      this.close(`worker exited with code ${code}`);
    });

    worker.once("error", (error) => {
      this.close(error.stack || error.message);
    });

    worker.on("message", (message) => {
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
    this.#hooks = {};
    await Promise.all(
      [this.#closeProxy(), this.#closeSocket(), this.#closeWorker()].map((p) =>
        p.catch((error) => consola.error(error))
      )
    );
  }

  async #closeProxy() {
    await new Promise<void>((resolve) =>
      this.#proxy?.proxy?.close(() => resolve())
    );
    this.#proxy = undefined;
  }

  async #closeSocket() {
    const socketPath = this.#address?.socketPath;
    if (
      socketPath &&
      socketPath[0] !== "\0" &&
      !socketPath.startsWith(String.raw`\\.\pipe`)
    ) {
      await rm(socketPath).catch(() => {});
    }
    this.#address = undefined;
  }

  async #closeWorker() {
    if (!this.#worker) {
      return;
    }
    this.#worker.postMessage({ event: "shutdown" });
    await new Promise<void>((resolve) => {
      const gracefulShutdownTimeoutSec =
        Number.parseInt(process.env.NITRO_SHUTDOWN_TIMEOUT || "", 10) || 5;
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
    await this.#worker.terminate().catch((error) => {
      consola.error(error);
    });
    this.#worker = undefined;
  }
}
