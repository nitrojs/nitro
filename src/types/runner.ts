import type { IncomingMessage, OutgoingMessage } from "node:http";
import type { Duplex } from "node:stream";

export type RunnerMessageListener = (data: unknown) => void;

export type RunnerAddress = { host: string; port: number; socketPath?: string };

export type RunnerHooks = {
  onClose?: ((worker: Runner, cause?: unknown) => void) | undefined;
  onReady?: ((worker: Runner, address?: RunnerAddress) => void) | undefined;
};

export type RunnerOptions = {
  id: string;
  entry?: string;
  hooks?: RunnerHooks;
  data?: any;
};

export declare class Runner {
  // State
  readonly ready?: boolean;
  readonly closed?: boolean;

  // Lifecycle
  constructor(opts: RunnerOptions);
  close(): void | Promise<void>;

  // Server
  fetch: (req: Request) => Promise<Response>;
  upgrade?: (
    req: IncomingMessage,
    socket: OutgoingMessage<IncomingMessage> | Duplex,
    head: any
  ) => void;

  // RPC
  sendMessage: (message: unknown) => void;
  onMessage: (listener: RunnerMessageListener) => void;
  offMessage: (listener: RunnerMessageListener) => void;
}
