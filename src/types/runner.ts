import type { IncomingMessage } from "node:http";
import type { Socket } from "node:net";

export type FetchHandler = (req: Request) => Promise<Response>;

export type RunnerMessageListener = (data: unknown) => void;

export type UpgradeHandler = (req: IncomingMessage, socket: Socket, head: any) => void;

export interface RunnerRPCHooks {
  sendMessage: (message: unknown) => void;
  onMessage: (listener: RunnerMessageListener) => void;
  offMessage: (listener: RunnerMessageListener) => void;
}

export type WorkerAddress =
  | { host?: string; port: number; socketPath?: undefined }
  | { host?: undefined; port?: undefined; socketPath: string };

export interface WorkerHooks {
  onClose?: (worker: EnvRunner, cause?: unknown) => void;
  onReady?: (worker: EnvRunner, address?: WorkerAddress) => void;
}

export interface EnvRunner extends WorkerHooks, RunnerRPCHooks {
  readonly ready: boolean;
  readonly closed: boolean;

  fetch: FetchHandler;
  upgrade?: UpgradeHandler;
  close(): Promise<void>;
}
