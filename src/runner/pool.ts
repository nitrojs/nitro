import { isTest, isCI } from "std-env";
import { HTTPError } from "h3";
import consola from "consola";

import type { IncomingMessage, OutgoingMessage } from "node:http";
import type { Duplex } from "node:stream";
import type { RunnerMessageListener, Runner, RunnerOptions } from "nitro/types";

export type PoolOptions = {
  runner: typeof Runner;
  runnerOptions: Omit<RunnerOptions, "id">;
};

export class RunnerPool implements Runner {
  #options: PoolOptions;

  #workers: Runner[] = [];
  #workerIdCtr: number = 0;
  #messageListeners: Set<RunnerMessageListener> = new Set();

  constructor(options: PoolOptions) {
    this.#options = options;
  }

  async fetch(req: Request): Promise<Response> {
    const worker = await this.#getWorker();
    if (!worker) {
      return new Response("No worker available.", { status: 503 });
    }
    return worker.fetch(req);
  }

  async upgrade(
    req: IncomingMessage,
    socket: OutgoingMessage<IncomingMessage> | Duplex,
    head: any
  ) {
    const worker = await this.#getWorker();
    if (!worker) {
      throw new HTTPError({
        status: 503,
        statusText: "No worker available.",
      });
    }
    if (!worker.upgrade) {
      throw new HTTPError({
        status: 501,
        statusText: "Worker does not support upgrades.",
      });
    }
    return worker.upgrade(req, socket, head);
  }

  async close() {
    for (const worker of this.#workers) {
      try {
        await worker.close();
      } catch (error) {
        consola.error(error);
      }
    }
  }

  async add() {
    const worker = new this.#options.runner({
      ...this.#options.runnerOptions,
      id: `${this.#workerIdCtr++}`,
      hooks: {
        ...this.#options.runnerOptions.hooks,
        onClose: async (worker, cause) => {
          consola.warn(cause);
          const index = this.#workers.indexOf(worker);
          if (index !== -1) {
            this.#workers.splice(index, 1);
          }
          try {
            await this.#options.runnerOptions.hooks?.onClose?.(worker, cause);
          } catch (error) {
            consola.error(error);
          }
        },
      },
    });
    if (worker.closed) {
      throw new Error("Failed to initialize worker.");
    }
    for (const listener of this.#messageListeners) {
      worker.onMessage(listener);
    }
    this.#workers.unshift(worker);
  }

  async sendMessage(message: unknown) {
    await this.#getWorker();
    for (const worker of this.#workers) {
      if (!worker.closed) {
        worker.sendMessage(message);
      }
    }
  }

  onMessage(listener: RunnerMessageListener) {
    this.#messageListeners.add(listener);
    for (const worker of this.#workers) {
      worker.onMessage(listener);
    }
  }

  offMessage(listener: RunnerMessageListener) {
    this.#messageListeners.delete(listener);
    for (const worker of this.#workers) {
      worker.offMessage(listener);
    }
  }

  async #getWorker() {
    if (this.#workers.length === 0) {
      await this.add();
    }
    let retry = 0;
    const maxRetries = isTest || isCI ? 100 : 10;
    while (++retry < maxRetries) {
      if (this.#workers.length === 0) {
        return;
      }
      const activeWorker = this.#workers.find((w) => w.ready);
      if (activeWorker) {
        return activeWorker;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
}
