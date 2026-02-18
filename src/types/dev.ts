import type { IncomingMessage } from "node:http";
import type { Socket } from "node:net";
import type { Worker } from "node:worker_threads";
import type { FSWatcher } from "chokidar";
import type { App } from "h3";
import type { ListenOptions, Listener } from "listhen";

export interface DevServerOptions {
  watch: string[];
}

export interface NitroWorker {
  worker: Worker | null;
  address: { host: string; port: number; socketPath?: string };
}

export interface NitroDevServer {
  reload: () => void;
  listen: (
    port: ListenOptions["port"],
    opts?: Partial<ListenOptions>
  ) => Promise<Listener>;
  app: App;
  close: () => Promise<void>;
  watcher?: FSWatcher;
  upgrade: (
    req: IncomingMessage,
    socket: Socket,
    head: Buffer
  ) => void;
}
