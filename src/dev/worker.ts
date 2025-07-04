import type { IncomingMessage, OutgoingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { HTTPError, type H3Event } from "h3";
import type { HTTPProxy } from "./proxy";
import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "pathe";
import { Worker } from "node:worker_threads";
import consola from "consola";
import { isCI, isTest } from "std-env";
import { createHTTPProxy, fetchAddress } from "./proxy";
import type { DevMessageListener } from "nitro/types";
import type { DevServer } from "./server";

export type WorkerAddress = { host: string; port: number; socketPath?: string };

export interface WorkerHooks {
  onClose?: (worker: DevWorker, cause?: unknown) => void;
  onReady?: (worker: DevWorker, address?: WorkerAddress) => void;
}

export interface DevWorker {
  readonly ready: boolean;
  readonly closed: boolean;
  close(): Promise<void>;
  fetch: (req: Request) => Promise<Response>;
  handleUpgrade: (
    req: IncomingMessage,
    socket: OutgoingMessage<IncomingMessage> | Duplex,
    head: any
  ) => void;
  sendMessage: (message: unknown) => void;
  onMessage: (listener: DevMessageListener) => void;
  offMessage: (listener: DevMessageListener) => void;
}

export class NodeDevWorker implements DevWorker {
  closed: boolean = false;

  #server: DevServer;
  #id: number;
  #hooks: WorkerHooks;

  #address?: WorkerAddress;
  #proxy?: HTTPProxy;
  #worker?: Worker & { _exitCode?: number };

  #messageListeners: Set<(data: unknown) => void>;

  constructor(server: DevServer, hooks: WorkerHooks = {}) {
    this.#server = server;
    this.#id = ++server.workerIdCtr;
    this.#hooks = hooks;
    this.#proxy = createHTTPProxy();
    this.#messageListeners = new Set(server.messageListeners);
    this.#initWorker();
  }

  get ready() {
    return Boolean(
      !this.closed && this.#address && this.#proxy && this.#worker
    );
  }

  async fetch(req: Request): Promise<Response> {
    if (!this.#address || !this.#proxy) {
      return new Response("Dev worker is unavailable", { status: 503 });
    }
    return fetchAddress(req, this.#address);
  }

  sendMessage(message: unknown) {
    if (!this.#worker) {
      throw new Error(
        "Dev worker should be initialized before sending messages."
      );
    }
    this.#worker.postMessage(message);
  }

  onMessage(listener: DevMessageListener) {
    this.#messageListeners.add(listener);
  }

  offMessage(listener: DevMessageListener) {
    this.#messageListeners.delete(listener);
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
    const workerEntryPath = this.#server.workerEntry;

    if (!existsSync(workerEntryPath)) {
      this.close(`worker entry not found in "${workerEntryPath}".`);
      return;
    }

    const worker = new Worker(workerEntryPath, {
      env: {
        ...process.env,
        NITRO_DEV_WORKER_ID: String(this.#id),
      },
      workerData: {
        runtimeConfig: this.#server.nitro.options.runtimeConfig,
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

  async #closeProxy() {
    this.#proxy?.proxy?.close(() => {
      // TODO: it will be never called! Investigate why and then await on it.
    });
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

    if (!this.#worker._exitCode && !isTest && !isCI) {
      await new Promise<void>((resolve) => {
        const gracefulShutdownTimeoutMs =
          Number.parseInt(process.env.NITRO_SHUTDOWN_TIMEOUT || "", 10) || 5000;
        const timeout = setTimeout(() => {
          if (process.env.DEBUG) {
            consola.warn(`force closing dev worker...`);
          }
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

  [Symbol.for("nodejs.util.inspect.custom")]() {
    // eslint-disable-next-line unicorn/no-nested-ternary
    const status = this.closed ? "closed" : this.ready ? "ready" : "pending";
    return `NodeDevWorker#${this.#id}(${status})`;
  }
}
