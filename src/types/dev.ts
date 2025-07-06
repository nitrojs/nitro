import type { IncomingMessage, OutgoingMessage } from "node:http";
import type { Duplex } from "node:stream";

export type FetchHandler = (req: Request) => Promise<Response>;

export type DevMessageListener = (data: unknown) => void;

export type UpgradeHandler = (
  req: IncomingMessage,
  socket: OutgoingMessage<IncomingMessage> | Duplex,
  head: any
) => void;

export interface DevRPCHooks {
  sendMessage: (message: unknown) => void;
  onMessage: (listener: DevMessageListener) => void;
  offMessage: (listener: DevMessageListener) => void;
}

export type WorkerAddress = { host: string; port: number; socketPath?: string };

export interface WorkerHooks {
  onClose?: (worker: DevWorker, cause?: unknown) => void;
  onReady?: (worker: DevWorker, address?: WorkerAddress) => void;
}

export interface DevWorker extends WorkerHooks, DevRPCHooks {
  readonly ready: boolean;
  readonly closed: boolean;

  fetch: FetchHandler;
  upgrade: UpgradeHandler;
  close(): Promise<void>;
}

export interface NitroDevServerOptions {
  port: number;
  hostname: string;
  watch: string[];
}
